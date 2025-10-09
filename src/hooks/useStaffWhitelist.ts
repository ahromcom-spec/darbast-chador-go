import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WhitelistCheck {
  is_whitelisted: boolean;
  allowed_role: string | null;
}

export const useStaffWhitelist = () => {
  const { user } = useAuth();
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [allowedRole, setAllowedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkWhitelist();
  }, [user]);

  const checkWhitelist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // دریافت شماره تلفن کاربر از profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setIsWhitelisted(false);
        setLoading(false);
        return;
      }

      if (!profile?.phone_number) {
        console.log('No phone number found for user');
        setIsWhitelisted(false);
        setLoading(false);
        return;
      }

      console.log('Checking whitelist for phone:', profile.phone_number);

      // بررسی وجود در whitelist
      const { data, error } = await supabase
        .rpc('check_staff_whitelist', { _phone: profile.phone_number });

      if (error) {
        console.error('Error checking whitelist:', error);
        setIsWhitelisted(false);
      } else if (data && data.length > 0) {
        const result = data[0] as WhitelistCheck;
        console.log('Whitelist result:', result);
        setIsWhitelisted(result.is_whitelisted);
        setAllowedRole(result.allowed_role);
      } else {
        console.log('Not whitelisted');
        setIsWhitelisted(false);
        setAllowedRole(null);
      }
    } catch (error) {
      console.error('Error in checkWhitelist:', error);
      setIsWhitelisted(false);
    } finally {
      setLoading(false);
    }
  };

  return { isWhitelisted, allowedRole, loading };
};
