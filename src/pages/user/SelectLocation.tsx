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

// مرکز استان قم
const QOM_CENTER = { lat: 34.6416, lng: 50.8746 };

// محاسبه فاصله با فرمول Haversine (بر حسب کیلومتر)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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
    // اگر انتخاب خدمت وجود ندارد، کاربر را به خانه برگردان
    if (!serviceSelection?.serviceTypeId || !serviceSelection?.subcategoryId) {
      navigate('/');
      return;
    }

    // اگر کاربر وارد شده است، انتخاب موقت را پاک کن
    if (user) {
      localStorage.removeItem('pendingServiceSelection');
    }
  }, [user, serviceSelection]);


  const resolveFormPath = async (): Promise<string> => {
    const { data: sub } = await supabase
      .from('subcategories')
      .select('is_service_active, form_path')
      .eq('id', serviceSelection.subcategoryId)
      .maybeSingle();

    if ((sub as any)?.is_service_active === false) return '/form-not-available';
    const custom = (sub as any)?.form_path as string | null | undefined;
    if (custom && custom.startsWith('/')) return custom;
    if (serviceSelection.serviceName && !String(serviceSelection.serviceName).includes('داربست')) {
      if (String(serviceSelection.serviceName).includes('قالی')) return '/carpet-cleaning/form';
      return '/service/form';
    }
    return getFormPath(serviceSelection.subcategoryCode);
  };

  const handleLocationSelected = async (locationId: string) => {
    // حالت مهمان: بدون ساخت پروژه در دیتابیس مستقیم به فرم سفارش می‌رویم
    if (!user) {
      const guest = JSON.parse(localStorage.getItem('guestLocation') || 'null');
      if (!guest) {
        toast({
          title: 'خطا',
          description: 'اطلاعات آدرس یافت نشد، لطفاً دوباره تلاش کنید',
          variant: 'destructive'
        });
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const formPath = await resolveFormPath();

      navigate(formPath, {
        state: {
          hierarchyProjectId: null,
          projectId: null,
          locationId: null,
          provinceId: guest.province_id,
          districtId: guest.district_id,
          serviceTypeId: serviceSelection.serviceTypeId,
          subcategoryId: serviceSelection.subcategoryId,
          subcategoryCode: serviceSelection.subcategoryCode,
          serviceName: serviceSelection.serviceName,
          subcategoryName: serviceSelection.subcategoryName,
          locationAddress: guest.address_line,
          locationTitle: guest.title || '',
          provinceName: guest.province_name || '',
          districtName: guest.district_name || '',
          lat: guest.lat,
          lng: guest.lng,
          distanceFromCenter: guest.distanceFromCenter,
          isGuest: true,
        }
      });
      return;
    }

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

      // محاسبه فاصله از مرکز استان قم
      const distanceFromCenter = calculateDistance(
        location.lat,
        location.lng,
        QOM_CENTER.lat,
        QOM_CENTER.lng
      );

      console.log('📍 SelectLocation - Distance from center:', distanceFromCenter, 'km');

      // Get or create project
      const projectId = await getOrCreateProject(
        locationId,
        serviceSelection.serviceTypeId,
        serviceSelection.subcategoryId
      );

      // بررسی وضعیت فعال بودن و مسیر فرم اختصاصی این زیرشاخه
      const formPath = await resolveFormPath();

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
          districtName: location.districts?.name || '',
          lat: location.lat,
          lng: location.lng,
          distanceFromCenter, // ✅ فاصله از مرکز استان
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
      '20': '/scaffolding/form',  // داربست فلزی - اجرای داربست بدون اجناس
      '30': '/scaffolding/rental-form',  // داربست فلزی - خدمات کرایه اجناس داربست فلزی
    };
    
    // اگر فرم برای این زیرشاخه موجود نیست، به صفحه "فرم موجود نیست" برود
    return formPaths[subcategoryCode] || '/service/form';
  };

  if (!serviceSelection) {
    return null;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Image */}

      {/* Content */}
      <div className="relative z-10 container mx-auto py-6 px-4 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
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
            <LocationSelector
              onLocationSelected={handleLocationSelected}
              serviceTypeName={serviceSelection.serviceName}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
