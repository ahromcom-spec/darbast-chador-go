import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleAssignmentInfo {
  moduleName: string;
  moduleDescription: string;
  isLoading: boolean;
}

interface HierarchyItem {
  id: string;
  key?: string;
  type: string;
  name: string;
  description?: string;
  children?: HierarchyItem[];
}

const STORAGE_KEY_AVAILABLE = 'module_hierarchy_available';
const STORAGE_KEY_ASSIGNED = 'module_hierarchy_assigned';
const CUSTOM_NAMES_KEY = 'custom_module_names_v2';

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function findInHierarchy(items: HierarchyItem[], moduleKey: string): HierarchyItem | null {
  for (const item of items) {
    if (item.id === moduleKey || item.key === moduleKey) return item;
    if (item.children) {
      const found = findInHierarchy(item.children, moduleKey);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Hook to get the module's custom name and description for the current user.
 * - For the owner: reads from module_hierarchy_states (type=available) and falls back to localStorage.
 * - For assigned users: reads from module_assignments; if possible, also tries to resolve description from the assigner’s saved hierarchy.
 */
export function useModuleAssignmentInfo(
  moduleKey: string,
  defaultName: string,
  defaultDescription: string
): ModuleAssignmentInfo {
  const { user } = useAuth();

  const [moduleName, setModuleName] = useState(defaultName);
  const [moduleDescription, setModuleDescription] = useState(defaultDescription);
  const [isLoading, setIsLoading] = useState(true);

  const localFallback = useMemo(() => {
    const customNames =
      safeParseJson<Record<string, { name: string; description?: string }>>(localStorage.getItem(CUSTOM_NAMES_KEY)) ||
      null;

    // Prefer custom names
    if (customNames?.[moduleKey]?.name) {
      return {
        name: customNames[moduleKey].name,
        description: customNames[moduleKey].description ?? defaultDescription,
      };
    }

    // Fallback to hierarchy name/description
    const hierarchy =
      safeParseJson<HierarchyItem[]>(localStorage.getItem(STORAGE_KEY_AVAILABLE)) ||
      safeParseJson<HierarchyItem[]>(localStorage.getItem(STORAGE_KEY_ASSIGNED));

    if (hierarchy) {
      const found = findInHierarchy(hierarchy, moduleKey);
      if (found?.name) {
        return {
          name: found.name,
          description: found.description ?? defaultDescription,
        };
      }
    }

    return null;
  }, [moduleKey, defaultDescription]);

  useEffect(() => {
    let cancelled = false;

    const apply = (name?: string | null, description?: string | null) => {
      if (cancelled) return;
      if (name) setModuleName(name);
      if (description) setModuleDescription(description);
    };

    const fetchHierarchyForOwner = async (ownerUserId: string) => {
      // Prefer type=available since that's where "Available Modules" customizations are stored
      const { data: availableState } = await (supabase as any)
        .from('module_hierarchy_states')
        .select('custom_names, hierarchy')
        .eq('owner_user_id', ownerUserId)
        .eq('type', 'available')
        .maybeSingle();

      if (availableState) return availableState;

      // Fallback to type=assigned (rare, but keeps it robust)
      const { data: assignedState } = await (supabase as any)
        .from('module_hierarchy_states')
        .select('custom_names, hierarchy')
        .eq('owner_user_id', ownerUserId)
        .eq('type', 'assigned')
        .maybeSingle();

      return assignedState;
    };

    const resolveFromHierarchyState = (state: any) => {
      const customNames =
        (state?.custom_names as unknown as Record<string, { name: string; description?: string }> | null) || null;
      const hierarchy = (state?.hierarchy as unknown as HierarchyItem[] | null) || null;

      if (customNames?.[moduleKey]?.name) {
        return {
          name: customNames[moduleKey].name,
          description: customNames[moduleKey].description ?? defaultDescription,
        };
      }

      if (hierarchy) {
        const found = findInHierarchy(hierarchy, moduleKey);
        if (found?.name) {
          return {
            name: found.name,
            description: found.description ?? defaultDescription,
          };
        }
      }

      return null;
    };

    const fetchModuleInfo = async () => {
      setIsLoading(true);

      if (!user) {
        setIsLoading(false);
        return;
      }

      // Apply local fallback immediately so UI doesn't feel "stuck".
      if (localFallback) {
        apply(localFallback.name, localFallback.description);
      } else {
        apply(defaultName, defaultDescription);
      }

      try {
        // 1) Owner path (CEO who edited module names)
        const ownerState = await fetchHierarchyForOwner(user.id);
        const ownerResolved = resolveFromHierarchyState(ownerState);
        if (ownerResolved) {
          apply(ownerResolved.name, ownerResolved.description);
          if (!cancelled) setIsLoading(false);
          return;
        }

        // 2) Assigned user path
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile?.phone_number) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const { data: assignments } = await supabase
          .from('module_assignments')
          .select('module_key, module_name, assigned_by')
          .eq('assigned_phone_number', profile.phone_number)
          .eq('is_active', true);

        const exact = assignments?.find(a => a.module_key === moduleKey);
        if (exact?.module_name) {
          apply(exact.module_name, null);

          // Best-effort: try to resolve description/name from assigner's hierarchy (if policies allow)
          if (exact.assigned_by) {
            try {
              const assignerState = await fetchHierarchyForOwner(exact.assigned_by);
              const assignerResolved = resolveFromHierarchyState(assignerState);
              if (assignerResolved) {
                apply(assignerResolved.name, assignerResolved.description);
              }
            } catch {
              // ignore
            }
          }

          if (!cancelled) setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error fetching module info:', error);
      }

      if (!cancelled) setIsLoading(false);
    };

    fetchModuleInfo();

    return () => {
      cancelled = true;
    };
  }, [user, moduleKey, defaultName, defaultDescription, localFallback]);

  return { moduleName, moduleDescription, isLoading };
}

