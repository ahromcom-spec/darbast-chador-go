import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LogOut, Wrench, Building2, Shield, Phone, ChevronDown, Smartphone, MessageSquare, Briefcase, Download, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAutoAssignProjects } from '@/hooks/useAutoAssignProjects';
export default function Home() {
  const [selectedService, setSelectedService] = useState<string>('');
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const {
    user,
    signOut
  } = useAuth();
  const {
    isAdmin
  } = useAdminRole();
  const {
    profile
  } = useUserProfile();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Auto-assign projects to contractors
  useAutoAssignProjects();
  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'خروج موفق',
        description: 'با موفقیت از سامانه خارج شدید'
      });
      navigate('/auth/login');
    } catch (error) {
      toast({
        title: 'خطا در خروج',
        description: 'مشکلی در خروج از سامانه پیش آمد',
        variant: 'destructive'
      });
    }
  };
  const handleScaffoldingSelect = () => {
    // Check if user is logged in
    if (!user) {
      toast({
        title: 'نیاز به ورود',
        description: 'برای ثبت درخواست خدمات، لطفاً وارد حساب کاربری خود شوید',
        variant: 'default'
      });
      // Redirect to login with return path
      navigate('/auth/login', {
        state: {
          from: '/scaffolding/form'
        }
      });
      return;
    }
    navigate('/scaffolding/form');
  };
  const handleTarpaulinSelect = () => {
    toast({
      title: 'به زودی',
      description: 'خدمات چادر برزنتی به زودی اضافه خواهد شد'
    });
  };

  // Reset selected service when component mounts
  useEffect(() => {
    setSelectedService('');
    // Clear any stored service selection
    sessionStorage.removeItem('selected-service');
  }, []);

  // Handle PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallCard(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);
  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      toast({
        title: 'راهنمای نصب',
        description: 'برای نصب اپلیکیشن، از منوی مرورگر خود گزینه "نصب" یا "Add to Home Screen" را انتخاب کنید.'
      });
      return;
    }
    deferredPrompt.prompt();
    const {
      outcome
    } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({
        title: 'نصب موفق',
        description: 'اپلیکیشن با موفقیت نصب شد و به صفحه اصلی گوشی شما اضافه گردید.'
      });
      setShowInstallCard(false);
    }
    setDeferredPrompt(null);
  };
  return <>
      {/* SEO Hidden Content for Search Engines */}
      <div className="sr-only">
        <h1>خدمات داربست فلزی اهرم - داربست فلزی در قم و سراسر ایران</h1>
        <p>
          شرکت خدمات ساختمانی اهرم ارائه دهنده خدمات تخصصی داربست فلزی، داربست ساختمانی، نصب و اجرای داربست در قم و تمام نقاط ایران. 
          با سیستم هوشمند سفارش‌گیری و تیم متخصص، بهترین کیفیت خدمات داربست را با قیمت مناسب دریافت کنید.
        </p>
        <h2>خدمات داربست فلزی</h2>
        <p>نصب داربست فلزی برای پروژه‌های ساختمانی، بازسازی و نماسازی</p>
        <h2>چادر برزنتی ساختمانی</h2>
        <p>خدمات چادر برزنتی برای محافظت از ساختمان در حین اجرا</p>
        <h2>مناطق تحت پوشش</h2>
        <p>قم، تهران، اصفهان، مشهد، شیراز، تبریز و سایر شهرهای ایران</p>
      </div>

      <div className="min-h-screen flex flex-col relative bg-background">
        {/* Background Image */}
        <div className="fixed inset-0 z-0 md:block" style={{
        backgroundImage: 'url(/background-city.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }} role="presentation" aria-hidden="true" />
        {/* Overlay for better text readability */}
        <div className="fixed inset-0 bg-black/40 z-0" aria-hidden="true" />
      
      {/* User Welcome Bar - Only show if logged in */}
      {user && <div className="bg-card/95 backdrop-blur-md border-b relative z-10 shadow-sm fade-in">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
              <Button variant="ghost" onClick={() => navigate('/profile')} className="text-right p-2 hover:bg-primary/10 rounded-lg smooth-hover">
                <div>
                  <p className="text-xs sm:text-sm font-medium">خوش آمدید</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {profile?.full_name || user?.email || 'کاربر'}
                  </p>
                </div>
              </Button>
              {isAdmin && <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="gap-1.5 sm:gap-2 text-xs sm:text-sm smooth-hover">
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">پنل مدیریت</span>
                  <span className="sm:hidden">مدیریت</span>
                </Button>}
              <Button variant="outline" size="sm" onClick={() => navigate('/projects')} className="gap-1.5 sm:gap-2 text-xs sm:text-sm smooth-hover">
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">کارتابل پروژه‌ها</span>
                <span className="md:hidden">پروژه‌ها</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/contractor/dashboard')} className="gap-1.5 sm:gap-2 text-xs sm:text-sm smooth-hover">
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">کارتابل پیمانکار</span>
                <span className="md:hidden">پیمانکار</span>
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2 hidden md:flex">
              <LogOut className="h-4 w-4" />
              خروج
            </Button>
          </div>
        </div>}

      {/* Login/Register buttons - Only show if NOT logged in */}
      {!user && <div className="bg-card/95 backdrop-blur-md border-b relative z-10 shadow-sm fade-in">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 space-y-2">
            {/* First Row - Login/Register buttons */}
            <div className="flex items-center justify-end gap-2 sm:gap-3">
              {/* Tickets Button */}
              <Button variant="outline" size="sm" onClick={() => navigate("/tickets")} className="gap-1.5 sm:gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary text-xs sm:text-sm smooth-hover">
                <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">تیکت‌های پشتیبانی</span>
                <span className="sm:hidden">تیکت</span>
              </Button>
              
              <Button variant="outline" size="sm" onClick={() => navigate('/auth/register')} className="text-xs sm:text-sm smooth-hover">
                ثبت نام
              </Button>
              <Button size="sm" onClick={() => navigate('/auth/login')} className="construction-gradient text-xs sm:text-sm">
                ورود
              </Button>
            </div>

            {/* Second Row - Contractor Registration */}
            <div className="flex items-center justify-center">
              <Button variant="outline" size="sm" onClick={() => navigate('/contractor/register')} className="gap-1.5 sm:gap-2 border-gold/30 hover:border-gold bg-gold/5 hover:bg-gold/10 text-gold-light text-xs sm:text-sm smooth-hover">
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>ثبت نام پیمانکاران</span>
              </Button>
            </div>
          </div>
        </div>}

        {/* Main Content - Only service selection card */}
        <main className="flex-1 flex items-start md:items-center justify-center py-4 sm:py-6 md:py-8 px-4 sm:px-6 relative z-10" role="main">
          <article className="w-full max-w-2xl mt-2 sm:mt-4 md:mt-0">
            {/* Service Selection Card */}
            <Card className="shadow-xl md:shadow-2xl persian-slide bg-card/95 backdrop-blur-md border-2 smooth-hover">
              <CardHeader className="text-center pb-3 sm:pb-4 md:pb-6 px-4 sm:px-6">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight primary-gradient bg-clip-text text-transparent mb-2">
                  خدمات ساختمانی خود را انتخاب کنید
                </h2>
                <CardDescription className="text-sm sm:text-base md:text-lg">
                  خدمات داربست و ساختمانی در قم و سراسر ایران
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
                <div className="space-y-2.5 sm:space-y-3 slide-up">
                  <label htmlFor="service-select" className="text-xs sm:text-sm font-medium text-foreground block">انتخاب نوع خدمات:</label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger id="service-select" className="w-full text-right h-11 sm:h-12 text-sm sm:text-base smooth-hover" aria-label="انتخاب نوع خدمات داربست فلزی یا چادر برزنتی">
                      <SelectValue placeholder="لطفاً نوع خدمات مورد نظر خود را انتخاب کنید..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-2 z-[100]">
                      <SelectItem value="scaffolding" className="text-sm sm:text-base">
                        خدمات داربست فلزی
                      </SelectItem>
                      <SelectItem value="tarpaulin" className="text-sm sm:text-base">
                        خدمات چادر برزنتی
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Scaffolding Options */}
                {selectedService === 'scaffolding' && <section className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20 scale-in" aria-labelledby="scaffolding-heading">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" aria-hidden="true" />
                      <h3 id="scaffolding-heading" className="font-semibold text-primary text-sm sm:text-base">
                        خدمات داربست فلزی حرفه‌ای - نصب و اجرا در قم و سراسر ایران
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      دریافت خدمات داربست فلزی با بالاترین کیفیت، تیم متخصص و قیمت مناسب
                    </p>
                    <Button onClick={handleScaffoldingSelect} className="w-full h-auto p-3 sm:p-4 md:p-5 construction-gradient text-sm sm:text-base" aria-label="ثبت درخواست خدمات داربست فلزی">
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="font-semibold">ثبت درخواست داربست فلزی</div>
                        <div className="text-xs sm:text-sm opacity-90">
                          برای دریافت خدمات داربست ساختمانی کلیک کنید
                        </div>
                      </div>
                    </Button>
                  </section>}

                {/* Tarpaulin Options */}
                {selectedService === 'tarpaulin' && <section className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20 scale-in" aria-labelledby="tarpaulin-heading">
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                      <Badge variant="secondary" className="bg-gold/20 text-gold-light border-gold/30 text-xs">
                        به زودی
                      </Badge>
                      <h3 id="tarpaulin-heading" className="font-semibold text-muted-foreground text-sm sm:text-base">
                        خدمات چادر برزنتی ساختمانی
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      خدمات چادر برزنتی برای محافظت از ساختمان شما به زودی در دسترس خواهد بود
                    </p>
                    <Button onClick={handleTarpaulinSelect} disabled variant="outline" className="w-full opacity-60 h-11 sm:h-12 text-sm sm:text-base" aria-label="خدمات چادر برزنتی به زودی">
                      این خدمات به زودی اضافه خواهد شد
                    </Button>
                  </section>}
              </CardContent>
            </Card>
          </article>
        </main>
        
        {/* PWA Install Card */}
        {showInstallCard && <div className="relative z-10 container mx-auto px-4 sm:px-6 pb-6">
            <Card className="max-w-2xl mx-auto shadow-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card/95 to-secondary/20 backdrop-blur-md fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/20 construction-pulse">
                      <Smartphone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                        نصب اپلیکیشن
                        <Sparkles className="h-4 w-4 text-gold-light animate-pulse" />
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        دسترسی سریع‌تر و راحت‌تر به خدمات
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    با نصب اپلیکیشن اهرم روی گوشی خود:
                  </p>
                  <ul className="text-xs sm:text-sm space-y-1.5 mr-4">
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      دسترسی آسان و سریع از صفحه اصلی گوشی
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      تجربه کاربری بهتر و روان‌تر
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      دریافت اعلان‌های مهم پروژه‌ها
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      استفاده آفلاین از برخی امکانات
                    </li>
                  </ul>
                </div>
                <div className="flex gap-2 sm:gap-3 pt-2">
                  <Button onClick={handleInstallApp} className="flex-1 construction-gradient hover:opacity-90 gap-2 h-11 sm:h-12 text-sm sm:text-base smooth-hover">
                    <Download className="h-4 w-4" />
                    نصب اپلیکیشن
                  </Button>
                  <Button variant="outline" onClick={() => setShowInstallCard(false)} className="text-xs sm:text-sm">
                    بعداً
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>}
        
        {/* Footer with SEO-rich content */}
        <footer className="relative z-10 bg-card/95 backdrop-blur-md border-t mt-auto" role="contentinfo">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            <p className="mb-2">
              © 2025 خدمات ساختمانی اهرم - ارائه دهنده خدمات داربست فلزی در قم و سراسر ایران
            </p>
            <p className="text-xs">
              کلمات کلیدی: داربست فلزی، خدمات داربست، داربست ساختمانی، نصب داربست، داربست فلزی قم، خدمات ساختمانی اهرم
            </p>
          </div>
        </footer>
      </div>
    </>;
}