import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export const AdminImpersonationBanner = () => {
  const [isImpersonating, setIsImpersonating] = useState(false);

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
    try {
      const stored = localStorage.getItem('original_admin_session');
      if (!stored) return;

      const originalSession = JSON.parse(stored);
      
      // Restore original admin session
      const { error } = await supabase.auth.setSession({
        access_token: originalSession.access_token,
        refresh_token: originalSession.refresh_token,
      });

      if (error) {
        console.error('Error restoring admin session:', error);
        toast.error('خطا در بازگشت به حساب مدیر');
        return;
      }

      // Clear the stored session
      localStorage.removeItem('original_admin_session');
      setIsImpersonating(false);
      
      toast.success('بازگشت به حساب مدیر');
      
      // Navigate to admin users page
      window.location.href = '/admin/users';
    } catch (error) {
      console.error('Error in handleExitImpersonation:', error);
      toast.error('خطا در بازگشت به حساب مدیر');
    }
  };

  if (!isImpersonating) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg"
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
            className="bg-white text-red-600 hover:bg-red-50 font-bold transition-all duration-200 hover:scale-105"
          >
            بازگشت به حساب مدیر
          </Button>
        </div>
      </div>
    </div>
  );
};