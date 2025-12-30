import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleAssignmentInfo {
  moduleName: string;
  moduleDescription: string;
  isLoading: boolean;
}

interface HierarchyItem {
  id: string;
  type: string;
  name: string;
  description?: string;
  children?: HierarchyItem[];
}

/**
 * Hook to get the module's custom name and description for the current user.
 * Checks both module_hierarchy_states (for owner) and module_assignments (for assigned users).
 * Falls back to default values if no custom name found.
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

  useEffect(() => {
    const fetchModuleInfo = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // First check module_hierarchy_states for owner's custom names
        const { data: hierarchyState } = await supabase
          .from('module_hierarchy_states')
          .select('custom_names, hierarchy')
          .eq('owner_user_id', user.id)
          .eq('type', 'ceo')
          .maybeSingle();

        if (hierarchyState) {
          const customNames = hierarchyState.custom_names as unknown as Record<string, { name: string; description?: string }> | null;
          const hierarchy = hierarchyState.hierarchy as unknown as HierarchyItem[] | null;
          
          // Check custom_names first
          if (customNames && customNames[moduleKey]) {
            setModuleName(customNames[moduleKey].name);
            setModuleDescription(customNames[moduleKey].description ?? defaultDescription);
            setIsLoading(false);
            return;
          }

          // Search in hierarchy to find the item by moduleKey (covers normal + copied modules)
          if (hierarchy) {
            const findInHierarchy = (items: HierarchyItem[]): HierarchyItem | null => {
              for (const item of items) {
                if (item.id === moduleKey) return item;
                if (item.children) {
                  const found = findInHierarchy(item.children);
                  if (found) return found;
                }
              }
              return null;
            };

            const foundItem = findInHierarchy(hierarchy);
            if (foundItem) {
              setModuleName(foundItem.name);
              setModuleDescription(foundItem.description ?? defaultDescription);
              setIsLoading(false);
              return;
            }
          }
        }

        // If not found in hierarchy states, check module_assignments for assigned users
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .single();

        if (profile?.phone_number) {
          const { data: assignments } = await supabase
            .from('module_assignments')
            .select('module_key, module_name')
            .eq('assigned_phone_number', profile.phone_number)
            .eq('is_active', true);

          if (assignments && assignments.length > 0) {
            // First try exact match
            const exactMatch = assignments.find(a => a.module_key === moduleKey);
            if (exactMatch) {
              setModuleName(exactMatch.module_name);
              setIsLoading(false);
              return;
            }

            // For copied modules (custom-*), find by matching
            const customMatch = assignments.find(a => 
              a.module_key.startsWith('custom-') && 
              (a.module_name.includes(defaultName) || defaultName.includes(a.module_name.replace(' (کپی)', '')))
            );
            
            if (customMatch) {
              setModuleName(customMatch.module_name);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching module info:', error);
      }
      
      setIsLoading(false);
    };

    fetchModuleInfo();
  }, [user, moduleKey, defaultName, defaultDescription]);

  return { moduleName, moduleDescription, isLoading };
}
