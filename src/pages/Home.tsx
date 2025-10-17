import { useState, useEffect } from 'react';
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

export default function Home() {
  usePageTitle('صفحه اصلی');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  
  const { canInstall, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const { toast } = useToast();
  const { navigate, navigateWithAuth } = useNavigation();
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

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    const project = projects.find(p => p.id === projectId);
    if (project) {
      // بررسی اینکه آیا پروژه از نوع داربست با اجناس و حمل است
      if (project.service_code === 'scaffolding_with_materials_and_transport') {
        // هدایت به فرم جامع داربست با اطلاعات پروژه
        navigate(`/service/scaffolding-order/${projectId}`);
      } else {
        navigate(`/user/projects`);
      }
    }
  };

  const handleCreateNewProject = () => {
    const serviceType = serviceTypes.find(st => st.id === selectedServiceType);
    const subcategory = serviceType?.subcategories.find(sc => sc.code === selectedSubcategory);
    
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
          className="fixed inset-0 z-0" 
          style={{
            backgroundImage: 'url(/background-city.png)',
            backgroundSize: 'cover',
            backgroundPosition: window.innerWidth < 768 ? '60% center' : 'center center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed'
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
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight tracking-tight primary-gradient bg-clip-text text-transparent mb-2 whitespace-nowrap">
                  خدمات ساختمانی و منزل خود را انتخاب کنید
                </h2>
                <CardDescription className="text-sm sm:text-base md:text-lg">
                  خدمات ساختمانی و داربست در قم و سراسر ایران
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
                {servicesLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : (
                  <>
                    {/* Service Type Selection */}
                    <div className="space-y-2.5 sm:space-y-3 slide-up">
                      <label htmlFor="service-type-select" className="text-xs sm:text-sm font-medium text-foreground block">
                        انتخاب نوع خدمات:
                      </label>
                      <ServiceTypeSelector
                        serviceTypes={serviceTypes}
                        value={selectedServiceType ? `${selectedServiceType}:${selectedSubcategory}` : ''}
                        onChange={handleServiceTypeChange}
                        loading={servicesLoading}
                      />
                    </div>

                    {/* Show Projects and Actions when service is selected */}
                    {selectedServiceType && selectedSubcategory && (
                      <section className="space-y-3 sm:space-y-4 p-4 sm:p-5 md:p-6 bg-secondary/50 rounded-lg border-2 border-construction/20 scale-in">
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
                          <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-medium text-foreground block">
                              پروژه‌های قبلی شما:
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {projects.map((project) => (
                                <button
                                  key={project.id}
                                  onClick={() => handleProjectSelect(project.id)}
                                  className="w-full text-right p-3 rounded-lg border-2 hover:border-primary hover:bg-primary/5 transition-all smooth-hover"
                                >
                                  <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-sm">{project.title}</div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {project.addresses?.line1}, {project.addresses?.city}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm text-muted-foreground text-center py-2">
                            هنوز پروژه‌ای برای این نوع خدمات ثبت نکرده‌اید
                          </p>
                        )}

                        {/* Action Buttons */}
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
                      </section>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </article>
        </main>
        
        {/* PWA Install Card */}
        {!isStandalone && (
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
                      <p className="text-xs text-muted-foreground">{canInstall || isIOS ? 'دسترسی سریع‌تر به خدمات' : 'اگر دکمه غیرفعال است، از منوی مرورگر گزینه Install/Add to Home Screen را بزنید'}</p>
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
        )}

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
