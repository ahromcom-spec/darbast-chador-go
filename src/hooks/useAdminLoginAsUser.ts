import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAdminLoginAsUser = () => {
  const [isLoading, setIsLoading] = useState(false);

  const loginAsUser = async (targetUserId: string) => {
    setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('لطفاً ابتدا وارد سیستم شوید');
        return;
      }

      // Store original admin session in localStorage
      const originalAdminSession = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user_id: session.user.id,
      };
      localStorage.setItem('original_admin_session', JSON.stringify(originalAdminSession));

      const { data, error } = await supabase.functions.invoke('admin-login-as-user', {
        body: { target_user_id: targetUserId },
      });

      if (error) {
        console.error('Error logging in as user:', error);
        toast.error(error.message || 'خطا در ورود به حساب کاربر');
        localStorage.removeItem('original_admin_session');
        return;
      }

      if (data?.session) {
        // Set the new session
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (setSessionError) {
          console.error('Error setting session:', setSessionError);
          toast.error('خطا در تنظیم session');
          localStorage.removeItem('original_admin_session');
          return;
        }

        toast.success('با موفقیت وارد حساب کاربر شدید');

        // Reload the page to apply new session and show persistent banner
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      }
    } catch (error) {
      console.error('Error in loginAsUser:', error);
      toast.error('خطا در ورود به حساب کاربر');
      localStorage.removeItem('original_admin_session');
    } finally {
      setIsLoading(false);
    }
  };

  return { loginAsUser, isLoading };
};
