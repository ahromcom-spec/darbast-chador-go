import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleAssignmentInfo {
  moduleName: string;
  moduleDescription: string;
  isLoading: boolean;
}

/**
 * Hook to get the assigned module's custom name and description for the current user.
 * Falls back to default values if no assignment found.
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
    const fetchAssignmentInfo = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Get user's phone number
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .single();

        if (!profile?.phone_number) {
          setIsLoading(false);
          return;
        }

        // Find all active assignments for this user that could match this module
        // For copied modules, we need to check by the page route (module_key starts with 'custom-' but href matches)
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

          // For copied modules (custom-*), find by matching the base module key in the module_name
          // or find any assignment that starts with 'custom-' and has the base module name
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
      } catch (error) {
        console.error('Error fetching module assignment info:', error);
      }
      
      setIsLoading(false);
    };

    fetchAssignmentInfo();
  }, [user, moduleKey, defaultName]);

  return { moduleName, moduleDescription, isLoading };
}
