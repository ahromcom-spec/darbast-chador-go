import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Building2, Smartphone, Download, Sparkles, MessageSquare, Briefcase, MapPin, Globe } from 'lucide-react';
import { ServiceTypeSelector } from '@/components/common/ServiceTypeSelector';
import { SubcategoryDialog } from '@/components/common/SubcategoryDialog';
import { useToast } from '@/hooks/use-toast';
import { useAutoAssignProjects } from '@/hooks/useAutoAssignProjects';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigation } from '@/hooks/useNavigation';
import usePWAInstall from '@/hooks/usePWAInstall';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { useUserProjects } from '@/hooks/useUserProjects';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { lazy, Suspense } from 'react';

// Lazy load heavy globe component for better performance
const HybridGlobe = lazy(() => import('@/components/globe/HybridGlobe'));
import globeIcon from '@/assets/golden-globe.png';
import { PWAInstallBanner } from '@/components/common/PWAInstallBanner';
import { NotificationBanner } from '@/components/common/NotificationBanner';

const Home = () => {
  usePageTitle('صفحه اصلی');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false);
  const [pendingServiceTypeId, setPendingServiceTypeId] = useState<string>('');
  const [showGlobe, setShowGlobe] = useState(false);
  
  const { canInstall, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const { toast } = useToast();
  const { navigate, navigateWithAuth } = useNavigation();
  const { user } = useAuth();
  const { serviceTypes, loading: servicesLoading } = useServiceTypesWithSubcategories();
  const { projects, loading: projectsLoading } = useUserProjects(
    selectedServiceType || undefined,
    selectedSubcategory || undefined
  );

  // Auto-assign projects to contractors
  useAutoAssignProjects();

  // Reset selections when component mounts
  useEffect(() => {
    setSelectedServiceType('');
    setSelectedSubcategory('');
    setSelectedProject('');
  }, []);

  const handleServiceTypeChange = (value: string) => {
    // Value format: "serviceTypeId" or "serviceTypeId:subcategoryCode"
    const [serviceTypeId, subcategoryCode] = value.split(':');
    
    // اگر فقط نوع خدمات انتخاب شده و زیرشاخه نیست، دیالوگ را باز کن
    if (serviceTypeId && !subcategoryCode) {
      setPendingServiceTypeId(serviceTypeId);
      setShowSubcategoryDialog(true);
      return;
    }
    
    // اگر هر دو انتخاب شده‌اند، مستقیم تنظیم کن
    setSelectedServiceType(serviceTypeId || '');
    setSelectedSubcategory(subcategoryCode || '');
    setSelectedProject('');
  };

  const handleSubcategorySelect = (subcategory: any) => {
    setShowSubcategoryDialog(false);
    setSelectedServiceType(pendingServiceTypeId);
    setSelectedSubcategory(subcategory.code);
    setSelectedProject('');
    setPendingServiceTypeId('');
  };

  // Ensure popovers/menus are closed before navigating to avoid lingering UI
  const safeNavigate = (path: string, state?: any) => {
    // Close any open Radix popovers by sending Escape
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' } as any));
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {}
    // Let closing animation finish
    setTimeout(() => navigate(path, state ? state : undefined), 120);
  };

  // هنگامی که نوع خدمات انتخاب شد، کاربر را به صفحه انتخاب آدرس هدایت کنیم
  useEffect(() => {
    if (selectedServiceType && selectedSubcategory) {
      const serviceType = serviceTypes.find(st => st.id === selectedServiceType);
      const subcategory = serviceType?.subcategories.find(sc => sc.code === selectedSubcategory);
      
      // ذخیره اطلاعات انتخاب شده برای استفاده بعد از لاگین
      const serviceSelection = {
        serviceTypeId: selectedServiceType,
        subcategoryId: subcategory?.id,
        subcategoryCode: selectedSubcategory,
        serviceName: serviceType?.name,
        subcategoryName: subcategory?.name
      };
      
      // اگر کاربر لاگین نیست، ابتدا پیام بده و به صفحه لاگین هدایت کن
      if (!user) {
        toast({
          title: 'نیاز به ورود',
          description: 'لطفا ابتدا وارد حساب خود شوید و بعد ثبت سفارش کنید',
          variant: 'default'
        });
        localStorage.setItem('pendingServiceSelection', JSON.stringify(serviceSelection));
        safeNavigate('/auth/login', { state: { from: '/select-location', serviceSelection } });
        return;
      }
      
      // هدایت به صفحه انتخاب آدرس (برای همه خدمات شامل کرایه اجناس داربست)
      safeNavigate('/select-location', { state: { serviceSelection } });
    }
  }, [selectedServiceType, selectedSubcategory, serviceTypes, user, toast]);

  // پروژه‌های کاربر را نمایش می‌دهیم و اجازه می‌دهیم انتخاب کند
  // دیگر redirect خودکار نداریم تا کاربر بتواند پروژه‌هایش را ببیند

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    // همه خدمات به صفحه افزودن خدمات می‌روند
    navigate(`/user/add-service/${projectId}`);
  };

  const handleCreateNewProject = () => {
    const serviceType = serviceTypes.find(st => st.id === selectedServiceType);
    const subcategory = serviceType?.subcategories.find(sc => sc.code === selectedSubcategory);
    
    // همه خدمات به صفحه ایجاد پروژه می‌روند
    navigate('/user/create-project', {
      state: {
        preSelectedServiceType: selectedServiceType,
        preSelectedServiceCode: selectedSubcategory,
        serviceTypeName: serviceType?.name,
        subcategoryName: subcategory?.name
      }
    });
  };

  const selectedServiceTypeObj = serviceTypes.find(st => st.id === selectedServiceType);
  const pendingServiceTypeObj = serviceTypes.find(st => st.id === pendingServiceTypeId);


  const handleInstallApp = async () => {
    const hasDeferred = (window as any).__deferredPrompt;

    if (canInstall || hasDeferred) {
      const { outcome } = await promptInstall();
      if (outcome === 'accepted') {
        toast({
          title: 'نصب موفق',
          description: 'اپلیکیشن با موفقیت نصب شد و به صفحه اصلی گوشی شما اضافه گردید.'
        });
      } else {
        toast({
          title: 'نصب لغو شد',
          description: 'فرآیند نصب توسط کاربر لغو شد'
        });
      }
      return;
    }

    if (isIOS) {
      toast({
        title: 'نصب روی iOS',
        description: 'در Safari روی دکمه اشتراک‌گذاری بزنید و گزینه "Add to Home Screen" را انتخاب کنید.'
      });
    } else {
      toast({
        title: 'راهنمای نصب',
        description: 'از منوی مرورگر گزینه "Install" یا "Add to Home Screen" را انتخاب کنید.'
      });
    }
  };

  if (showGlobe) {
    return (
      <Suspense fallback={
        <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-lg font-semibold">در حال بارگذاری کره زمین...</p>
          </div>
        </div>
      }>
        <HybridGlobe onClose={() => setShowGlobe(false)} />
      </Suspense>
    );
  }

  return (
    <>
      {/* Subcategory Selection Dialog - فقط در صورتی که داده‌های معتبر وجود داشته باشد نمایش داده شود */}
      {pendingServiceTypeObj && pendingServiceTypeObj.subcategories && pendingServiceTypeObj.subcategories.length > 0 && (
        <SubcategoryDialog
          open={showSubcategoryDialog}
          onOpenChange={setShowSubcategoryDialog}
          serviceName={pendingServiceTypeObj.name}
          subcategories={pendingServiceTypeObj.subcategories}
          onSelect={handleSubcategorySelect}
        />
      )}

      <div data-tour="create-project">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>خدمات داربست فلزی اهرم - داربست فلزی در قم و سراسر ایران</h1>
        <p>
          شرکت خدمات ساختمانی اهرم ارائه دهنده خدمات تخصصی داربست فلزی، داربست ساختمانی، نصب و اجرای داربست در قم و تمام نقاط ایران.
        </p>
        
        {/* All Service Types and Subcategories for SEO */}
        {serviceTypes.map((serviceType) => (
          <section key={serviceType.id}>
            <h2>{serviceType.name} - خدمات {serviceType.name} در قم و سراسر ایران</h2>
            <p>ارائه خدمات تخصصی {serviceType.name} با بهترین کیفیت و قیمت مناسب توسط شرکت اهرم</p>
            
            {serviceType.subcategories.map((subcategory) => (
              <div key={subcategory.id}>
                <h3>{subcategory.name} - {serviceType.name}</h3>
                <p>
                  خدمات {subcategory.name} در زمینه {serviceType.name} | 
                  {subcategory.name} حرفه‌ای در قم و ایران | 
                  قیمت {subcategory.name} | 
                  پیمانکار {subcategory.name} | 
                  اجرای {subcategory.name} استاندارد
                </p>
              </div>
            ))}
          </section>
        ))}

        {/* JSON-LD Structured Data for Service Organization */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "شرکت خدمات ساختمانی اهرم",
            "url": "https://ahrom.org",
            "logo": "https://ahrom.org/assets/ahrom-logo.png",
            "contactPoint": {
              "@type": "ContactPoint",
              "contactType": "Customer Service",
              "areaServed": "IR"
            },
            "address": {
              "@type": "PostalAddress",
              "addressRegion": "قم",
              "addressCountry": "IR"
            }
          })}
        </script>

        {/* JSON-LD for Service List */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": serviceTypes.flatMap((serviceType, stIndex) => 
              serviceType.subcategories.map((subcategory, scIndex) => ({
                "@type": "ListItem",
                "position": stIndex * 100 + scIndex + 1,
                "item": {
                  "@type": "Service",
                  "name": `${subcategory.name} - ${serviceType.name}`,
                  "provider": {
                    "@type": "Organization",
                    "name": "شرکت خدمات ساختمانی اهرم"
                  },
                  "areaServed": "IR"
                }
              }))
            )
          })}
        </script>
      </div>

      <div className="min-h-screen flex flex-col relative bg-background">
        {/* Background Image */}
        <div 
          className="fixed inset-0 z-0" 
          style={{
            backgroundImage: 'url(/hero-background.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed'
          }} 
          role="presentation" 
          aria-hidden="true" 
        >
          {/* Mobile-specific background adjustment */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media (max-width: 768px) {
              .fixed.inset-0.z-0 {
                /* Show more buildings by positioning toward the sea/buildings side */
                background-size: cover !important;
                background-position: 80% center !important;
                background-attachment: scroll !important;
              }
            }
          `}} />
        </div>
        <div className="fixed inset-0 bg-black/10 z-0" aria-hidden="true" />


        {/* Main Content */}
        <main className="flex-1 flex items-start md:items-center justify-center py-4 sm:py-6 md:py-8 px-4 sm:px-6 relative z-10" role="main">
          <article className="w-full max-w-2xl mt-2 sm:mt-4 md:mt-0">
            {/* Service Selection Card */}
            <Card className="shadow-xl md:shadow-2xl bg-card/20 backdrop-blur-xl border-2" data-tour="create-project">
              <CardHeader className="text-center pb-2 sm:pb-3 md:pb-4 px-4 sm:px-6 bg-card/20 backdrop-blur-lg rounded-t-lg">
                <h2 className="text-lg sm:text-2xl md:text-3xl font-bold leading-tight tracking-tight primary-gradient bg-clip-text text-transparent mb-2">
                  خدمات ساختمانی و منزل خود را انتخاب کنید
                </h2>
              </CardHeader>
              
              <CardContent className="space-y-3 sm:space-y-4 md:space-y-5 px-4 sm:px-6 pb-4 sm:pb-6">
                {servicesLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : (
                  <>
                    {/* Service Type Selection */}
                    <div>
                      <ServiceTypeSelector
                        serviceTypes={serviceTypes}
                        value={selectedServiceType ? `${selectedServiceType}:${selectedSubcategory}` : ''}
                        onChange={handleServiceTypeChange}
                        loading={servicesLoading}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Globe Button - Outside Card, Below Dropdown */}
            {user && !servicesLoading && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowGlobe(true)}
                  className="group relative w-[112px] h-[112px] transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-0"
                  aria-label="نمایش پروژه‌ها روی کره زمین"
                >
                  {/* Globe image with gentle swing animation */}
                  <img 
                    src="/golden-globe-new.png" 
                    alt="کره زمین" 
                    className="w-full h-full object-contain animate-globe-swing"
                  />
                </button>
              </div>
            )}
          </article>
        </main>
        

        {/* Footer */}
        <footer className="relative z-10 border-t bg-card/80 backdrop-blur-md py-4 px-4">
          <div className="container mx-auto text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              © {new Date().getFullYear()} اهرم - تمامی حقوق محفوظ است
            </p>
          </div>
        </footer>
      </div>
      </div>

      {/* Bottom Banners - PWA Install + Notification */}
      {!showGlobe && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-3 max-w-md mx-auto md:left-auto md:right-4 md:mx-0">
          <NotificationBanner variant="floating" />
          <PWAInstallBanner />
        </div>
      )}
    </>
  );
};

export default Home;
