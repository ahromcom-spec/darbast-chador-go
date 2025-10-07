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
    <div 
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: 'url(/background-city.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40 z-0" />
      
      {/* User Welcome Bar - Only show if logged in */}
      {user && (
        <div className="bg-card/90 backdrop-blur-md border-b relative z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/profile')}
                className="text-right p-2 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">خوش آمدید</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.full_name || user?.email || 'کاربر'}
                  </p>
                </div>
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/admin')}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  پنل مدیریت
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/projects')}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" />
                کارتابل پروژه‌ها
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/contractor/dashboard')}
                className="gap-2"
              >
                <Briefcase className="h-4 w-4" />
                کارتابل پیمانکار
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          </div>
        </div>
      )}

      {/* Login/Register buttons - Only show if NOT logged in */}
      {!user && (
        <div className="bg-card/90 backdrop-blur-md border-b relative z-10">
          <div className="container mx-auto px-4 py-3 flex items-center justify-end gap-3">

            {/* Tickets Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/tickets")}
              className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary"
            >
              <MessageSquare className="h-4 w-4" />
              تیکت‌های پشتیبانی
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/auth/register')}
            >
              ثبت نام
            </Button>
            <Button 
              size="sm" 
              onClick={() => navigate('/auth/login')}
              className="construction-gradient"
            >
              ورود
            </Button>
          </div>
        </div>
      )}

      {/* Main Content - Only service selection card */}
      <main className="flex-1 flex items-center justify-center py-8 px-4 relative z-10">
        <div className="w-full max-w-2xl">
          {/* Service Selection Card */}
          <Card className="shadow-2xl persian-slide bg-card/95 backdrop-blur-md border-2">
            <CardHeader className="text-center pb-4">
              <h1 className="text-3xl font-bold leading-none tracking-tight primary-gradient bg-clip-text text-transparent">
                انتخاب خدمات
              </h1>
              <CardDescription className="text-lg">
                خدمات مورد نظر خود را انتخاب کنید
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">نوع خدمات:</label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-full text-right" aria-label="انتخاب نوع خدمات">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-2 z-[100]">
                    <SelectItem value="scaffolding">خدمات داربست فلزی</SelectItem>
                    <SelectItem value="tarpaulin">خدمات چادر برزنتی</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scaffolding Options */}
              {selectedService === 'scaffolding' && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border-2 border-construction/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-primary">خدمات داربست فلزی انتخاب شد</h3>
                  </div>
                  <Button
                    onClick={handleScaffoldingSelect}
                    className="w-full h-auto p-4 construction-gradient hover:opacity-90"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold">ادامه به فرم درخواست</div>
                      <div className="text-xs opacity-90">برای ثبت درخواست داربست کلیک کنید</div>
                    </div>
                  </Button>
                </div>
              )}

              {/* Tarpaulin Options */}
              {selectedService === 'tarpaulin' && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border-2 border-construction/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="bg-gold/20 text-gold-light border-gold/30">
                      به زودی
                    </Badge>
                    <h3 className="font-semibold text-muted-foreground">خدمات چادر برزنتی</h3>
                  </div>
                  <Button
                    onClick={handleTarpaulinSelect}
                    disabled
                    variant="outline"
                    className="w-full opacity-60"
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