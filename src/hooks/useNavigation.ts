import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useNavigation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const navigateWithAuth = (path: string, requireAuth: boolean = true) => {
    if (requireAuth && !user) {
      toast({
        title: 'نیاز به ورود',
        description: 'برای دسترسی به این بخش، لطفاً وارد حساب کاربری خود شوید',
        variant: 'default'
      });
      navigate('/auth/login', {
        state: { from: path }
      });
      return;
    }
    navigate(path);
  };

  const goToHome = () => navigate('/');
  const goToProfile = () => navigateWithAuth('/profile');
  const goToProjects = () => navigateWithAuth('/projects');
  const goToTickets = () => navigate('/tickets'); // tickets don't require auth
  const goToScaffoldingForm = () => navigateWithAuth('/scaffolding/form');
  const goToContractorDashboard = () => navigateWithAuth('/contractor/dashboard');
  const goToAdminDashboard = () => navigateWithAuth('/admin');
  const goToLogin = () => navigate('/auth/login');
  const goToRegister = () => navigate('/auth/register');

  return {
    navigateWithAuth,
    goToHome,
    goToProfile,
    goToProjects,
    goToTickets,
    goToScaffoldingForm,
    goToContractorDashboard,
    goToAdminDashboard,
    goToLogin,
    goToRegister,
  };
}
