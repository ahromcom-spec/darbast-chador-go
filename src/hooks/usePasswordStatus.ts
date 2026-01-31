import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PasswordStatus {
  hasPassword: boolean;
  hasEmail: boolean;
  emailVerified: boolean;
  recoveryEmail: string | null;
  loading: boolean;
}

export function usePasswordStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PasswordStatus>({
    hasPassword: false,
    hasEmail: false,
    emailVerified: false,
    recoveryEmail: null,
    loading: true
  });

  const fetchStatus = async () => {
    if (!user) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_password_hash, recovery_email, recovery_email_verified, phone_number')
        .eq('user_id', user.id)
        .maybeSingle();

      setStatus({
        hasPassword: !!profile?.user_password_hash,
        hasEmail: !!profile?.recovery_email,
        emailVerified: !!profile?.recovery_email_verified,
        recoveryEmail: profile?.recovery_email || null,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching password status:', error);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  return { ...status, refetch: fetchStatus };
}
