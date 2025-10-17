import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useFinanceManagerRole = () => {
  const { user } = useAuth();
  const [isFinanceManager, setIsFinanceManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFinanceManagerRole = async () => {
      if (!user) {
        setIsFinanceManager(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'finance_manager')
          .maybeSingle();

        if (error) {
          console.error('Error checking finance manager role:', error);
          setIsFinanceManager(false);
        } else {
          setIsFinanceManager(!!data);
        }
      } catch (error) {
        console.error('Error checking finance manager role:', error);
        setIsFinanceManager(false);
      } finally {
        setLoading(false);
      }
    };

    checkFinanceManagerRole();
  }, [user]);

  return { isFinanceManager, loading };
};
