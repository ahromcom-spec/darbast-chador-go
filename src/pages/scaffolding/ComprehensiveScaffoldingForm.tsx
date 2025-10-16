import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import ProjectLocationMap from '@/components/ProjectLocationMap';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Types
interface Dimension {
  id: string;
  length: string;
  height: string;
}

interface ServiceConditions {
  totalMonths: number;
  currentMonth: number;
  distanceRange: '0-15' | '15-25' | '25-50' | '50-85';
  platformHeight: number | null;
  scaffoldHeightFromPlatform: number | null;
  vehicleDistance: number | null;
}

const dimensionSchema = z.object({
  length: z.number().positive({ message: 'طول باید بیشتر از صفر باشد' }),
  height: z.number().positive({ message: 'ارتفاع باید بیشتر از صفر باشد' }),
});

export default function ComprehensiveScaffoldingForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Active service type
  const [activeService, setActiveService] = useState<'facade' | 'formwork' | 'ceiling-tiered' | 'ceiling-slab'>('facade');

  // Common fields
  const [projectAddress, setProjectAddress] = useState('');
  const [dimensions, setDimensions] = useState<Dimension[]>([{ id: '1', length: '', height: '' }]);
  const [projectLocation, setProjectLocation] = useState<{
    address: string;
    coordinates: [number, number];
    distance: number;
  } | null>(null);

  // Service conditions
  const [conditions, setConditions] = useState<ServiceConditions>({
    totalMonths: 1,
    currentMonth: 1,
    distanceRange: '0-15',
    platformHeight: null,
    scaffoldHeightFromPlatform: null,
    vehicleDistance: null,
  });

  const [onGround, setOnGround] = useState(true);
  const [vehicleReachesSite, setVehicleReachesSite] = useState(true);

  // Ceiling section states
  const [ceilingTieredOpen, setCeilingTieredOpen] = useState(false);
  const [ceilingSlabOpen, setCeilingSlabOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // System data
  const [customer, setCustomer] = useState<any>(null);
  const [qomProvinceId, setQomProvinceId] = useState<string>('');
  const [qomCityId, setQomCityId] = useState<string>('');
  const [scaffoldingServiceId, setScaffoldingServiceId] = useState<string>('');
  const [withMaterialsSubcategoryId, setWithMaterialsSubcategoryId] = useState<string>('');

  useEffect(() => {
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      setDataLoading(true);

      const { data: qom } = await supabase
        .from('provinces')
        .select('id')
        .eq('code', '10')
        .single();
      if (qom) setQomProvinceId(qom.id);

      const { data: qomCity } = await supabase
        .from('districts')
        .select('id')
        .eq('name', 'شهر قم')
        .maybeSingle();
      if (qomCity) setQomCityId(qomCity.id);

      const { data: scaffolding } = await supabase
        .from('service_types_v3')
        .select('id')
        .eq('code', '10')
        .single();
      if (scaffolding) setScaffoldingServiceId(scaffolding.id);

      if (scaffolding) {
        const { data: withMaterials } = await supabase
          .from('subcategories')
          .select('id')
          .eq('service_type_id', scaffolding.id)
          .eq('code', '10')
          .single();
        if (withMaterials) setWithMaterialsSubcategoryId(withMaterials.id);
      }

      let { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!customerData) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({ user_id: user.id } as any)
          .select()
          .maybeSingle();
        customerData = newCustomer;
      }

      setCustomer(customerData);
    } catch (error: any) {
      console.error('خطا در بارگذاری:', error);
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDataLoading(false);
    }
  };

  // Dimension management
  const addDimension = () => {
    const newId = (dimensions.length + 1).toString();
    setDimensions([...dimensions, { id: newId, length: '', height: '' }]);
  };

  const removeDimension = (id: string) => {
    if (dimensions.length > 1) {
      setDimensions(dimensions.filter(d => d.id !== id));
    }
  };

  const updateDimension = (id: string, field: 'length' | 'height', value: string) => {
    setDimensions(dimensions.map(d => 
      d.id === id ? { ...d, [field]: value } : d
    ));
  };

  const calculateTotalArea = (): number => {
    return dimensions.reduce((total, dim) => {
      const length = parseFloat(dim.length) || 0;
      const height = parseFloat(dim.height) || 0;
      return total + (length * height);
    }, 0);
  };

  const calculatePrice = (): { total: number; pricePerMeter: number | null } => {
    const area = calculateTotalArea();
    let basePrice = 0;
    let pricePerMeter: number | null = null;

    // Base pricing based on service type
    if (activeService === 'facade') {
      if (area <= 50) {
        basePrice = 3200000;
      } else if (area <= 100) {
        basePrice = 4200000;
      } else {
        pricePerMeter = 45000;
        basePrice = area * pricePerMeter;
      }
    } else if (activeService === 'formwork') {
      if (area <= 100) {
        basePrice = 3200000;
      } else if (area <= 200) {
        basePrice = 4000000;
      } else {
        pricePerMeter = 20000;
        basePrice = area * pricePerMeter;
      }
    } else if (activeService === 'ceiling-tiered') {
      if (area <= 100) {
        basePrice = 7500000;
      } else if (area <= 200) {
        basePrice = 11000000;
      } else {
        pricePerMeter = 45000;
        basePrice = area * pricePerMeter;
      }
    } else if (activeService === 'ceiling-slab') {
      if (area <= 100) {
        basePrice = 8000000;
      } else if (area <= 200) {
        basePrice = 15000000;
      } else {
        pricePerMeter = 70000;
        basePrice = area * pricePerMeter;
      }
    }

    // TODO: Apply conditions multipliers (will add in next step)

    return { total: basePrice, pricePerMeter };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { [key: string]: string } = {};

    if (!projectAddress.trim()) {
      newErrors.projectAddress = 'آدرس پروژه الزامی است';
    }

    dimensions.forEach((dim) => {
      const length = parseFloat(dim.length);
      const height = parseFloat(dim.height);
      
      if (!dim.length || !dim.height) {
        newErrors[`dimension${dim.id}`] = 'لطفاً طول و ارتفاع را وارد کنید';
      } else {
        try {
          dimensionSchema.parse({ length, height });
        } catch (error) {
          if (error instanceof z.ZodError) {
            newErrors[`dimension${dim.id}`] = error.errors[0].message;
          }
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'خطا در اعتبارسنجی',
        description: 'لطفاً تمام فیلدها را به درستی پر کنید',
        variant: 'destructive',
      });
      return;
    }

    if (!customer || !qomProvinceId || !withMaterialsSubcategoryId) {
      toast({
        title: 'خطا',
        description: 'اطلاعات سیستم کامل نیست',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const totalArea = calculateTotalArea();
      const { total: estimatedPrice, pricePerMeter } = calculatePrice();

      const { data: projectCode, error: codeError } = await supabase
        .rpc('generate_project_code', {
          _customer_id: customer.id,
          _province_id: qomProvinceId,
          _subcategory_id: withMaterialsSubcategoryId
        });

      if (codeError) throw codeError;

      const [projectNumber, serviceCode] = projectCode.split('/');

      const dimensionsData = dimensions.map(d => ({
        length: parseFloat(d.length),
        height: parseFloat(d.height),
        area: parseFloat(d.length) * parseFloat(d.height)
      }));

      const { data: project, error: projectError } = await supabase
        .from('projects_v3')
        .insert({
          customer_id: customer.id,
          province_id: qomProvinceId,
          district_id: qomCityId || null,
          subcategory_id: withMaterialsSubcategoryId,
          project_number: projectNumber,
          service_code: serviceCode,
          code: projectCode,
          address: projectAddress,
          detailed_address: projectLocation 
            ? `موقعیت: ${projectLocation.coordinates[1]},${projectLocation.coordinates[0]} - فاصله: ${projectLocation.distance}km`
            : null,
          notes: JSON.stringify({
            service_type: activeService,
            dimensions: dimensionsData,
            total_area: totalArea,
            conditions: conditions,
            estimated_price: estimatedPrice,
            price_per_meter: pricePerMeter
          }),
          status: 'draft'
        })
        .select()
        .single();

      if (projectError) throw projectError;

      toast({
        title: '✅ سفارش با موفقیت ثبت شد',
        description: `کد پروژه: ${projectCode}\nقیمت تخمینی: ${estimatedPrice.toLocaleString('fa-IR')} تومان`,
        duration: 5000,
      });

      setTimeout(() => {
        navigate('/projects');
      }, 1500);
    } catch (error: any) {
      console.error('خطا:', error);
      toast({
        title: '❌ خطا در ثبت سفارش',
        description: error.message || 'مشکلی پیش آمد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">در حال بارگذاری...</p>
      </div>
    );
  }

  const { total: estimatedPrice, pricePerMeter } = calculatePrice();
  const totalArea = calculateTotalArea();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Service Type Tabs */}
      <Tabs value={activeService} onValueChange={(v) => setActiveService(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="facade">نماکاری و سطحی</TabsTrigger>
          <TabsTrigger value="formwork">کفراژ و حجمی</TabsTrigger>
          <TabsTrigger value="ceiling-tiered">زیربتن تیرچه</TabsTrigger>
          <TabsTrigger value="ceiling-slab">زیربتن دال</TabsTrigger>
        </TabsList>

        {/* Facade Service */}
        <TabsContent value="facade" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>خدمات داربست نماکاری و سطحی</CardTitle>
              <CardDescription>اطلاعات پروژه خود را وارد کنید</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Project Address */}
              <div className="space-y-2">
                <Label htmlFor="projectAddress">آدرس محل پروژه *</Label>
                <Input
                  id="projectAddress"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  placeholder="آدرس کامل پروژه"
                  className={errors.projectAddress ? 'border-destructive' : ''}
                />
                {errors.projectAddress && (
                  <p className="text-sm text-destructive">{errors.projectAddress}</p>
                )}
              </div>

              {/* Dimensions */}
              <div className="space-y-4">
                <Label>ابعاد داربست (برای محاسبه متراژ)</Label>
                
                {dimensions.map((dim) => (
                  <Card key={dim.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>طول (متر)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={dim.length}
                            onChange={(e) => updateDimension(dim.id, 'length', e.target.value)}
                            placeholder="6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ارتفاع (متر)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={dim.height}
                            onChange={(e) => updateDimension(dim.id, 'height', e.target.value)}
                            placeholder="9"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-sm text-muted-foreground">متراژ</span>
                        <span className="font-bold text-primary">
                          {((parseFloat(dim.length) || 0) * (parseFloat(dim.height) || 0)).toFixed(2)} م²
                        </span>
                        {dimensions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDimension(dim.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDimension}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  افزودن ابعاد
                </Button>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    جمع متراژ: <strong>{totalArea.toFixed(2)} متر مربع</strong>
                  </AlertDescription>
                </Alert>
              </div>

              {/* Conditions - Will add in next step */}
              <Card className="bg-secondary/20">
                <CardHeader>
                  <CardTitle className="text-lg">شرایط خدمات در پروژه</CardTitle>
                  <CardDescription>این بخش در مرحله بعد تکمیل می‌شود</CardDescription>
                </CardHeader>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formwork Service */}
        <TabsContent value="formwork" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>خدمات داربست کفراژ و حجمی</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">از همان فیلدهای بالا استفاده می‌شود. قیمت‌گذاری متفاوت است.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ceiling Services */}
        <TabsContent value="ceiling-tiered" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>خدمات داربست زیربتن تیرچه</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">از همان فیلدهای بالا استفاده می‌شود. قیمت‌گذاری متفاوت است.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ceiling-slab" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>خدمات داربست زیربتن دال</CardTitle>
              <CardDescription>
                روش محاسبه: تعداد پایه‌های داربست × مساحت مربع × ارتفاع
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">از همان فیلدهای بالا استفاده می‌شود. قیمت‌گذاری متفاوت است.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Price Display */}
      <Card className="bg-primary/5 border-primary">
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">قیمت تخمینی:</span>
              <span className="text-2xl font-bold text-primary">
                {estimatedPrice.toLocaleString('fa-IR')} تومان
              </span>
            </div>
            {pricePerMeter && totalArea > 100 && (
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>فی قیمت هر متر:</span>
                <span>{pricePerMeter.toLocaleString('fa-IR')} تومان</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Map */}
      <Card>
        <CardHeader>
          <CardTitle>موقعیت پروژه روی نقشه</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectLocationMap
            onLocationSelect={(location) => setProjectLocation(location)}
          />
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1"
        >
          {loading ? 'در حال ثبت...' : 'ثبت سفارش'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/')}
        >
          انصراف
        </Button>
      </div>
    </form>
  );
}
