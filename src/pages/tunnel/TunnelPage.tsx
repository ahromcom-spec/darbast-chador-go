import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import Home from '@/pages/Home';

/**
 * صفحه تونل - نقطه ورود برای حالت نمایندگی (Impersonation)
 * وقتی مدیرعامل وارد حساب کاربر می‌شود، به این صفحه هدایت می‌شود
 * این صفحه محتوای صفحه اصلی را نمایش می‌دهد ولی آدرس /tunnel باقی می‌ماند
 */
const TunnelPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const isImpersonating = localStorage.getItem('original_admin_session');
    
    if (!loading) {
      if (!isImpersonating) {
        // اگر در حالت نمایندگی نیستیم، به صفحه اصلی هدایت کن
        navigate('/', { replace: true });
      } else if (!user) {
        // اگر کاربر لاگین نشده، به صفحه ورود هدایت کن
        navigate('/auth/login', { replace: true });
      } else {
        // آماده نمایش محتوا
        setIsReady(true);
      }
    }
  }, [user, loading, navigate]);

  if (loading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">در حال ورود به حساب کاربر...</p>
        </div>
      </div>
    );
  }

  // نمایش صفحه اصلی در حالت نمایندگی
  return <Home />;
};

export default TunnelPage;
