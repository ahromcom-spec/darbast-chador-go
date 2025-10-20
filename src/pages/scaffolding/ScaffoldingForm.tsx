import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Building2, MapPin, Package } from 'lucide-react';
import ComprehensiveScaffoldingForm from './ComprehensiveScaffoldingForm';

export default function ScaffoldingForm() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get passed data from SelectLocation or previous steps
  const state = location.state || {};
  const {
    hierarchyProjectId,
    projectId,
    locationId,
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

  // If no data passed, show error
  if (!locationAddress || !serviceName) {
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
    <div 
      className="min-h-screen py-8 relative"
      style={{
        backgroundImage: 'url(/background-building.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-black/50 z-0" />
      
      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 text-white hover:bg-white/10"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت
          </Button>

          <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
            <CardHeader className="text-center border-b">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                فرم ثبت سفارش {serviceName || 'خدمات ساختمان'}
              </CardTitle>
              <CardDescription>
                {subcategoryName || 'لطفاً اطلاعات پروژه را وارد کنید'}
              </CardDescription>
            </CardHeader>

            {/* نمایش اطلاعات آدرس و سرویس */}
            {locationAddress && (
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
                        <p className="text-sm">{locationAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {provinceName && `${provinceName}`}
                          {districtName && ` • ${districtName}`}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <Alert className="border-primary/30">
                    <Package className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">نوع خدمات:</p>
                        <p className="text-sm">{serviceName}</p>
                        <p className="text-xs text-muted-foreground">{subcategoryName}</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            )}

            <CardContent className="p-6">
              <ComprehensiveScaffoldingForm 
                hierarchyProjectId={hierarchyProjectId}
                projectId={projectId}
                locationId={locationId}
                serviceTypeId={serviceTypeId}
                subcategoryId={subcategoryId}
                subcategoryCode={subcategoryCode}
                hideAddressField={!!locationAddress}
                prefilledAddress={locationAddress}
                prefilledProvince={provinceName}
                prefilledDistrict={districtName}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
