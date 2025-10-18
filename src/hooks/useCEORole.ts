import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useCEORole = () => {
  const { user } = useAuth();
  const [isCEO, setIsCEO] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCEORole = async () => {
      if (!user) {
        setIsCEO(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'ceo')
          .maybeSingle();

        if (error) {
          console.error('Error checking CEO role:', error);
          setIsCEO(false);
        } else {
          setIsCEO(!!data);
        }
      } catch (error) {
        console.error('Error checking CEO role:', error);
        setIsCEO(false);
      } finally {
        setLoading(false);
      }
    };

    checkCEORole();
  }, [user]);

  return { isCEO, loading };
};
