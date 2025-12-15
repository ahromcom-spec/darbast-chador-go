import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useExecutiveManagerRole = () => {
  const { user } = useAuth();
  const [isExecutiveManager, setIsExecutiveManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkExecutiveManagerRole = async () => {
      if (!user) {
        setIsExecutiveManager(false);
        setLoading(false);
        return;
      }

      try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', [
          'scaffold_executive_manager',
          'executive_manager_scaffold_execution_with_materials',
          'rental_executive_manager',
        ])
        .maybeSingle();

        if (error) {
          console.error('Error checking executive manager role:', error);
          setIsExecutiveManager(false);
        } else {
          setIsExecutiveManager(!!data);
        }
      } catch (error) {
        console.error('Error checking executive manager role:', error);
        setIsExecutiveManager(false);
      } finally {
        setLoading(false);
      }
    };

    checkExecutiveManagerRole();
  }, [user]);

  return { isExecutiveManager, loading };
};
