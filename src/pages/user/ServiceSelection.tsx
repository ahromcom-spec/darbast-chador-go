import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowRight, Package, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

export default function ServiceSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { serviceTypes, loading } = useServiceTypesWithSubcategories();
  const { getOrCreateProject } = useProjectsHierarchy();

  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get location data from navigation state
  const locationId = location.state?.locationId;
  const locationData = location.state?.locationData;
  const distanceFromCenter = location.state?.distanceFromCenter;
  const fromMap = location.state?.fromMap;
  const preselectedSubcategoryCode = location.state?.subcategoryCode;
  const preselectedServiceTypeId = location.state?.serviceTypeId;
  const preselectedSubcategoryId = location.state?.subcategoryId;

  useEffect(() => {
    if (!locationId) {
      toast({
        title: 'خطا',
        description: 'لطفاً ابتدا آدرس را انتخاب کنید',
        variant: 'destructive'
      });
      navigate('/');
    }
  }, [locationId, navigate, toast]);

  // Get subcategories from selected service type - باید قبل از useEffect ها تعریف شود
  const selectedServiceTypeData = serviceTypes.find(st => st.id === selectedServiceType);
  const filteredSubcategories = selectedServiceTypeData?.subcategories || [];

  // انتخاب خودکار نوع خدمات وقتی از نقشه می‌آید
  useEffect(() => {
    if (serviceTypes.length > 0 && !selectedServiceType) {
      // اگر serviceTypeId از نقشه ارسال شده، از آن استفاده کن
      if (preselectedServiceTypeId) {
        const matchingType = serviceTypes.find(st => st.id === preselectedServiceTypeId);
        if (matchingType) {
          setSelectedServiceType(matchingType.id);
          return;
        }
      }
      
      // اگر subcategoryCode از نقشه ارسال شده، نوع خدمات مناسب را پیدا کن
      if (preselectedSubcategoryCode) {
        const matchingType = serviceTypes.find(st => 
          st.subcategories?.some(sub => sub.code === preselectedSubcategoryCode)
        );
        if (matchingType) {
          setSelectedServiceType(matchingType.id);
          return;
        }
      }
      
      // در غیر اینصورت اولین نوع خدمات را انتخاب کن
      setSelectedServiceType(serviceTypes[0].id);
    }
  }, [serviceTypes, selectedServiceType, preselectedServiceTypeId, preselectedSubcategoryCode]);

  // انتخاب خودکار زیرمجموعه وقتی نوع خدمات انتخاب شده و از نقشه آمده
  useEffect(() => {
    if (selectedServiceType && filteredSubcategories.length > 0 && !selectedSubcategory) {
      // اگر subcategoryId از نقشه ارسال شده
      if (preselectedSubcategoryId) {
        const matching = filteredSubcategories.find(sub => sub.id === preselectedSubcategoryId);
        if (matching) {
          setSelectedSubcategory(matching.id);
          return;
        }
      }
      
      // اگر subcategoryCode از نقشه ارسال شده
      if (preselectedSubcategoryCode) {
        const matching = filteredSubcategories.find(sub => sub.code === preselectedSubcategoryCode);
        if (matching) {
          setSelectedSubcategory(matching.id);
          return;
        }
      }
    }
  }, [selectedServiceType, filteredSubcategories, selectedSubcategory, preselectedSubcategoryId, preselectedSubcategoryCode]);

  const getFormPath = (subcategoryCode: string) => {
    // Map subcategory codes to form routes
    const formMap: Record<string, string> = {
      '10': '/scaffolding/form', // داربست فلزی اجرا به همراه اجناس و حمل و نقل
      '30': '/scaffolding/rental-form', // اجاره داربست
    };

    return formMap[subcategoryCode] || '/form-not-available';
  };

  const handleContinue = async () => {
    if (!selectedServiceType || !selectedSubcategory) {
      toast({
        title: 'انتخاب نشده',
        description: 'لطفاً نوع خدمات و زیرمجموعه را انتخاب کنید',
        variant: 'destructive'
      });
      return;
    }

    const selectedServiceTypeObj = serviceTypes.find(st => st.id === selectedServiceType);
    const selectedSubcategoryData = filteredSubcategories.find(sc => sc.id === selectedSubcategory);

    if (!selectedServiceTypeObj || !selectedSubcategoryData) {
      toast({
        title: 'خطا',
        description: 'اطلاعات خدمات یافت نشد',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // ایجاد پروژه سلسله‌مراتبی برای لینک کردن سفارش به نقشه
      const projectId = await getOrCreateProject(
        locationId,
        selectedServiceType,
        selectedSubcategory
      );

      // محاسبه فاصله از مرکز استان اگر موجود نباشد
      let finalDistanceFromCenter = distanceFromCenter;
      if (!finalDistanceFromCenter && locationData?.lat && locationData?.lng) {
        finalDistanceFromCenter = calculateDistance(
          locationData.lat,
          locationData.lng,
          QOM_CENTER.lat,
          QOM_CENTER.lng
        );
      }

      const formPath = getFormPath(selectedSubcategoryData.code);

      // Navigate to the appropriate form with all necessary data including hierarchyProjectId
      navigate(formPath, {
        state: {
          hierarchyProjectId: projectId, // ✅ شناسه پروژه برای لینک کردن سفارش به نقشه
          projectId,
          locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: selectedSubcategory,
          subcategoryCode: selectedSubcategoryData.code,
          serviceName: selectedServiceTypeObj.name,
          subcategoryName: selectedSubcategoryData.name,
          // Pass location data to forms
          provinceId: locationData?.province_id,
          districtId: locationData?.district_id,
          locationAddress: locationData?.address_line,
          locationTitle: locationData?.title,
          provinceName: locationData?.province_name,
          districtName: locationData?.district_name,
          lat: locationData?.lat,
          lng: locationData?.lng,
          distanceFromCenter: finalDistanceFromCenter,
        }
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ایجاد پروژه. لطفاً دوباره تلاش کنید.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">در حال بارگذاری...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          بازگشت
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              <CardTitle>انتخاب نوع خدمات</CardTitle>
            </div>
            <CardDescription>
              لطفاً نوع خدمات و زیرمجموعه مورد نظر خود را انتخاب کنید
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-type">نوع خدمات *</Label>
              <Select value={selectedServiceType} onValueChange={(value) => {
                setSelectedServiceType(value);
                setSelectedSubcategory(''); // Reset subcategory when service type changes
              }}>
                <SelectTrigger id="service-type">
                  <SelectValue placeholder="انتخاب نوع خدمات" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((serviceType) => (
                    <SelectItem key={serviceType.id} value={serviceType.id}>
                      {serviceType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedServiceType && (
              <div className="space-y-2">
                <Label htmlFor="subcategory">زیرمجموعه خدمات *</Label>
                <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                  <SelectTrigger id="subcategory">
                    <SelectValue placeholder="انتخاب زیرمجموعه" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubcategories.map((subcategory) => (
                      <SelectItem key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleContinue}
              disabled={!selectedServiceType || !selectedSubcategory || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  در حال ایجاد پروژه...
                </>
              ) : (
                'ادامه و ثبت سفارش'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
