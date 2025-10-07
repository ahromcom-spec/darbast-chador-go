import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LogOut, Wrench, Building2, Shield, Phone, ChevronDown, Smartphone, MessageSquare, Briefcase } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAutoAssignProjects } from '@/hooks/useAutoAssignProjects';


export default function Home() {
  const [selectedService, setSelectedService] = useState<string>('');
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auto-assign projects to contractors
  useAutoAssignProjects();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'خروج موفق',
        description: 'با موفقیت از سامانه خارج شدید',
      });
      navigate('/auth/login');
    } catch (error) {
      toast({
        title: 'خطا در خروج',
        description: 'مشکلی در خروج از سامانه پیش آمد',
        variant: 'destructive',
      });
    }
  };

  const handleScaffoldingSelect = () => {
    // Check if user is logged in
    if (!user) {
      toast({
        title: 'نیاز به ورود',
        description: 'برای ثبت درخواست خدمات، لطفاً وارد حساب کاربری خود شوید',
        variant: 'default',
      });
      // Redirect to login with return path
      navigate('/auth/login', { state: { from: '/scaffolding/form' } });
      return;
    }
    navigate('/scaffolding/form');
  };

  const handleTarpaulinSelect = () => {
    toast({
      title: 'به زودی',
      description: 'خدمات چادر برزنتی به زودی اضافه خواهد شد',
    });
  };

  // Reset selected service when component mounts
  useEffect(() => {
    setSelectedService('');
    // Clear any stored service selection
    sessionStorage.removeItem('selected-service');
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative bg-background">
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0 md:block"
        style={{
          backgroundImage: 'url(/background-city.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      {/* Overlay for better text readability */}
      <div className="fixed inset-0 bg-black/40 z-0" />
      
      {/* User Welcome Bar - Only show if logged in */}
      {user && (
        <div className="bg-card/95 backdrop-blur-md border-b relative z-10 shadow-sm fade-in">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
              <Button
                variant="ghost"
                onClick={() => navigate('/profile')}
                className="text-right p-2 hover:bg-primary/10 rounded-lg smooth-hover"
              >
                <div>
                  <p className="text-xs sm:text-sm font-medium">خوش آمدید</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {profile?.full_name || user?.email || 'کاربر'}
                  </p>
                </div>
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/admin')}
                  className="gap-1.5 sm:gap-2 text-xs sm:text-sm smooth-hover"
                >
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">پنل مدیریت</span>
                  <span className="sm:hidden">مدیریت</span>
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/projects')}
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm smooth-hover"
              >
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">کارتابل پروژه‌ها</span>
                <span className="md:hidden">پروژه‌ها</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/contractor/dashboard')}
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm smooth-hover"
              >
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">کارتابل پیمانکار</span>
                <span className="md:hidden">پیمانکار</span>
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="gap-2 hidden md:flex"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          </div>
        </div>
      )}

      {/* Login/Register buttons - Only show if NOT logged in */}
      {!user && (
        <div className="bg-card/95 backdrop-blur-md border-b relative z-10 shadow-sm fade-in">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-end gap-2 sm:gap-3">

            {/* Tickets Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/tickets")}
              className="gap-1.5 sm:gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary text-xs sm:text-sm smooth-hover"
            >
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">تیکت‌های پشتیبانی</span>
              <span className="sm:hidden">تیکت</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/auth/register')}
              className="text-xs sm:text-sm smooth-hover"
            >
              ثبت نام
            </Button>
            <Button 
              size="sm" 
              onClick={() => navigate('/auth/login')}
              className="construction-gradient text-xs sm:text-sm"
            >
              ورود
            </Button>
          </div>
        </div>
      )}

      {/* Main Content - Only service selection card */}
      <main className="flex-1 flex items-start md:items-center justify-center py-4 sm:py-6 md:py-8 px-4 sm:px-6 relative z-10">
        <div className="w-full max-w-2xl mt-2 sm:mt-4 md:mt-0">
          {/* Service Selection Card */}
          <Card className="shadow-xl md:shadow-2xl persian-slide bg-card/95 backdrop-blur-md border-2 smooth-hover">
            <CardHeader className="text-center pb-3 sm:pb-4 md:pb-6 px-4 sm:px-6">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight primary-gradient bg-clip-text text-transparent mb-2">
                انتخاب خدمات
              </h1>
              <CardDescription className="text-sm sm:text-base md:text-lg">
                خدمات مورد نظر خود را انتخاب کنید
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
              <div className="space-y-2.5 sm:space-y-3 slide-up">
                <label className="text-xs sm:text-sm font-medium text-foreground block">نوع خدمات:</label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-full text-right h-11 sm:h-12 text-sm sm:text-base smooth-hover" aria-label="انتخاب نوع خدمات">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-2 z-[100]">
                    <SelectItem value="scaffolding" className="text-sm sm:text-base">خدمات داربست فلزی</SelectItem>
                    <SelectItem value="tarpaulin" className="text-sm sm:text-base">خدمات چادر برزنتی</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scaffolding Options */}
              {selectedService === 'scaffolding' && (
                <div className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20 scale-in">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-primary text-sm sm:text-base">خدمات داربست فلزی انتخاب شد</h3>
                  </div>
                  <Button
                    onClick={handleScaffoldingSelect}
                    className="w-full h-auto p-3 sm:p-4 md:p-5 construction-gradient text-sm sm:text-base"
                  >
                    <div className="space-y-0.5 sm:space-y-1">
                      <div className="font-semibold">ادامه به فرم درخواست</div>
                      <div className="text-xs sm:text-sm opacity-90">برای ثبت درخواست داربست کلیک کنید</div>
                    </div>
                  </Button>
                </div>
              )}

              {/* Tarpaulin Options */}
              {selectedService === 'tarpaulin' && (
                <div className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20 scale-in">
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    <Badge variant="secondary" className="bg-gold/20 text-gold-light border-gold/30 text-xs">
                      به زودی
                    </Badge>
                    <h3 className="font-semibold text-muted-foreground text-sm sm:text-base">خدمات چادر برزنتی</h3>
                  </div>
                  <Button
                    onClick={handleTarpaulinSelect}
                    disabled
                    variant="outline"
                    className="w-full opacity-60 h-11 sm:h-12 text-sm sm:text-base"
                  >
                    این خدمات به زودی اضافه خواهد شد
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}