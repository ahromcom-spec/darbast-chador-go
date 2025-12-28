import { useState, useCallback, useEffect } from 'react';
import { ModuleItem } from '@/components/profile/DraggableModuleItem';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY_AVAILABLE = 'module_hierarchy_available';
const STORAGE_KEY_ASSIGNED = 'module_hierarchy_assigned';
const CUSTOM_NAMES_KEY = 'custom_module_names_v2';

interface UseModuleHierarchyProps {
  type: 'available' | 'assigned';
  initialModules: ModuleItem[];
}

export function useModuleHierarchy({ type, initialModules }: UseModuleHierarchyProps) {
  const storageKey = type === 'available' ? STORAGE_KEY_AVAILABLE : STORAGE_KEY_ASSIGNED;
  
  const [items, setItems] = useState<ModuleItem[]>([]);
  const [customNames, setCustomNames] = useState<Record<string, { name: string; description: string }>>({});
  const [draggedItem, setDraggedItem] = useState<ModuleItem | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved hierarchy from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const savedNames = localStorage.getItem(CUSTOM_NAMES_KEY);
      
      if (savedNames) {
        setCustomNames(JSON.parse(savedNames));
      }
      
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with initial modules to add any new ones
        const savedIds = new Set<string>();
        const collectIds = (items: ModuleItem[]) => {
          items.forEach(item => {
            savedIds.add(item.key);
            if (item.children) collectIds(item.children);
          });
        };
        collectIds(parsed);
        
        // Add any new modules that aren't in saved hierarchy
        const newModules = initialModules.filter(m => !savedIds.has(m.key));
        setItems([...parsed, ...newModules]);
      } else {
        setItems(initialModules);
      }
    } catch (error) {
      console.error('Error loading module hierarchy:', error);
      setItems(initialModules);
    }
    setIsLoaded(true);
  }, [storageKey, initialModules]);

  // Save hierarchy to localStorage
  const saveHierarchy = useCallback((newItems: ModuleItem[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    } catch (error) {
      console.error('Error saving module hierarchy:', error);
    }
  }, [storageKey]);

  // Save custom names and sync with database
  const saveCustomNames = useCallback(async (names: Record<string, { name: string; description: string }>) => {
    try {
      localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(names));
      setCustomNames(names);
    } catch (error) {
      console.error('Error saving custom names:', error);
    }
  }, []);

  // Update module assignment names in database when custom names change
  const syncModuleNamesToDatabase = useCallback(async (moduleKey: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('module_assignments')
        .update({ module_name: newName })
        .eq('module_key', moduleKey);
      
      if (error) {
        console.error('Error syncing module names to database:', error);
      }
    } catch (error) {
      console.error('Error syncing module names:', error);
    }
  }, []);

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

  return {
    items,
    customNames,
    draggedItem,
    isLoaded,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    toggleFolder,
    editItem,
    reorderItems,
    setItems
  };
}
