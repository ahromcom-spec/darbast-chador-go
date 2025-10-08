import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Wrench, Building2, Smartphone, Download, Sparkles, MessageSquare, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAutoAssignProjects } from '@/hooks/useAutoAssignProjects';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigation } from '@/hooks/useNavigation';
import { QuickActionCard } from '@/components/common/QuickActionCard';
import { ResponsiveGrid } from '@/components/common/ResponsiveGrid';

export default function Home() {
  usePageTitle('صفحه اصلی');
  const [selectedService, setSelectedService] = useState<string>('');
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { toast } = useToast();
  const { goToScaffoldingForm, goToLogin, goToRegister, goToTickets, navigate } = useNavigation();

  // Auto-assign projects to contractors
  useAutoAssignProjects();

  const handleScaffoldingSelect = () => {
    goToScaffoldingForm();
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
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({
        title: 'نصب موفق',
        description: 'اپلیکیشن با موفقیت نصب شد و به صفحه اصلی گوشی شما اضافه گردید.'
      });
      setShowInstallCard(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>خدمات داربست فلزی اهرم - داربست فلزی در قم و سراسر ایران</h1>
        <p>
          شرکت خدمات ساختمانی اهرم ارائه دهنده خدمات تخصصی داربست فلزی، داربست ساختمانی، نصب و اجرای داربست در قم و تمام نقاط ایران.
        </p>
        <h2>خدمات داربست فلزی</h2>
        <p>نصب داربست فلزی برای پروژه‌های ساختمانی، بازسازی و نماسازی</p>
        <h2>چادر برزنتی ساختمانی</h2>
        <p>خدمات چادر برزنتی برای محافظت از ساختمان در حین اجرا</p>
      </div>

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
          role="presentation" 
          aria-hidden="true" 
        />
        <div className="fixed inset-0 bg-black/40 z-0" aria-hidden="true" />

        {/* Main Content */}
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
                  <label htmlFor="service-select" className="text-xs sm:text-sm font-medium text-foreground block">
                    انتخاب نوع خدمات:
                  </label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger id="service-select" className="w-full text-right h-11 sm:h-12 text-sm sm:text-base smooth-hover">
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
                {selectedService === 'scaffolding' && (
                  <section className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20 scale-in">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                      <h3 className="font-semibold text-primary text-sm sm:text-base">
                        خدمات داربست فلزی حرفه‌ای - نصب و اجرا در قم و سراسر ایران
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      دریافت خدمات داربست فلزی با بالاترین کیفیت، تیم متخصص و قیمت مناسب
                    </p>
                    <Button 
                      onClick={handleScaffoldingSelect} 
                      className="w-full h-auto p-3 sm:p-4 md:p-5 construction-gradient text-sm sm:text-base"
                    >
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="font-semibold">ثبت درخواست داربست فلزی</div>
                        <div className="text-xs sm:text-sm opacity-90">
                          برای دریافت خدمات داربست ساختمانی کلیک کنید
                        </div>
                      </div>
                    </Button>
                  </section>
                )}

                {/* Tarpaulin Options */}
                {selectedService === 'tarpaulin' && (
                  <section className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20 scale-in">
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                      <Badge variant="secondary" className="bg-gold/20 text-gold-light border-gold/30 text-xs">
                        به زودی
                      </Badge>
                      <h3 className="font-semibold text-muted-foreground text-sm sm:text-base">
                        خدمات چادر برزنتی ساختمانی
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      خدمات چادر برزنتی برای محافظت از ساختمان شما به زودی در دسترس خواهد بود
                    </p>
                    <Button 
                      onClick={handleTarpaulinSelect} 
                      disabled 
                      variant="outline" 
                      className="w-full opacity-60 h-11 sm:h-12 text-sm sm:text-base"
                    >
                      این خدمات به زودی اضافه خواهد شد
                    </Button>
                  </section>
                )}

                {/* No Quick Access Buttons - moved to user profile */}
              </CardContent>
            </Card>
          </article>
        </main>
        
        {/* PWA Install Card - Always visible */}
        <div className="relative z-10 container mx-auto px-4 sm:px-6 pb-4">
          <Card className="max-w-2xl mx-auto shadow-xl border-2 border-primary/20 bg-card/90 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">نصب اپلیکیشن اهرم</h3>
                    <p className="text-xs text-muted-foreground">دسترسی سریع‌تر به خدمات</p>
                  </div>
                </div>
                <Button 
                  onClick={handleInstallApp} 
                  size="sm"
                  className="construction-gradient"
                >
                  <Download className="h-4 w-4 ml-1" />
                  نصب
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="relative z-10 border-t bg-card/80 backdrop-blur-md py-4 px-4">
          <div className="container mx-auto text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              © {new Date().getFullYear()} اهرم - تمامی حقوق محفوظ است
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
