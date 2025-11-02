import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Building2, MapPin, Package } from 'lucide-react';
import ComprehensiveScaffoldingForm from './ComprehensiveScaffoldingForm';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

export default function ScaffoldingForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const editOrderId = searchParams.get('edit');
  
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  
  // Get passed data from SelectLocation or previous steps
  const state = location.state || {};
  const {
    hierarchyProjectId,
    projectId,
    locationId,
    provinceId,
    districtId,
    serviceTypeId,
    subcategoryId,
    subcategoryCode,
    serviceName,
    subcategoryName,
    locationAddress,
    locationTitle,
    provinceName,
    districtName
  } = state;

  // Fetch order data if editing
  useEffect(() => {
    if (editOrderId) {
      fetchOrderData();
    }
  }, [editOrderId]);

  const fetchOrderData = async () => {
    if (!editOrderId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          *,
          subcategory:subcategories!projects_v3_subcategory_id_fkey (
            id,
            name,
            code,
            service_type:service_types_v3!subcategories_service_type_id_fkey (
              id,
              name,
              code
            )
          ),
          province:provinces!projects_v3_province_id_fkey (
            id,
            name,
            code
          ),
          district:districts!projects_v3_district_id_fkey (
            id,
            name
          )
        `)
        .eq('id', editOrderId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setOrderData(data);
      }
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری اطلاعات سفارش',
        variant: 'destructive'
      });
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while fetching order data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="در حال بارگذاری..." />
      </div>
    );
  }

  // If editing, use order data; otherwise use state data
  const finalLocationAddress = orderData?.address || locationAddress;
  const finalServiceName = orderData?.subcategory?.service_type?.name || serviceName;
  const finalSubcategoryName = orderData?.subcategory?.name || subcategoryName;
  const finalProvinceName = orderData?.province?.name || provinceName;
  const finalDistrictName = orderData?.district?.name || districtName;
  const finalProvinceId = orderData?.province_id || provinceId;
  const finalDistrictId = orderData?.district_id || districtId;
  const finalSubcategoryId = orderData?.subcategory_id || subcategoryId;
  const finalSubcategoryCode = orderData?.subcategory?.code || subcategoryCode;
  const finalServiceTypeId = orderData?.subcategory?.service_type?.id || serviceTypeId;

  // If no data passed and not editing, show error
  if (!finalLocationAddress || !finalServiceName) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">خطا</CardTitle>
            <CardDescription>
              اطلاعات آدرس و مرحله قبل دریافت نشد
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              بازگشت به صفحه اصلی
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
      
      <div className="relative z-10 container mx-auto px-4 max-w-7xl py-8">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 text-white hover:bg-white/10"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>

            <Card className="shadow-2xl bg-card/20 backdrop-blur-md border-2">
            <CardHeader className="text-center border-b">
              <CardTitle className="text-2xl flex items-center justify-center gap-2 text-[hsl(220,70%,30%)]">
                <Building2 className="h-6 w-6 text-primary" />
                {editOrderId ? 'ویرایش سفارش' : `فرم ثبت سفارش ${finalServiceName || 'خدمات ساختمان'}`}
              </CardTitle>
              <CardDescription className="text-[hsl(220,70%,35%)] font-semibold">
                {finalSubcategoryName || 'لطفاً اطلاعات پروژه را وارد کنید'}
              </CardDescription>
            </CardHeader>

            {/* نمایش اطلاعات آدرس و سرویس */}
            {finalLocationAddress && (
              <CardContent className="pt-6 pb-4 border-b bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Alert className="border-primary/30">
                    <MapPin className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">آدرس پروژه:</p>
                        {locationTitle && (
                          <p className="text-xs text-muted-foreground">{locationTitle}</p>
                        )}
                        <p className="text-sm">{finalLocationAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {finalProvinceName && `${finalProvinceName}`}
                          {finalDistrictName && ` • ${finalDistrictName}`}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <Alert className="border-primary/30">
                    <Package className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">نوع خدمات:</p>
                        <p className="text-sm">{finalServiceName}</p>
                        <p className="text-xs text-muted-foreground">{finalSubcategoryName}</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            )}

            <CardContent className="p-6">
              <ComprehensiveScaffoldingForm 
                editOrderId={editOrderId || undefined}
                existingOrderData={orderData}
                hierarchyProjectId={hierarchyProjectId}
                projectId={projectId}
                locationId={locationId}
                provinceId={finalProvinceId}
                districtId={finalDistrictId}
                serviceTypeId={finalServiceTypeId}
                subcategoryId={finalSubcategoryId}
                subcategoryCode={finalSubcategoryCode}
                hideAddressField={!!finalLocationAddress}
                prefilledAddress={finalLocationAddress}
                prefilledProvince={finalProvinceName}
                prefilledDistrict={finalDistrictName}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
