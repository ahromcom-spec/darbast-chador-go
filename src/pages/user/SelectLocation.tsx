import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LocationSelector } from '@/components/locations/LocationSelector';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function SelectLocation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { getOrCreateProject } = useProjectsHierarchy();

  // Get service selection from state or localStorage
  const serviceSelection = location.state?.serviceSelection || 
    JSON.parse(localStorage.getItem('pendingServiceSelection') || 'null');

  useEffect(() => {
    // If not logged in, redirect to login with return path
    if (!user) {
      localStorage.setItem('pendingServiceSelection', JSON.stringify(serviceSelection));
      navigate('/auth/login', { 
        state: { from: '/select-location', serviceSelection } 
      });
      return;
    }

    // If no service selection, redirect to home silently
    if (!serviceSelection?.serviceTypeId || !serviceSelection?.subcategoryId) {
      navigate('/');
      return;
    }

    // Clear pending selection if user is logged in
    localStorage.removeItem('pendingServiceSelection');
  }, [user, serviceSelection]);

  const handleLocationSelected = async (locationId: string) => {
    // Scroll to top for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    try {
      // Get location details from database
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select(`
          *,
          provinces(name),
          districts(name)
        `)
        .eq('id', locationId)
        .single();

      if (locationError) throw locationError;

      // Get or create project
      const projectId = await getOrCreateProject(
        locationId,
        serviceSelection.serviceTypeId,
        serviceSelection.subcategoryId
      );

      // Navigate to appropriate service form with all needed data
      const formPath = getFormPath(serviceSelection.subcategoryCode);
      navigate(formPath, { 
        state: { 
          hierarchyProjectId: projectId, // شناسه پروژه در hierarchy برای لینک کردن سفارش
          projectId,
          locationId,
          provinceId: location.province_id, // ✅ اضافه کردن ID استان
          districtId: location.district_id, // ✅ اضافه کردن ID شهرستان
          serviceTypeId: serviceSelection.serviceTypeId,
          subcategoryId: serviceSelection.subcategoryId,
          subcategoryCode: serviceSelection.subcategoryCode,
          serviceName: serviceSelection.serviceName,
          subcategoryName: serviceSelection.subcategoryName,
          locationAddress: location.address_line,
          locationTitle: location.title || '',
          provinceName: location.provinces?.name || '',
          districtName: location.districts?.name || ''
        } 
      });
    } catch (error) {
      toast({
        title: 'خطا',
        description: 'خطا در ایجاد پروژه',
        variant: 'destructive'
      });
    }
  };

  const getFormPath = (subcategoryCode: string) => {
    // Map subcategory codes to form paths
    const formPaths: Record<string, string> = {
      '10': '/scaffolding/form',  // داربست فلزی - اجرای داربست به همراه اجناس و حمل و نقل
      '30': '/scaffolding/rental-form',  // داربست فلزی - خدمات کرایه اجناس داربست فلزی
    };
    
    // اگر فرم برای این زیرشاخه موجود نیست، به صفحه "فرم موجود نیست" برود
    return formPaths[subcategoryCode] || '/form-not-available';
  };

  if (!serviceSelection) {
    return null;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/hero-background.webp)',
        }}
      >
        {/* Overlay gradient for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto py-6 px-4 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 text-white hover:bg-white/10"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          بازگشت
        </Button>

        <PageHeader
          title="انتخاب آدرس پروژه"
          description={`برای ثبت سفارش ${serviceSelection.serviceName} - ${serviceSelection.subcategoryName}، لطفاً آدرس پروژه را انتخاب یا ثبت کنید`}
        />

        <Card className="mt-6 shadow-2xl bg-card/95 backdrop-blur-md border-2">
          <CardContent className="p-6">
            <LocationSelector onLocationSelected={handleLocationSelected} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
