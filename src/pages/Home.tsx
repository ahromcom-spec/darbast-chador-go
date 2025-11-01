import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, Building2, Smartphone, Download, Sparkles, MessageSquare, Briefcase, MapPin } from 'lucide-react';
import { ServiceTypeSelector } from '@/components/common/ServiceTypeSelector';
import { useToast } from '@/hooks/use-toast';
import { useAutoAssignProjects } from '@/hooks/useAutoAssignProjects';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useNavigation } from '@/hooks/useNavigation';
import usePWAInstall from '@/hooks/usePWAInstall';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { useUserProjects } from '@/hooks/useUserProjects';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

const Home = () => {
  usePageTitle('صفحه اصلی');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  
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
    // Value format: "serviceTypeId:subcategoryCode"
    const [serviceTypeId, subcategoryCode] = value.split(':');
    setSelectedServiceType(serviceTypeId || '');
    setSelectedSubcategory(subcategoryCode || '');
    setSelectedProject('');
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
      
      // هدایت به صفحه انتخاب آدرس (اگر کاربر لاگین نباشد، خودش redirect می‌کند)
      navigate('/select-location', {
        state: { serviceSelection }
      });
    }
  }, [selectedServiceType, selectedSubcategory, navigate, serviceTypes]);

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

  return (
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
            <Card className="shadow-xl md:shadow-2xl bg-card/95 backdrop-blur-md border-2" data-tour="create-project">
              <CardHeader className="text-center pb-3 sm:pb-4 md:pb-6 px-4 sm:px-6">
                <h2 className="text-lg sm:text-2xl md:text-3xl font-bold leading-tight tracking-tight primary-gradient bg-clip-text text-transparent mb-2">
                  خدمات ساختمانی و منزل خود را انتخاب کنید
                </h2>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
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

                    {/* Show Projects and Actions when service is selected */}
                    {selectedServiceType && selectedSubcategory && (
                      <section className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                          <h3 className="font-semibold text-primary text-sm sm:text-base">
                            {selectedServiceTypeObj?.name} - {selectedServiceTypeObj?.subcategories.find(s => s.code === selectedSubcategory)?.name}
                          </h3>
                        </div>

                        {/* Existing Projects */}
                        {projectsLoading ? (
                          <div className="flex justify-center py-4">
                            <LoadingSpinner />
                          </div>
                        ) : projects.length > 0 ? (
                          <div className="space-y-3">
                            {(() => {
                              // فقط پروژه‌های مرتبط با نوع خدمات انتخاب شده - حذف فیلتر service_code
                              const matchingProjects = projects;

                              return (
                                <>
                                  {matchingProjects.length > 0 && (
                                    <div className="space-y-2">
                                      <label className="text-xs sm:text-sm font-medium text-primary block">
                                        پروژه‌های مرتبط با خدمات انتخاب شده - یکی را انتخاب کنید:
                                      </label>
                                      <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {matchingProjects.map((project) => (
                                          <button
                                            key={project.id}
                                           onClick={() => handleProjectSelect(project.id)}
                                            className="w-full text-right p-3 rounded-lg border-2 border-primary/40 hover:border-primary hover:bg-primary/10 transition-all"
                                          >
                                            <div className="flex items-start gap-2">
                                              <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                              <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm">{project.title}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                  {project.addresses?.line1}, {project.addresses?.city}
                                                </div>
                                                <div className="text-xs text-primary mt-1">
                                                  کلیک کنید تا خدمات جدید اضافه کنید
                                                </div>
                                              </div>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {matchingProjects.length === 0 && (
                                    <p className="text-xs sm:text-sm text-muted-foreground text-center py-2">
                                      هنوز پروژه‌ای برای این نوع خدمات ثبت نکرده‌اید
                                    </p>
                                  )}
                                </>
                              );
                            })()}

                            {/* دکمه ایجاد پروژه جدید */}
                            <div className="pt-2">
                              <Button 
                                onClick={handleCreateNewProject}
                                className="w-full h-auto p-3 sm:p-4 construction-gradient text-sm sm:text-base"
                              >
                                <div className="space-y-0.5 sm:space-y-1">
                                  <div className="font-semibold">+ ایجاد پروژه جدید برای آدرس دیگر</div>
                                  <div className="text-xs sm:text-sm opacity-90">
                                    ثبت پروژه جدید با آدرس و مشخصات جدید
                                  </div>
                                </div>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs sm:text-sm text-muted-foreground text-center py-2">
                              هنوز پروژه‌ای برای این نوع خدمات ثبت نکرده‌اید
                            </p>
                            {/* دکمه ایجاد پروژه جدید فقط برای حالت صفر پروژه */}
                            <div className="grid grid-cols-1 gap-3 pt-2">
                              <Button 
                                onClick={handleCreateNewProject}
                                className="w-full h-auto p-3 sm:p-4 construction-gradient text-sm sm:text-base"
                              >
                                <div className="space-y-0.5 sm:space-y-1">
                                  <div className="font-semibold">ایجاد پروژه جدید</div>
                                  <div className="text-xs sm:text-sm opacity-90">
                                    تعریف پروژه جدید با آدرس و مشخصات کامل
                                  </div>
                                </div>
                              </Button>
                            </div>
                          </>
                        )}
                      </section>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
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
  );
};

export default Home;
