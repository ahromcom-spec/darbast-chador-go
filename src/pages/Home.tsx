import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LogOut, Wrench, Building2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';


export default function Home() {
  const [selectedService, setSelectedService] = useState<string>('');
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const handleScaffoldingTypeSelect = (type: 'with-materials' | 'without-materials') => {
    // Check if user is logged in
    if (!user) {
      toast({
        title: 'نیاز به ورود',
        description: 'برای ثبت درخواست خدمات، لطفاً وارد حساب کاربری خود شوید',
        variant: 'default',
      });
      // Redirect to login with return path
      navigate('/auth/login', { state: { from: `/scaffolding/form?type=${type}` } });
      return;
    }
    navigate(`/scaffolding/form?type=${type}`);
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
    <div className="bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* User Welcome Bar - Only show if logged in */}
      {user && (
        <div className="bg-card/50 border-b">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">خوش آمدید</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
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
        <div className="bg-card/50 border-b">
          <div className="container mx-auto px-4 py-3 flex items-center justify-end gap-3">
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Combined Service Selection Card */}
          <Card className="shadow-elegant persian-slide">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-3xl font-bold primary-gradient bg-clip-text text-transparent">
                انتخاب خدمات
              </CardTitle>
              <CardDescription className="text-lg">
                خدمات مورد نظر خود را انتخاب کنید
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">نوع خدمات:</label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-full text-right">
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
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
                    <h3 className="font-semibold text-primary">انواع خدمات داربست فلزی</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => handleScaffoldingTypeSelect('with-materials')}
                      className="h-auto p-4 construction-gradient hover:opacity-90 text-right justify-start"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">داربست به همراه اجناس</div>
                        <div className="text-xs opacity-90">شامل تمام مواد و ابزار</div>
                      </div>
                    </Button>
                    <Button
                      onClick={() => handleScaffoldingTypeSelect('without-materials')}
                      variant="outline"
                      className="h-auto p-4 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground text-right justify-start"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">داربست بدون اجناس</div>
                        <div className="text-xs opacity-75">فقط نصب و راه‌اندازی</div>
                      </div>
                    </Button>
                  </div>
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