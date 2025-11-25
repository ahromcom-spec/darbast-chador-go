import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowRight, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ServiceSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { serviceTypes, loading } = useServiceTypesWithSubcategories();

  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');

  // Get location_id from navigation state
  const locationId = location.state?.locationId;

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

  // Get subcategories from selected service type
  const selectedServiceTypeData = serviceTypes.find(st => st.id === selectedServiceType);
  const filteredSubcategories = selectedServiceTypeData?.subcategories || [];

  const getFormPath = (subcategoryCode: string) => {
    // Map subcategory codes to form routes
    const formMap: Record<string, string> = {
      '10': '/scaffolding/comprehensive-form', // داربست فلزی اجرا به همراه اجناس و حمل و نقل
      '30': '/scaffolding/rental-form', // اجاره داربست
    };

    return formMap[subcategoryCode] || '/form-not-available';
  };

  const handleContinue = () => {
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

    const formPath = getFormPath(selectedSubcategoryData.code);

    // Navigate to the appropriate form with all necessary data
    navigate(formPath, {
      state: {
        locationId,
        serviceTypeId: selectedServiceType,
        subcategoryId: selectedSubcategory,
        serviceTypeName: selectedServiceTypeObj.name,
        subcategoryName: selectedSubcategoryData.name,
      }
    });
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
              disabled={!selectedServiceType || !selectedSubcategory}
              className="w-full"
            >
              ادامه و ثبت سفارش
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
