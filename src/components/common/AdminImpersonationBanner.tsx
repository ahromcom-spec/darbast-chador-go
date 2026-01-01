import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export const AdminImpersonationBanner = () => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if we're in impersonation mode
    const checkImpersonation = () => {
      const stored = localStorage.getItem('original_admin_session');
      setIsImpersonating(!!stored);
    };

    // Check on mount
    checkImpersonation();

    // Check on storage changes (for cross-tab sync)
    window.addEventListener('storage', checkImpersonation);

    return () => {
      window.removeEventListener('storage', checkImpersonation);
    };
  }, []);

  const handleExitImpersonation = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const stored = localStorage.getItem('original_admin_session');
      if (!stored) {
        setIsLoading(false);
        return;
      }

      const originalSession = JSON.parse(stored);
      
      // First, sign out from current (impersonated) session
      await supabase.auth.signOut();
      
      // Small delay to ensure signout completes
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Try to restore original admin session
      const { data, error } = await supabase.auth.setSession({
        access_token: originalSession.access_token,
        refresh_token: originalSession.refresh_token,
      });

      if (error) {
        console.error('Error restoring admin session:', error);
        
        // If session restoration fails, try to refresh using refresh token
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: originalSession.refresh_token,
        });
        
        if (refreshError) {
          console.error('Error refreshing admin session:', refreshError);
          // Clear invalid session data
          localStorage.removeItem('original_admin_session');
          setIsImpersonating(false);
          toast.error('نشست مدیر منقضی شده است. لطفاً دوباره وارد شوید.');
          window.location.href = '/auth/login';
          return;
        }
        
        if (refreshData?.session) {
          // Successfully refreshed, now set the session
          await supabase.auth.setSession({
            access_token: refreshData.session.access_token,
            refresh_token: refreshData.session.refresh_token,
          });
        }
      }

      // Clear the stored session
      localStorage.removeItem('original_admin_session');
      setIsImpersonating(false);
      
      toast.success('بازگشت به حساب مدیر با موفقیت انجام شد');
      
      // Navigate to admin users page with full reload
      window.location.href = '/admin/users';
    } catch (error) {
      console.error('Error in handleExitImpersonation:', error);
      // Clear invalid session data on any error
      localStorage.removeItem('original_admin_session');
      setIsImpersonating(false);
      toast.error('خطا در بازگشت به حساب مدیر. لطفاً دوباره وارد شوید.');
      window.location.href = '/auth/login';
    } finally {
      setIsLoading(false);
    }
  };

  if (!isImpersonating) return null;

  return (
    <div 
      className="sticky top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <span className="font-bold text-sm sm:text-base">
            🔒 شما در حال مشاهده حساب کاربر هستید
          </span>
          <Button
            onClick={handleExitImpersonation}
            size="sm"
            disabled={isLoading}
            className="bg-white text-red-600 hover:bg-red-50 font-bold transition-all duration-200 hover:scale-105 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                در حال بازگشت...
              </>
            ) : (
              'بازگشت به حساب مدیر'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};