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

// Import comprehensive validation schemas
import { orderDimensionSchema, orderFormSchema } from '@/lib/validations';
import { sanitizeHtml, getSafeErrorMessage } from '@/lib/security';

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

  const calculatePrice = (): { total: number; pricePerMeter: number | null; breakdown: string[] } => {
    const area = calculateTotalArea();
    let basePrice = 0;
    let pricePerMeter: number | null = null;
    const breakdown: string[] = [];

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

    breakdown.push(`قیمت پایه: ${basePrice.toLocaleString('fa-IR')} تومان`);

    // شرایط فقط برای ماه اول اعمال می‌شود
    if (conditions.currentMonth === 1) {
      let monthMultiplier = 1;

      // 1. فاصله از مرکز استان
      if (conditions.distanceRange === '15-25') {
        monthMultiplier *= 1.2;
        breakdown.push('فاصله 15-25 کیلومتر: +20%');
      } else if (conditions.distanceRange === '25-50') {
        monthMultiplier *= 1.4;
        breakdown.push('فاصله 25-50 کیلومتر: +40%');
      } else if (conditions.distanceRange === '50-85') {
        monthMultiplier *= 1.7;
        breakdown.push('فاصله 50-85 کیلومتر: +70%');
      }

      // 2. ارتفاع پای کار (روی سکو/پشت‌بام)
      if (!onGround && conditions.platformHeight !== null && conditions.scaffoldHeightFromPlatform !== null) {
        const platformH = conditions.platformHeight;
        const scaffoldH = conditions.scaffoldHeightFromPlatform;
        
        if (platformH <= 6) {
          if (scaffoldH <= 6) {
            // ارتفاع 9 متر حساب می‌شود (بدون افزایش خاص)
            breakdown.push('ارتفاع پشت‌بام ≤6 و داربست ≤6: ارتفاع 9 متر');
          } else if (scaffoldH <= 12) {
            // ارتفاع کل از روی زمین
            breakdown.push('ارتفاع پشت‌بام ≤6 و داربست 6-12: ارتفاع کل از زمین');
          } else if (scaffoldH <= 24) {
            monthMultiplier *= 1.2;
            breakdown.push('ارتفاع پشت‌بام ≤6 و داربست 12-24: +20%');
          } else if (scaffoldH <= 30) {
            monthMultiplier *= 1.4;
            breakdown.push('ارتفاع پشت‌بام ≤6 و داربست 24-30: +40%');
          }
        } else if (platformH <= 12) {
          if (scaffoldH <= 12) {
            // متراژ دو برابر
            monthMultiplier *= 2;
            breakdown.push('ارتفاع پشت‌بام 6-12 و داربست ≤12: متراژ ×2');
          } else if (scaffoldH <= 24) {
            // ارتفاع کل از زمین
            breakdown.push('ارتفاع پشت‌بام 6-12 و داربست 12-24: ارتفاع کل');
          }
        } else if (platformH > 12 && scaffoldH > 12) {
          monthMultiplier *= 2;
          breakdown.push('ارتفاع پشت‌بام >12 و داربست >12: متراژ ×2 (نیاز به بالابر)');
        }
      }

      // 3. فاصله وسیله نقلیه تا پای کار
      if (!vehicleReachesSite && conditions.vehicleDistance !== null) {
        const distance = conditions.vehicleDistance;
        if (distance > 10 && distance <= 20) {
          monthMultiplier *= 1.2;
          breakdown.push('فاصله وسیله 10-20 متر: +20%');
        } else if (distance > 20 && distance <= 40) {
          monthMultiplier *= 1.4;
          breakdown.push('فاصله وسیله 20-40 متر: +40%');
        } else if (distance > 40 && distance <= 60) {
          monthMultiplier *= 1.6;
          breakdown.push('فاصله وسیله 40-60 متر: +60%');
        } else if (distance > 60 && distance <= 100) {
          monthMultiplier *= 1.8;
          breakdown.push('فاصله وسیله 60-100 متر: +80%');
        }
      }

      basePrice *= monthMultiplier;
    }

    // محاسبه قیمت چند ماهه
    let totalPrice = basePrice;

    if (conditions.totalMonths === 2) {
      // ماه اول با شرایط + ماه دوم بدون شرایط با تخفیف
      const month1 = basePrice;
      
      // قیمت پایه ماه دوم (بدون شرایط)
      let month2Base = 0;
      if (activeService === 'facade') {
        if (area <= 50) month2Base = 3200000;
        else if (area <= 100) month2Base = 4200000;
        else month2Base = area * 45000;
      } else if (activeService === 'formwork') {
        if (area <= 100) month2Base = 3200000;
        else if (area <= 200) month2Base = 4000000;
        else month2Base = area * 20000;
      } else if (activeService === 'ceiling-tiered') {
        if (area <= 100) month2Base = 7500000;
        else if (area <= 200) month2Base = 11000000;
        else month2Base = area * 45000;
      } else if (activeService === 'ceiling-slab') {
        if (area <= 100) month2Base = 8000000;
        else if (area <= 200) month2Base = 15000000;
        else month2Base = area * 70000;
      }

      totalPrice = month1 + month2Base;
      breakdown.push(`ماه دوم (بدون شرایط): ${month2Base.toLocaleString('fa-IR')} تومان`);
    } else if (conditions.totalMonths >= 3) {
      const month1 = basePrice;
      
      let monthBase = 0;
      if (activeService === 'facade') {
        if (area <= 50) monthBase = 3200000;
        else if (area <= 100) monthBase = 4200000;
        else monthBase = area * 45000;
      } else if (activeService === 'formwork') {
        if (area <= 100) monthBase = 3200000;
        else if (area <= 200) monthBase = 4000000;
        else monthBase = area * 20000;
      } else if (activeService === 'ceiling-tiered') {
        if (area <= 100) monthBase = 7500000;
        else if (area <= 200) monthBase = 11000000;
        else monthBase = area * 45000;
      } else if (activeService === 'ceiling-slab') {
        if (area <= 100) monthBase = 8000000;
        else if (area <= 200) monthBase = 15000000;
        else monthBase = area * 70000;
      }

      totalPrice = month1 + (monthBase * (conditions.totalMonths - 1));
      breakdown.push(`ماه‌های ${conditions.totalMonths - 1} (بدون شرایط): ${(monthBase * (conditions.totalMonths - 1)).toLocaleString('fa-IR')} تومان`);
    }

    return { total: totalPrice, pricePerMeter, breakdown };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { [key: string]: string } = {};

    // Comprehensive validation using zod schema
    try {
      const dimensionsData = dimensions.map(d => ({
        length: parseFloat(d.length) || 0,
        height: parseFloat(d.height) || 0,
        area: (parseFloat(d.length) || 0) * (parseFloat(d.height) || 0)
      }));

      const formData = {
        address: projectAddress,
        dimensions: dimensionsData,
      };

      orderFormSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          const path = err.path.join('.');
          newErrors[path] = err.message;
        });
      }
    }

    if (!projectAddress.trim()) {
      newErrors.projectAddress = 'آدرس پروژه الزامی است';
    }

    // بررسی فاصله بیش از 85 کیلومتر
    if (projectLocation && projectLocation.distance > 85) {
      toast({
        title: '⚠️ هشدار فاصله',
        description: 'فاصله پروژه شما بیش از 85 کیلومتر است. سفارش شما ثبت می‌شود اما قیمت نهایی پس از بررسی کارشناسی اعلام خواهد شد.',
        duration: 8000,
      });
    }

    dimensions.forEach((dim) => {
      const length = parseFloat(dim.length);
      const height = parseFloat(dim.height);
      
      if (!dim.length || !dim.height) {
        newErrors[`dimension${dim.id}`] = 'لطفاً طول و ارتفاع را وارد کنید';
      } else {
        try {
          orderDimensionSchema.parse({ length, height });
        } catch (error) {
          if (error instanceof z.ZodError) {
            newErrors[`dimension${dim.id}`] = error.errors[0].message;
          }
        }
      }
    });

    // اعتبارسنجی شرایط برای ماه اول
    if (conditions.currentMonth === 1) {
      if (!onGround) {
        if (conditions.platformHeight === null || conditions.platformHeight <= 0) {
          newErrors.platformHeight = 'لطفاً ارتفاع سکو/پشت‌بام را وارد کنید';
        }
        if (conditions.scaffoldHeightFromPlatform === null || conditions.scaffoldHeightFromPlatform <= 0) {
          newErrors.scaffoldHeight = 'لطفاً ارتفاع داربست از روی پشت‌بام را وارد کنید';
        }
      }
      
      if (!vehicleReachesSite) {
        if (conditions.vehicleDistance === null || conditions.vehicleDistance <= 0) {
          newErrors.vehicleDistance = 'لطفاً فاصله وسیله نقلیه را وارد کنید';
        }
      }
    }

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
      const { total: estimatedPrice, pricePerMeter, breakdown } = calculatePrice();

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
          status: 'pending'
        })
        .select()
        .single();

      if (projectError) throw projectError;

      toast({
        title: '✅ سفارش با موفقیت ثبت شد',
        description: `کد پروژه: ${projectCode}\nسفارش شما در انتظار تایید مدیر قرار گرفت.`,
        duration: 5000,
      });

      setTimeout(() => {
        navigate('/orders');
      }, 1500);
    } catch (error: any) {
      console.error('خطا:', error);
      const safeErrorMessage = getSafeErrorMessage(error);
      toast({
        title: '❌ خطا در ثبت سفارش',
        description: safeErrorMessage,
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

  const { total: estimatedPrice, pricePerMeter, breakdown } = calculatePrice();
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

              {/* شرایط خدمات در پروژه */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg">شرایط خدمات در پروژه</CardTitle>
                  <CardDescription>این شرایط فقط برای ماه اول اعمال می‌شود</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 1. تعداد ماه */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">۱. تعداد ماه داربست را انتخاب کنید</Label>
                    <Select 
                      value={conditions.totalMonths.toString()} 
                      onValueChange={(v) => setConditions(prev => ({ 
                        ...prev, 
                        totalMonths: parseInt(v),
                        currentMonth: Math.min(prev.currentMonth, parseInt(v))
                      }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover backdrop-blur-md border-2 z-[100]">
                        <SelectItem value="1">یک ماه</SelectItem>
                        <SelectItem value="2">دو ماه</SelectItem>
                        <SelectItem value="3">سه ماه</SelectItem>
                        <SelectItem value="4">چهار ماه</SelectItem>
                        <SelectItem value="5">پنج ماه</SelectItem>
                        <SelectItem value="6">شش ماه</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. ماه چندم */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">۲. ماه چندم است که داربست را می‌خواهید؟</Label>
                    <RadioGroup 
                      value={conditions.currentMonth.toString()}
                      onValueChange={(v) => setConditions(prev => ({ ...prev, currentMonth: parseInt(v) }))}
                      className="space-y-2"
                    >
                      {Array.from({ length: conditions.totalMonths }, (_, i) => i + 1).map(month => (
                        <div key={month} className="flex items-center space-x-2 space-x-reverse">
                          <RadioGroupItem value={month.toString()} id={`month-${month}`} />
                          <Label htmlFor={`month-${month}`} className="font-normal cursor-pointer">
                            ماه {month === 1 ? 'اول' : month === 2 ? 'دوم' : month === 3 ? 'سوم' : month === 4 ? 'چهارم' : month === 5 ? 'پنجم' : 'ششم'}
                            {month > 1 && <span className="text-xs text-muted-foreground mr-2">(بدون شرایط افزایش قیمت)</span>}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* 3. فاصله از مرکز استان */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">۳. فاصله آدرس پروژه تا مرکز استان</Label>
                    <RadioGroup 
                      value={conditions.distanceRange}
                      onValueChange={(v: any) => setConditions(prev => ({ ...prev, distanceRange: v }))}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="0-15" id="dist-0-15" />
                        <Label htmlFor="dist-0-15" className="font-normal cursor-pointer">
                          تا ۱۵ کیلومتری (بدون افزایش قیمت)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="15-25" id="dist-15-25" />
                        <Label htmlFor="dist-15-25" className="font-normal cursor-pointer">
                          ۱۵ تا ۲۵ کیلومتری (+۲۰٪)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="25-50" id="dist-25-50" />
                        <Label htmlFor="dist-25-50" className="font-normal cursor-pointer">
                          ۲۵ تا ۵۰ کیلومتری (+۴۰٪)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="50-85" id="dist-50-85" />
                        <Label htmlFor="dist-50-85" className="font-normal cursor-pointer">
                          ۵۰ تا ۸۵ کیلومتری (+۷۰٪)
                        </Label>
                      </div>
                    </RadioGroup>
                    <Alert className="bg-yellow-500/10 border-yellow-500/20">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-xs">
                        بالای ۸۵ کیلومتر از مرکز استان کار پذیرفته نمی‌شود
                      </AlertDescription>
                    </Alert>
                  </div>

                  {/* 4. ارتفاع پای کار */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">۴. ارتفاع پای کار داربست فلزی از روی زمین</Label>
                    <RadioGroup 
                      value={onGround ? 'ground' : 'platform'}
                      onValueChange={(v) => setOnGround(v === 'ground')}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="ground" id="ground" />
                        <Label htmlFor="ground" className="font-normal cursor-pointer">
                          داربست روی زمین بسته می‌شود
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="platform" id="platform" />
                        <Label htmlFor="platform" className="font-normal cursor-pointer">
                          داربست روی سکو یا پشت‌بام بسته می‌شود
                        </Label>
                      </div>
                    </RadioGroup>

                    {!onGround && (
                      <Card className="p-4 bg-background/50 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="platformHeight">ارتفاع سکو/پشت‌بام از روی زمین (متر) *</Label>
                          <Input
                            id="platformHeight"
                            type="number"
                            step="0.1"
                            value={conditions.platformHeight || ''}
                            onChange={(e) => setConditions(prev => ({ 
                              ...prev, 
                              platformHeight: parseFloat(e.target.value) || null 
                            }))}
                            placeholder="مثال: 3"
                            className={errors.platformHeight ? 'border-destructive' : ''}
                          />
                          {errors.platformHeight && (
                            <p className="text-sm text-destructive">{errors.platformHeight}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="scaffoldHeight">ارتفاع داربست از روی پشت‌بام (متر) *</Label>
                          <Input
                            id="scaffoldHeight"
                            type="number"
                            step="0.1"
                            value={conditions.scaffoldHeightFromPlatform || ''}
                            onChange={(e) => setConditions(prev => ({ 
                              ...prev, 
                              scaffoldHeightFromPlatform: parseFloat(e.target.value) || null 
                            }))}
                            placeholder="مثال: 9"
                            className={errors.scaffoldHeight ? 'border-destructive' : ''}
                          />
                          {errors.scaffoldHeight && (
                            <p className="text-sm text-destructive">{errors.scaffoldHeight}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            اگر پشت‌بام بالا و پایین دارد، ارتفاع میانگین را وارد کنید
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* 5. فاصله وسیله نقلیه */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">۵. فاصله وسیله نقلیه تا پای کار</Label>
                    <RadioGroup 
                      value={vehicleReachesSite ? 'reaches' : 'distance'}
                      onValueChange={(v) => setVehicleReachesSite(v === 'reaches')}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="reaches" id="reaches" />
                        <Label htmlFor="reaches" className="font-normal cursor-pointer">
                          وسیله نقلیه داربست تا پای کار می‌آید
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="distance" id="distance" />
                        <Label htmlFor="distance" className="font-normal cursor-pointer">
                          فاصله وسیله نقلیه تا پای کار را وارد کنید
                        </Label>
                      </div>
                    </RadioGroup>

                    {!vehicleReachesSite && (
                      <Card className="p-4 bg-background/50">
                        <div className="space-y-2">
                          <Label htmlFor="vehicleDistance">فاصله به متر *</Label>
                          <Input
                            id="vehicleDistance"
                            type="number"
                            step="1"
                            value={conditions.vehicleDistance || ''}
                            onChange={(e) => setConditions(prev => ({ 
                              ...prev, 
                              vehicleDistance: parseFloat(e.target.value) || null 
                            }))}
                            placeholder="مثال: 25"
                            className={errors.vehicleDistance ? 'border-destructive' : ''}
                          />
                          {errors.vehicleDistance && (
                            <p className="text-sm text-destructive">{errors.vehicleDistance}</p>
                          )}
                          <div className="text-xs text-muted-foreground space-y-1 mt-2 bg-secondary/30 p-3 rounded">
                            <p className="font-semibold mb-2">افزایش قیمت بر اساس فاصله:</p>
                            <p>• تا ۱۰ متر: بدون افزایش</p>
                            <p>• ۱۰-۲۰ متر: +۲۰٪</p>
                            <p>• ۲۰-۴۰ متر: +۴۰٪</p>
                            <p>• ۴۰-۶۰ متر: +۶۰٪</p>
                            <p>• ۶۰-۱۰۰ متر: +۸۰٪</p>
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>

                  {conditions.currentMonth > 1 && (
                    <Alert className="bg-blue-500/10 border-blue-500/20">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription>
                        شما ماه {conditions.currentMonth} را انتخاب کرده‌اید. شرایط افزایش قیمت فقط برای ماه اول اعمال می‌شود.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formwork Service */}
        <TabsContent value="formwork" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>خدمات داربست کفراژ و حجمی</CardTitle>
              <CardDescription>اطلاعات پروژه خود را وارد کنید</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* استفاده از همان فیلدهای بخش نماکاری */}
              <p className="text-sm text-muted-foreground bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                💡 از همان فیلدهای بخش نماکاری استفاده می‌شود. تفاوت فقط در قیمت‌گذاری است:
                <br />• تا 100 متر: 3,200,000 تومان
                <br />• 100-200 متر: 4,000,000 تومان  
                <br />• بالای 200 متر: 20,000 تومان به ازای هر متر مکعب
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ceiling Services */}
        <TabsContent value="ceiling-tiered" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>خدمات داربست زیربتن تیرچه</CardTitle>
              <CardDescription>اطلاعات پروژه خود را وارد کنید</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                💡 از همان فیلدهای بخش نماکاری استفاده می‌شود. تفاوت فقط در قیمت‌گذاری است:
                <br />• تا 100 متر: 7,500,000 تومان
                <br />• 100-200 متر: 11,000,000 تومان
                <br />• بالای 200 متر: 45,000 تومان به ازای هر متر مکعب
              </p>
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
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                💡 از همان فیلدهای بخش نماکاری استفاده می‌شود. تفاوت فقط در قیمت‌گذاری است:
                <br />• تا 100 متر: 8,000,000 تومان
                <br />• 100-200 متر: 15,000,000 تومان
                <br />• بالای 200 متر: 70,000 تومان به ازای هر متر مکعب
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Price Display */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-lg font-semibold">قیمت تخمینی کل:</span>
              <span className="text-3xl font-bold text-primary">
                {estimatedPrice.toLocaleString('fa-IR')} تومان
              </span>
            </div>
            
            {pricePerMeter && totalArea > 100 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">فی قیمت هر متر مربع:</span>
                <span className="font-semibold text-lg">{pricePerMeter.toLocaleString('fa-IR')} تومان</span>
              </div>
            )}

            {breakdown.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-sm">جزئیات محاسبه قیمت</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <div className="bg-background/50 rounded-lg p-4 space-y-2">
                    {breakdown.map((item, index) => (
                      <div key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {conditions.totalMonths > 1 && (
              <Alert className="bg-green-500/10 border-green-500/20">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm">
                  قیمت برای {conditions.totalMonths} ماه محاسبه شده است
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Map */}
      <Card>
        <CardHeader>
          <CardTitle>موقعیت پروژه روی نقشه (اختیاری)</CardTitle>
          <CardDescription>
            برای محاسبه دقیق فاصله از مرکز استان، موقعیت پروژه را روی نقشه مشخص کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projectLocation && projectLocation.distance > 85 && (
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                ⚠️ فاصله پروژه شما {projectLocation.distance.toFixed(1)} کیلومتر از مرکز استان است.
                <br />
                <strong>توجه:</strong> بالای 85 کیلومتر از مرکز استان کار پذیرفته نمی‌شود. 
                قیمت نهایی پس از بررسی کارشناسی اعلام خواهد شد.
              </AlertDescription>
            </Alert>
          )}
          
          <ProjectLocationMap
            onLocationSelect={(location) => {
              setProjectLocation(location);
              
              // بروزرسانی خودکار distanceRange بر اساس فاصله واقعی
              if (location.distance <= 15) {
                setConditions(prev => ({ ...prev, distanceRange: '0-15' }));
              } else if (location.distance <= 25) {
                setConditions(prev => ({ ...prev, distanceRange: '15-25' }));
              } else if (location.distance <= 50) {
                setConditions(prev => ({ ...prev, distanceRange: '25-50' }));
              } else if (location.distance <= 85) {
                setConditions(prev => ({ ...prev, distanceRange: '50-85' }));
              }
            }}
          />
          
          {projectLocation && (
            <div className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg">
              📍 فاصله از مرکز استان: <strong>{projectLocation.distance.toFixed(1)} کیلومتر</strong>
            </div>
          )}
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
