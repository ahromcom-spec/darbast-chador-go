import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/**
 * صفحه تونل - نقطه ورود برای حالت نمایندگی (Impersonation)
 * وقتی مدیرعامل وارد حساب کاربر می‌شود، به این صفحه هدایت می‌شود
 */
const TunnelPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // اگر در حالت نمایندگی هستیم، به پروفایل هدایت کن
    const isImpersonating = localStorage.getItem('original_admin_session');
    
    if (!loading) {
      if (isImpersonating && user) {
        // هدایت به صفحه پروفایل کاربر
        navigate('/profile', { replace: true });
      } else if (!user) {
        // اگر کاربر لاگین نشده، به صفحه ورود هدایت کن
        navigate('/auth/login', { replace: true });
      } else {
        // اگر در حالت نمایندگی نیستیم، به صفحه اصلی هدایت کن
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground">در حال ورود به حساب کاربر...</p>
      </div>
    </div>
  );
};

export default TunnelPage;
