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
        
        // Show a banner to indicate admin mode
        const banner = document.createElement('div');
        banner.id = 'admin-impersonation-banner';
        banner.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
          color: white;
          padding: 12px;
          text-align: center;
          z-index: 9999;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        banner.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
            <span>🔒 شما در حال مشاهده حساب کاربر هستید</span>
            <button id="exit-admin-mode" style="
              background: white;
              color: #dc2626;
              border: none;
              padding: 6px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              transition: all 0.2s;
            ">
              بازگشت به حساب مدیر
            </button>
          </div>
        `;
        document.body.prepend(banner);

        // Add click handler for exit button
        document.getElementById('exit-admin-mode')?.addEventListener('click', async () => {
          const stored = localStorage.getItem('original_admin_session');
          if (stored) {
            const originalSession = JSON.parse(stored);
            await supabase.auth.setSession({
              access_token: originalSession.access_token,
              refresh_token: originalSession.refresh_token,
            });
            localStorage.removeItem('original_admin_session');
            banner.remove();
            toast.success('بازگشت به حساب مدیر');
            window.location.href = '/admin/users';
          }
        });

        // Reload the page to apply new session
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
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
