import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useSalesManagerRole = () => {
  const { user } = useAuth();
  const [isSalesManager, setIsSalesManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSalesManagerRole = async () => {
      if (!user) {
        setIsSalesManager(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'sales_manager')
          .maybeSingle();

        if (error) {
          console.error('Error checking sales manager role:', error);
          setIsSalesManager(false);
        } else {
          setIsSalesManager(!!data);
        }
      } catch (error) {
        console.error('Error checking sales manager role:', error);
        setIsSalesManager(false);
      } finally {
        setLoading(false);
      }
    };

    checkSalesManagerRole();
  }, [user]);

  return { isSalesManager, loading };
};
