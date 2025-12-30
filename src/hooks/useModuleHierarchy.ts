import { useState, useCallback, useEffect, useRef } from 'react';
import { ModuleItem } from '@/components/profile/DraggableModuleItem';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY_AVAILABLE = 'module_hierarchy_available';
const STORAGE_KEY_ASSIGNED = 'module_hierarchy_assigned';
const CUSTOM_NAMES_KEY = 'custom_module_names_v2';

interface UseModuleHierarchyProps {
  type: 'available' | 'assigned';
  initialModules: ModuleItem[];
  /**
   * For assigned modules, `initialModules` is often empty while assignments are still loading.
   * Set this to false during loading to prevent merge logic from temporarily stripping modules
   * from folders (which makes them re-appear at root after refresh).
   */
  isInitialModulesReady?: boolean;
  onModuleNameChange?: () => void;
}

/**
 * Helper to merge saved hierarchy with initialModules for available modules
 */
function mergeAvailableHierarchy(saved: ModuleItem[], initialModules: ModuleItem[]): ModuleItem[] {
  const savedKeys = new Set<string>();
  const collectKeys = (items: ModuleItem[]) => {
    items.forEach(item => {
      savedKeys.add(item.key);
      if (item.children) collectKeys(item.children);
    });
  };
  collectKeys(saved);
  const newModules = initialModules.filter(m => !savedKeys.has(m.key));
  return [...saved, ...newModules];
}

/**
 * Normalize legacy assigned hierarchy where module identity may have been saved with unstable ids.
 *
 * For assigned modules we want a *stable* identifier that matches the current `initialModules`.
 * In some legacy saves, `key` could be a random id while `id` was the real moduleKey (or vice‑versa).
 * This normalizer maps any known legacy id/key to the current canonical module key.
 */
function normalizeAssignedHierarchyIds(items: ModuleItem[], initialModules: ModuleItem[]): ModuleItem[] {
  // Build canonical key map from current modules.
  // Any of (m.key, m.id, m.name, m.href) should map to the canonical stable key we use everywhere.
  const canonicalByAnyKey = new Map<string, string>();
  const canonicalByName = new Map<string, string>();
  const canonicalByHref = new Map<string, string>();

  const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();

  for (const m of initialModules) {
    const canonical = m.key || m.id;
    if (!canonical) continue;

    if (m.key) canonicalByAnyKey.set(m.key, canonical);
    if (m.id) canonicalByAnyKey.set(m.id, canonical);

    if (m.name) canonicalByName.set(norm(m.name), canonical);
    if (m.href) canonicalByHref.set(m.href, canonical);
  }

  const normalize = (arr: ModuleItem[]): ModuleItem[] =>
    arr.map((it) => {
      if (it.type === 'folder') {
        return { ...it, children: normalize(it.children || []) };
      }

      // 1) Prefer explicit key/id match
      const candidates = [it.key, it.id].filter(Boolean) as string[];
      const match = candidates.find((k) => canonicalByAnyKey.has(k));
      if (match) {
        const canonical = canonicalByAnyKey.get(match)!;
        return { ...it, key: canonical, id: canonical };
      }

      // 2) Fallback: match by href (more stable than name if present)
      if (it.href && canonicalByHref.has(it.href)) {
        const canonical = canonicalByHref.get(it.href)!;
        return { ...it, key: canonical, id: canonical };
      }

      // 3) Fallback: match by name (best-effort for legacy saves)
      const nameKey = it.name ? norm(it.name) : '';
      if (nameKey && canonicalByName.has(nameKey)) {
        const canonical = canonicalByName.get(nameKey)!;
        return { ...it, key: canonical, id: canonical };
      }

      // 4) Unknown module: keep its own identity (prevents it from "jumping" folders)
      //    It will be filtered out later if it truly no longer exists in `initialModules`.
      const fallback = it.key || it.id;
      return { ...it, key: fallback, id: fallback };
    });

  return normalize(items);
}

/**
 * Helper to merge saved hierarchy with initialModules for assigned modules
 */
function mergeAssignedHierarchy(savedRaw: ModuleItem[], initialModules: ModuleItem[]): ModuleItem[] {
  const saved = normalizeAssignedHierarchyIds(savedRaw, initialModules);

  const getStableKey = (m: ModuleItem) => m.key || m.id;
  const validKeys = new Set(initialModules.map(getStableKey));
  const initialModulesMap = new Map(initialModules.map((m) => [getStableKey(m), m]));

  // Update modules in hierarchy with fresh data from initialModules, keeping their position
  const updateModulesInPlace = (items: ModuleItem[]): ModuleItem[] => {
    return items
      .map((item) => {
        if (item.type === 'folder') {
          // Keep folders even if they are empty (must persist across refresh)
          const updatedChildren = item.children ? updateModulesInPlace(item.children) : [];
          return { ...item, children: updatedChildren };
        }

        const stableKey = getStableKey(item);

        // For modules: if still valid (has assignments), update with fresh data
        if (validKeys.has(stableKey)) {
          const freshData = initialModulesMap.get(stableKey);
          if (freshData) {
            // Merge fresh data but keep folder placement; enforce stable id/key
            return { ...item, ...freshData, key: stableKey, id: stableKey };
          }
          return { ...item, key: stableKey, id: stableKey };
        }

        // Module no longer has assignments - remove it
        return null;
      })
      .filter((item): item is ModuleItem => item !== null);
  };

  // Collect module keys that are inside any folder.
  // If duplicates exist both at root and in a folder, folder placement must win.
  const inFolderKeys = new Set<string>();
  const collectInFolderKeys = (items: ModuleItem[], insideFolder: boolean) => {
    items.forEach((item) => {
      if (item.type === 'folder') {
        collectInFolderKeys(item.children || [], true);
        return;
      }
      if (insideFolder) inFolderKeys.add(getStableKey(item));
    });
  };

  const removeRootDuplicates = (items: ModuleItem[], isRoot: boolean): ModuleItem[] => {
    return items
      .map((item) => {
        if (item.type === 'folder') {
          const children = removeRootDuplicates(item.children || [], false);
          return { ...item, children };
        }
        const stableKey = getStableKey(item);
        if (isRoot && inFolderKeys.has(stableKey)) return null;
        return { ...item, key: stableKey, id: stableKey };
      })
      .filter((i): i is ModuleItem => i !== null);
  };

  // Remove duplicates across the tree (e.g., accidental duplicates across folders)
  const dedupeByKey = (items: ModuleItem[], seen: Set<string>): ModuleItem[] => {
    return items
      .map((item) => {
        if (item.type === 'folder') {
          // Keep empty folders too
          const children = item.children ? dedupeByKey(item.children, seen) : [];
          return { ...item, children };
        }
        const stableKey = getStableKey(item);
        if (seen.has(stableKey)) return null;
        seen.add(stableKey);
        return { ...item, key: stableKey, id: stableKey };
      })
      .filter((i): i is ModuleItem => i !== null);
  };

  const updated = updateModulesInPlace(saved);
  collectInFolderKeys(updated, false);

  const updatedHierarchy = dedupeByKey(removeRootDuplicates(updated, true), new Set());

  // Collect all module keys in the updated hierarchy
  const hierarchyModuleKeys = new Set<string>();
  const collectModuleKeys = (items: ModuleItem[]) => {
    items.forEach((item) => {
      if (item.type === 'module') hierarchyModuleKeys.add(getStableKey(item));
      if (item.children) collectModuleKeys(item.children);
    });
  };
  collectModuleKeys(updatedHierarchy);

  // Add new modules that don't exist in hierarchy yet (at root level)
  const newModules = initialModules
    .filter((m) => !hierarchyModuleKeys.has(getStableKey(m)))
    .map((m) => {
      const stableKey = getStableKey(m);
      return { ...m, key: stableKey, id: stableKey };
    });

  return [...updatedHierarchy, ...newModules];
}

export function useModuleHierarchy({ type, initialModules, isInitialModulesReady = true, onModuleNameChange }: UseModuleHierarchyProps) {
  const storageKey = type === 'available' ? STORAGE_KEY_AVAILABLE : STORAGE_KEY_ASSIGNED;

  const [items, setItems] = useState<ModuleItem[]>(() => initialModules);
  const [customNames, setCustomNames] = useState<Record<string, { name: string; description: string }>>({});
  const [draggedItem, setDraggedItem] = useState<ModuleItem | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track save timeout for debouncing
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  // Load hierarchy from DB first, fallback to localStorage
  useEffect(() => {
    let cancelled = false;

    const loadFromDB = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;

        let hierarchy: ModuleItem[] | null = null;
        let names: Record<string, { name: string; description: string }> = {};

        // Try fetching from database if user is logged in
        if (userId) {
          const { data } = await (supabase as any)
            .from('module_hierarchy_states')
            .select('hierarchy, custom_names')
            .eq('owner_user_id', userId)
            .eq('type', type)
            .maybeSingle();

          if (data && data.hierarchy) {
            hierarchy = data.hierarchy as unknown as ModuleItem[];
            names = (data.custom_names as unknown as Record<string, { name: string; description: string }>) || {};
          }
        }

        // Fallback to localStorage if no DB data
        if (!hierarchy) {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            try {
              hierarchy = JSON.parse(saved);
            } catch {
              hierarchy = null;
            }
          }
          const savedNames = localStorage.getItem(CUSTOM_NAMES_KEY);
          if (savedNames) {
            try {
              names = JSON.parse(savedNames);
            } catch {
              names = {};
            }
          }
        }

        if (cancelled) return;

        setCustomNames(names);

        if (hierarchy && hierarchy.length > 0) {
          if (type === 'available') {
            setItems(mergeAvailableHierarchy(hierarchy, initialModules));
          } else {
            // For assigned modules: during first render, initialModules can be empty until assignments load.
            // In that case, keep DB hierarchy as-is (folders + module placement) and reconcile later.
            if (initialModules.length === 0) {
              setItems(hierarchy);
            } else {
              setItems(mergeAssignedHierarchy(hierarchy, initialModules));
            }
          }
        } else {
          setItems(initialModules);
        }
      } catch (error) {
        console.error('Error loading module hierarchy:', error);
        if (!cancelled) {
          setItems(initialModules);
        }
      }
      if (!cancelled) {
        setIsLoaded(true);
      }
    };

    loadFromDB();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, storageKey]);

  // When initialModules change (e.g., new assignments), update items
  useEffect(() => {
    if (!isLoaded) return;
    if (type !== 'assigned') return;

    // IMPORTANT: while assignments are still loading, `initialModules` is often an empty array.
    // Merging with an empty array would temporarily remove all modules from folders, and then
    // when assignments arrive, modules get re-added at root level (appears as "module jumped out").
    if (!isInitialModulesReady || initialModules.length === 0) return;

    setItems((prev) => {
      const merged = mergeAssignedHierarchy(prev, initialModules);

      // One-time repair: if normalization/merge changed anything, persist the repaired hierarchy
      // so future refreshes start from a clean, stable structure.
      try {
        const prevStr = JSON.stringify(prev);
        const mergedStr = JSON.stringify(merged);
        if (prevStr !== mergedStr) saveHierarchy(merged);
      } catch {
        // If stringify fails for any reason, still keep the merged state.
      }

      return merged;
    });
  }, [initialModules, isLoaded, isInitialModulesReady, saveHierarchy, type]);

  // Save hierarchy to localStorage AND database (debounced)
  const saveHierarchy = useCallback((newItemsRaw: ModuleItem[]) => {
    // For assigned hierarchy: normalize before persisting so folder placement never breaks on refresh.
    const newItems =
      type === 'assigned' && initialModules.length > 0
        ? normalizeAssignedHierarchyIds(newItemsRaw, initialModules)
        : newItemsRaw;

    // Save to localStorage immediately
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch (error) {
      console.error('Error saving module hierarchy to localStorage:', error);
    }

    // Debounce database save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        if (!userId) return;

        const hierarchyStr = JSON.stringify(newItems);
        // Skip if nothing changed
        if (lastSavedRef.current === hierarchyStr) return;

        await (supabase as any)
          .from('module_hierarchy_states')
          .upsert(
            {
              owner_user_id: userId,
              type,
              hierarchy: newItems,
              custom_names: customNames,
            },
            { onConflict: 'owner_user_id,type' }
          );

        lastSavedRef.current = hierarchyStr;
      } catch (error) {
        console.error('Error saving module hierarchy to DB:', error);
      }
    }, 500);
  }, [storageKey, type, customNames, initialModules]);

  // Save custom names to localStorage AND database
  const saveCustomNames = useCallback(async (names: Record<string, { name: string; description: string }>) => {
    try {
      localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(names));
      setCustomNames(names);

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;

      await (supabase as any)
        .from('module_hierarchy_states')
        .upsert(
          {
            owner_user_id: userId,
            type,
            hierarchy: items,
            custom_names: names,
          },
          { onConflict: 'owner_user_id,type' }
        );
    } catch (error) {
      console.error('Error saving custom names:', error);
    }
  }, [type, items]);

  // Update module assignment names in database when custom names change
  // This updates ALL assignments with this module_key so all assigned users see the new name
  const syncModuleNamesToDatabase = useCallback(async (moduleKey: string, newName: string) => {
    try {
      // Extract base key from custom modules (e.g., "custom-12345" -> use original key if exists)
      // For copied modules, we store original key reference
      const baseKey = moduleKey.startsWith('custom-') ? moduleKey : moduleKey;
      
      const { error } = await supabase
        .from('module_assignments')
        .update({ module_name: newName })
        .eq('module_key', baseKey);
      
      if (error) {
        console.error('Error syncing module names to database:', error);
      } else {
        console.log(`Module name synced to database: ${baseKey} -> ${newName}`);
        // Notify parent to refresh assignments list
        onModuleNameChange?.();
      }
    } catch (error) {
      console.error('Error syncing module names:', error);
    }
  }, [onModuleNameChange]);

  // Handle drag start
  const handleDragStart = useCallback((item: ModuleItem, e: React.DragEvent) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  // Find and remove item from hierarchy
  const removeItemFromHierarchy = (items: ModuleItem[], itemId: string): { items: ModuleItem[]; removed: ModuleItem | null } => {
    let removed: ModuleItem | null = null;
    
    const newItems = items.filter(item => {
      if (item.id === itemId) {
        removed = item;
        return false;
      }
      return true;
    }).map(item => {
      if (item.children) {
        const result = removeItemFromHierarchy(item.children, itemId);
        if (result.removed) removed = result.removed;
        return { ...item, children: result.items };
      }
      return item;
    });
    
    return { items: newItems, removed };
  };

  // Add item to folder
  const addItemToFolder = (items: ModuleItem[], folderId: string, newItem: ModuleItem): ModuleItem[] => {
    return items.map(item => {
      if (item.id === folderId && item.type === 'folder') {
        return {
          ...item,
          isOpen: true,
          children: [...(item.children || []), newItem]
        };
      }
      if (item.children) {
        return {
          ...item,
          children: addItemToFolder(item.children, folderId, newItem)
        };
      }
      return item;
    });
  };

  // Handle drop
  const handleDrop = useCallback((targetItem: ModuleItem, e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetItem.id) {
      return;
    }

    // Prevent dropping a folder into itself or its children
    const isDescendant = (parent: ModuleItem, childId: string): boolean => {
      if (parent.id === childId) return true;
      if (parent.children) {
        return parent.children.some(child => isDescendant(child, childId));
      }
      return false;
    };

    if (draggedItem.type === 'folder' && isDescendant(draggedItem, targetItem.id)) {
      return;
    }

    setItems(prevItems => {
      // Remove dragged item from its current position
      const { items: itemsWithoutDragged, removed } = removeItemFromHierarchy(prevItems, draggedItem.id);
      
      if (!removed) return prevItems;

      let newItems: ModuleItem[];

      if (targetItem.type === 'folder') {
        // Drop into folder
        newItems = addItemToFolder(itemsWithoutDragged, targetItem.id, removed);
      } else {
        // Drop onto another module - create new folder
        const newFolder: ModuleItem = {
          id: `folder-${Date.now()}`,
          type: 'folder',
          key: `folder-${Date.now()}`,
          name: 'پوشه جدید',
          description: 'پوشه ایجاد شده از ترکیب ماژول‌ها',
          children: [removed],
          isOpen: true
        };

        // Find and replace target with folder containing both items
        const replaceWithFolder = (items: ModuleItem[]): ModuleItem[] => {
          return items.map(item => {
            if (item.id === targetItem.id) {
              return {
                ...newFolder,
                children: [item, removed]
              };
            }
            if (item.children) {
              return {
                ...item,
                children: replaceWithFolder(item.children)
              };
            }
            return item;
          });
        };

        newItems = replaceWithFolder(itemsWithoutDragged);
      }

      saveHierarchy(newItems);
      return newItems;
    });

    setDraggedItem(null);
  }, [draggedItem, saveHierarchy]);

  // Toggle folder open/close
  const toggleFolder = useCallback((folderId: string) => {
    setItems(prevItems => {
      const toggleInItems = (items: ModuleItem[]): ModuleItem[] => {
        return items.map(item => {
          if (item.id === folderId) {
            return { ...item, isOpen: !item.isOpen };
          }
          if (item.children) {
            return { ...item, children: toggleInItems(item.children) };
          }
          return item;
        });
      };
      
      const newItems = toggleInItems(prevItems);
      saveHierarchy(newItems);
      return newItems;
    });
  }, [saveHierarchy]);

  // Edit item name and description
  const editItem = useCallback((item: ModuleItem, newName: string, newDescription: string) => {
    const newCustomNames = {
      ...customNames,
      [item.key]: { name: newName, description: newDescription }
    };
    saveCustomNames(newCustomNames);

    // Sync module names to database for assigned modules
    if (item.type === 'module') {
      syncModuleNamesToDatabase(item.key, newName);
    }

    // Also update in items for folders
    if (item.type === 'folder') {
      setItems(prevItems => {
        const updateInItems = (items: ModuleItem[]): ModuleItem[] => {
          return items.map(i => {
            if (i.id === item.id) {
              return { ...i, name: newName, description: newDescription };
            }
            if (i.children) {
              return { ...i, children: updateInItems(i.children) };
            }
            return i;
          });
        };
        
        const newItems = updateInItems(prevItems);
        saveHierarchy(newItems);
        return newItems;
      });
    }
  }, [customNames, saveCustomNames, saveHierarchy, syncModuleNamesToDatabase]);

  // Reorder item within same level
  const reorderItems = useCallback((sourceId: string, targetId: string) => {
    setItems(prevItems => {
      const reorderInLevel = (items: ModuleItem[]): ModuleItem[] => {
        const sourceIndex = items.findIndex(i => i.id === sourceId);
        const targetIndex = items.findIndex(i => i.id === targetId);
        
        if (sourceIndex !== -1 && targetIndex !== -1) {
          const newItems = [...items];
          const [removed] = newItems.splice(sourceIndex, 1);
          newItems.splice(targetIndex, 0, removed);
          return newItems;
        }
        
        return items.map(item => {
          if (item.children) {
            return { ...item, children: reorderInLevel(item.children) };
          }
          return item;
        });
      };
      
      const newItems = reorderInLevel(prevItems);
      saveHierarchy(newItems);
      return newItems;
    });
  }, [saveHierarchy]);

  // Move item to a specific index in root level (for drop between)
  const handleDropBetween = useCallback((targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggedItem) {
      return;
    }

    setItems(prevItems => {
      // Remove dragged item from its current position
      const { items: itemsWithoutDragged, removed } = removeItemFromHierarchy(prevItems, draggedItem.id);
      
      if (!removed) return prevItems;

      // Insert at target index
      const newItems = [...itemsWithoutDragged];
      // Adjust target index if the item was before the target position
      const adjustedIndex = Math.min(targetIndex, newItems.length);
      newItems.splice(adjustedIndex, 0, removed);

      saveHierarchy(newItems);
      return newItems;
    });

    setDraggedItem(null);
  }, [draggedItem, saveHierarchy]);

  // Move item up within its level
  const moveItemUp = useCallback((itemId: string) => {
    setItems(prevItems => {
      const moveUp = (items: ModuleItem[]): ModuleItem[] => {
        const index = items.findIndex(i => i.id === itemId);
        if (index > 0) {
          const newItems = [...items];
          [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
          return newItems;
        }
        return items.map(item => {
          if (item.children) {
            return { ...item, children: moveUp(item.children) };
          }
          return item;
        });
      };
      
      const newItems = moveUp(prevItems);
      saveHierarchy(newItems);
      return newItems;
    });
  }, [saveHierarchy]);

  // Move item down within its level
  const moveItemDown = useCallback((itemId: string) => {
    setItems(prevItems => {
      const moveDown = (items: ModuleItem[]): ModuleItem[] => {
        const index = items.findIndex(i => i.id === itemId);
        if (index !== -1 && index < items.length - 1) {
          const newItems = [...items];
          [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
          return newItems;
        }
        return items.map(item => {
          if (item.children) {
            return { ...item, children: moveDown(item.children) };
          }
          return item;
        });
      };
      
      const newItems = moveDown(prevItems);
      saveHierarchy(newItems);
      return newItems;
    });
  }, [saveHierarchy]);

  // Add module to folder
  const addModuleToFolder = useCallback((folderId: string, moduleId: string) => {
    setItems(prevItems => {
      // First remove module from current position
      const { items: itemsWithoutModule, removed } = removeItemFromHierarchy(prevItems, moduleId);
      if (!removed) return prevItems;

      // Then add to folder
      const newItems = addItemToFolder(itemsWithoutModule, folderId, removed);
      saveHierarchy(newItems);
      return newItems;
    });
  }, [saveHierarchy]);

  // Remove module from folder (move to root)
  const removeModuleFromFolder = useCallback((moduleId: string) => {
    setItems(prevItems => {
      const { items: itemsWithoutModule, removed } = removeItemFromHierarchy(prevItems, moduleId);
      if (!removed) return prevItems;

      // Add to root level
      const newItems = [...itemsWithoutModule, removed];
      saveHierarchy(newItems);
      return newItems;
    });
  }, [saveHierarchy]);

  // Get modules available to add to folders (modules at root level, not in any folder)
  const getAvailableModulesForFolder = useCallback((): ModuleItem[] => {
    return items.filter(item => item.type === 'module');
  }, [items]);

  // Wrapper to update items and save to DB
  const updateItems = useCallback((updater: (prev: ModuleItem[]) => ModuleItem[]) => {
    setItems(prev => {
      const newItems = updater(prev);
      saveHierarchy(newItems);
      return newItems;
    });
  }, [saveHierarchy]);

  return {
    items,
    customNames,
    draggedItem,
    isLoaded,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleDropBetween,
    toggleFolder,
    editItem,
    reorderItems,
    setItems: updateItems, // Use updateItems instead of raw setItems to ensure DB persistence
    moveItemUp,
    moveItemDown,
    addModuleToFolder,
    removeModuleFromFolder,
    getAvailableModulesForFolder
  };
}
