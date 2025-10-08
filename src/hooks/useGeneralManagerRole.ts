import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useGeneralManagerRole = () => {
  const { user } = useAuth();
  const [isGeneralManager, setIsGeneralManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkGeneralManagerRole = async () => {
      if (!user) {
        setIsGeneralManager(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'general_manager')
          .maybeSingle();

        if (error) {
          console.error('Error checking general manager role:', error);
          setIsGeneralManager(false);
        } else {
          setIsGeneralManager(!!data);
        }
      } catch (error) {
        console.error('Error checking general manager role:', error);
        setIsGeneralManager(false);
      } finally {
        setLoading(false);
      }
    };

    checkGeneralManagerRole();
  }, [user]);

  return { isGeneralManager, loading };
};
