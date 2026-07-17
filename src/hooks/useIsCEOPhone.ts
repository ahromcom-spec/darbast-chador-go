import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const CEO_BACKUP_PHONE = '09125511494';

/**
 * Returns true only if the currently logged-in user's profile phone_number
 * matches the CEO phone allowed to use the backup feature.
 */
export const useIsCEOPhone = () => {
  const { user } = useAuth();
  const [isCEO, setIsCEO] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) {
        if (active) {
          setIsCEO(false);
          setLoading(false);
        }
        return;
      }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('user_id', user.id)
          .maybeSingle();
        const phone = (data?.phone_number || '').toString().trim();
        if (active) setIsCEO(phone === CEO_BACKUP_PHONE);
      } catch {
        if (active) setIsCEO(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    check();
    return () => {
      active = false;
    };
  }, [user]);

  return { isCEO, loading };
};
