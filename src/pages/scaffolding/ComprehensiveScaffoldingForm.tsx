import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCustomer } from '@/hooks/useCustomer';
import { useProvinces } from '@/hooks/useProvinces';
import { useDistricts } from '@/hooks/useDistricts';
import { sanitizeHtml } from '@/lib/security';
import { scaffoldingFormSchema } from '@/lib/validations';

interface Dimension {
  id: string;
  length: string;
  width: string;
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

interface ComprehensiveScaffoldingFormProps {
  projectId?: string;
  hideAddressField?: boolean;
  prefilledAddress?: string;
}

export default function ComprehensiveScaffoldingForm({
  prefilledAddress = '',
}: ComprehensiveScaffoldingFormProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location?.state || {}) as any;
  const { toast } = useToast();
  const { user } = useAuth();
  const { customerId } = useCustomer();
  const { provinces } = useProvinces();
  
  // دریافت hierarchyProjectId از state برای لینک کردن سفارش
  const hierarchyProjectId = navState?.hierarchyProjectId || null;

  const [activeService, setActiveService] = useState<'facade' | 'formwork' | 'ceiling-tiered' | 'ceiling-slab'>('facade');
  const address = prefilledAddress || navState?.locationAddress || '';
  const [dimensions, setDimensions] = useState<Dimension[]>([{ id: '1', length: '', width: '1', height: '' }]);
  const [isFacadeWidth2m, setIsFacadeWidth2m] = useState(false);
  
  // Location fields
  const [provinceId, setProvinceId] = useState<string>('');
  const [districtId, setDistrictId] = useState<string>('');
  const [detailedAddress, setDetailedAddress] = useState(address);
  const { districts } = useDistricts(provinceId);

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
  const [ceilingTieredOpen, setCeilingTieredOpen] = useState(false);
  const [ceilingSlabOpen, setCeilingSlabOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const addDimension = () => {
    const newId = (dimensions.length + 1).toString();
    const defaultWidth = activeService === 'facade' ? (isFacadeWidth2m ? '1.5' : '1') : '';
    setDimensions([...dimensions, { id: newId, length: '', width: defaultWidth, height: '' }]);
  };

  const removeDimension = (id: string) => {
    if (dimensions.length > 1) {
      setDimensions(dimensions.filter(d => d.id !== id));
    }
  };

  const updateDimension = (id: string, field: 'length' | 'width' | 'height', value: string) => {
    setDimensions(dimensions.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const calculateTotalArea = (): number => {
    return dimensions.reduce((total, dim) => {
      const length = parseFloat(dim.length) || 0;
      const width = parseFloat(dim.width) || 0;
      const height = parseFloat(dim.height) || 0;
      return total + (length * width * height);
    }, 0);
  };

  const calculatePrice = (): { total: number; pricePerMeter: number | null; breakdown: string[] } => {
    const area = calculateTotalArea();
    let basePrice = 0;
    let pricePerMeter: number | null = null;
    const breakdown: string[] = [];

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

    if (conditions.currentMonth === 1) {
      let monthMultiplier = 1;

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

      if (!onGround && conditions.platformHeight) {
        if (conditions.platformHeight <= 3) {
          monthMultiplier *= 1.2;
          breakdown.push('ارتفاع پای کار تا 3 متر: +20%');
        } else if (conditions.platformHeight <= 6) {
          monthMultiplier *= 1.4;
          breakdown.push('ارتفاع پای کار 3-6 متر: +40%');
        } else {
          monthMultiplier *= 1.6;
          breakdown.push('ارتفاع پای کار بیش از 6 متر: +60%');
        }
      }

      if (!onGround && conditions.scaffoldHeightFromPlatform) {
        if (conditions.scaffoldHeightFromPlatform > 15) {
          monthMultiplier *= 1.2;
          breakdown.push('ارتفاع داربست بیش از 15 متر: +20%');
        }
      }

      if (!vehicleReachesSite && conditions.vehicleDistance) {
        if (conditions.vehicleDistance <= 50) {
          monthMultiplier *= 1.1;
          breakdown.push('فاصله خودرو تا 50 متر: +10%');
        } else if (conditions.vehicleDistance <= 100) {
          monthMultiplier *= 1.15;
          breakdown.push('فاصله خودرو 50-100 متر: +15%');
        } else {
          monthMultiplier *= 1.25;
          breakdown.push('فاصله خودرو بیش از 100 متر: +25%');
        }
      }

      basePrice *= monthMultiplier;
    }

    if (conditions.totalMonths > 1) {
      const additionalMonths = conditions.totalMonths - 1;
      const additionalCost = basePrice * 0.7 * additionalMonths;
      breakdown.push(`ماه‌های اضافی (${additionalMonths} ماه): ${additionalCost.toLocaleString('fa-IR')} تومان`);
      basePrice += additionalCost;
    }

    return { total: Math.round(basePrice), pricePerMeter, breakdown };
  };

  const onSubmit = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (!customerId) {
      toast({ title: 'خطا', description: 'لطفاً ابتدا وارد شوید', variant: 'destructive' });
      return;
    }

    if (!provinceId || !detailedAddress) {
      toast({ title: 'خطا', description: 'لطفاً استان و آدرس را وارد کنید', variant: 'destructive' });
      return;
    }

    if (dimensions.some(d => !d.length || !d.width || !d.height)) {
      toast({ title: 'خطا', description: 'لطفاً تمام ابعاد را وارد کنید', variant: 'destructive' });
      return;
    }

    // Validate using Zod schema
    try {
      scaffoldingFormSchema.parse({
        detailedAddress: detailedAddress.trim(),
        dimensions: dimensions.map(d => ({
          length: parseFloat(d.length),
          width: parseFloat(d.width),
          height: parseFloat(d.height)
        }))
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: 'خطای اعتبارسنجی', description: error.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    // Sanitize address
    const sanitizedAddress = sanitizeHtml(detailedAddress.trim());

    try {
      setLoading(true);
      const priceData = calculatePrice();

      // دریافت نوع خدمات و subcategory از state یا حافظه
      const pendingSel = JSON.parse(localStorage.getItem('pendingServiceSelection') || 'null');
      let finalServiceTypeId: string | null = navState?.serviceTypeId || pendingSel?.serviceTypeId || null;
      let finalSubcategoryId: string | null = navState?.subcategoryId || pendingSel?.subcategoryId || null;

      // اگر هنوز مشخص نشد، بر اساس نام‌ها یا کد زیرشاخه تلاش کن
      if (!finalServiceTypeId || !finalSubcategoryId) {
        // تلاش بر اساس نام نوع خدمت
        if (!finalServiceTypeId && navState?.serviceName) {
          const { data: st } = await supabase
            .from('service_types_v3')
            .select('id')
            .ilike('name', navState.serviceName)
            .maybeSingle();
          if (st) finalServiceTypeId = st.id;
        }

        // تلاش بر اساس نام زیرشاخه در صورت داشتن serviceTypeId
        if (finalServiceTypeId && !finalSubcategoryId && navState?.subcategoryName) {
          const { data: sc } = await supabase
            .from('subcategories')
            .select('id')
            .eq('service_type_id', finalServiceTypeId)
            .ilike('name', navState.subcategoryName)
            .maybeSingle();
          if (sc) finalSubcategoryId = sc.id;
        }

        // تلاش بر اساس کد زیرشاخه (در state یا حافظه) اگر هنوز نامشخص است
        if ((!finalServiceTypeId || !finalSubcategoryId) && (navState?.subcategoryCode || pendingSel?.subcategoryCode)) {
          const subCode = navState?.subcategoryCode || pendingSel?.subcategoryCode;
          const { data: sc2 } = await supabase
            .from('subcategories')
            .select('id, service_type_id')
            .eq('code', subCode)
            .maybeSingle();
          if (sc2) {
            finalServiceTypeId = sc2.service_type_id;
            finalSubcategoryId = sc2.id;
          }
        }
      }

      if (!finalServiceTypeId || !finalSubcategoryId) {
        throw new Error('نوع خدمات یا زیرشاخه یافت نشد');
      }

      // استفاده از hierarchyProjectId اگر وجود داشت (از SelectLocation)
      let projectId = hierarchyProjectId;
      let finalLocationId: string | undefined;

      // اگر hierarchyProjectId نداشتیم، باید location و project را ایجاد کنیم
      if (!projectId) {
        // Create or get location
        const { data: existingLocation } = await supabase
          .from('locations')
          .select('id')
          .eq('user_id', user.id)
          .eq('province_id', provinceId)
          .eq('address_line', sanitizedAddress)
          .maybeSingle();

        let locationId = existingLocation?.id;

        if (!locationId) {
          const { data: newLocation, error: locError } = await supabase
            .from('locations')
            .insert([{
              user_id: user.id,
              province_id: provinceId,
              district_id: districtId || null,
              address_line: sanitizedAddress,
              lat: 0,
              lng: 0,
              is_active: true
            }])
            .select('id')
            .single();

          if (locError) throw locError;
          locationId = newLocation.id;
        }

        // ذخیره برای استفاده در navigation
        finalLocationId = locationId;
        
        // در این نسخه لینک به پروژه سلسله‌مراتبی را موقتاً حذف می‌کنیم تا ثبت سفارش بدون خطا انجام شود
        // projectId را خالی می‌گذاریم و فقط از location برای ناوبری استفاده می‌کنیم
        projectId = null as any;
      }

      // ایجاد سفارش به‌صورت اتمیک در دیتابیس (جلوگیری از تکراری شدن کد)
      const { data: createdRows, error: createError } = await supabase.rpc('create_project_v3', {
        _customer_id: customerId,
        _province_id: provinceId,
        _district_id: districtId || null,
        _subcategory_id: finalSubcategoryId,
        _hierarchy_project_id: projectId,
        _address: sanitizedAddress,
        _detailed_address: sanitizedAddress,
        _notes: {
          service_type: activeService,
          dimensions: dimensions.map(d => ({
            length: parseFloat(d.length),
            width: parseFloat(d.width),
            height: parseFloat(d.height),
          })),
          isFacadeWidth2m,
          conditions,
          onGround,
          vehicleReachesSite,
          totalArea: calculateTotalArea(),
          estimated_price: priceData.total,
          price_breakdown: priceData.breakdown,
        } as any
      });

      if (createError) throw createError;
      const createdProject = createdRows?.[0];
      if (!createdProject) throw new Error('خطا در ایجاد سفارش');

      toast({ 
        title: 'ثبت شد', 
        description: `سفارش شما با کد ${createdProject.code} ثبت شد و در انتظار تایید است.` 
      });

      // هدایت کاربر به صفحه پروژه‌های من
      navigate('/user/projects', {
        state: {
          expandLocationId: finalLocationId,
          expandProjectId: projectId,
          highlightOrderId: createdProject.id
        }
      });
    } catch (e: any) {
      console.error('Error:', e);
      toast({ title: 'خطا', description: e.message || 'ثبت با مشکل مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const priceData = calculatePrice();

  return (
    <div className="space-y-6">
      <h1 className="sr-only">فرم ثبت سفارش داربست</h1>

      {/* Location Information */}
      <Card>
        <CardHeader>
          <CardTitle>اطلاعات مکانی</CardTitle>
          <CardDescription>استان و آدرس پروژه را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="province">استان *</Label>
            <Select value={provinceId} onValueChange={setProvinceId}>
              <SelectTrigger id="province">
                <SelectValue placeholder="انتخاب استان" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map(province => (
                  <SelectItem key={province.id} value={province.id}>
                    {province.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provinceId && (
            <div className="space-y-2">
              <Label htmlFor="district">شهرستان (اختیاری)</Label>
              <Select value={districtId} onValueChange={setDistrictId}>
                <SelectTrigger id="district">
                  <SelectValue placeholder="انتخاب شهرستان" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map(district => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="address">آدرس دقیق *</Label>
            <Input
              id="address"
              value={detailedAddress}
              onChange={(e) => setDetailedAddress(e.target.value)}
              placeholder="آدرس کامل پروژه را وارد کنید"
            />
          </div>
        </CardContent>
      </Card>

      {/* Service Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>نوع خدمات</CardTitle>
          <CardDescription>نوع داربست مورد نیاز را انتخاب کنید</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={activeService === 'facade' ? 'default' : 'outline'}
              onClick={() => setActiveService('facade')}
              className="h-auto py-4"
            >
              <div className="text-center">
                <div className="font-semibold">نمای ساختمان</div>
                <div className="text-xs mt-1 opacity-80">Facade</div>
              </div>
            </Button>
            <Button
              type="button"
              variant={activeService === 'formwork' ? 'default' : 'outline'}
              onClick={() => setActiveService('formwork')}
              className="h-auto py-4"
            >
              <div className="text-center">
                <div className="font-semibold">قالب‌بندی</div>
                <div className="text-xs mt-1 opacity-80">Formwork</div>
              </div>
            </Button>
          </div>

          <Collapsible open={ceilingTieredOpen} onOpenChange={setCeilingTieredOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                <span>سقف پله‌ای</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${ceilingTieredOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Button
                type="button"
                variant={activeService === 'ceiling-tiered' ? 'default' : 'outline'}
                onClick={() => setActiveService('ceiling-tiered')}
                className="w-full mt-2"
              >
                انتخاب سقف پله‌ای
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={ceilingSlabOpen} onOpenChange={setCeilingSlabOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                <span>سقف دال</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${ceilingSlabOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Button
                type="button"
                variant={activeService === 'ceiling-slab' ? 'default' : 'outline'}
                onClick={() => setActiveService('ceiling-slab')}
                className="w-full mt-2"
              >
                انتخاب سقف دال
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {activeService === 'facade' && (
            <div className="flex items-center space-x-2 space-x-reverse pt-2">
              <Checkbox
                id="facade-width"
                checked={isFacadeWidth2m}
                onCheckedChange={(checked) => setIsFacadeWidth2m(checked === true)}
              />
              <Label htmlFor="facade-width" className="cursor-pointer">
                عرض داربست 2 متر (به جای 1 متر)
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle>ابعاد</CardTitle>
          <CardDescription>ابعاد به متر وارد شود</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dimensions.map((dim) => (
            <div key={dim.id} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label>طول (متر)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dim.length}
                  onChange={(e) => updateDimension(dim.id, 'length', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label>عرض (متر)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dim.width}
                  onChange={(e) => updateDimension(dim.id, 'width', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label>ارتفاع (متر)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dim.height}
                  onChange={(e) => updateDimension(dim.id, 'height', e.target.value)}
                  placeholder="0"
                />
              </div>
              {dimensions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDimension(dim.id)}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addDimension} className="w-full">
            <Plus className="h-4 w-4 ml-2" />
            افزودن سطر جدید
          </Button>
          <div className="text-sm text-muted-foreground pt-2">
            مجموع مساحت: <span className="font-semibold">{calculateTotalArea().toFixed(2)}</span> متر مکعب
          </div>
        </CardContent>
      </Card>

      {/* Service Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>شرایط سرویس</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>تعداد کل ماه‌ها</Label>
              <Input
                type="number"
                min="1"
                value={conditions.totalMonths}
                onChange={(e) => setConditions({ ...conditions, totalMonths: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>ماه جاری</Label>
              <Input
                type="number"
                min="1"
                max={conditions.totalMonths}
                value={conditions.currentMonth}
                onChange={(e) => setConditions({ ...conditions, currentMonth: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>فاصله از مرکز استان</Label>
            <Select
              value={conditions.distanceRange}
              onValueChange={(v: any) => setConditions({ ...conditions, distanceRange: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-15">0-15 کیلومتر</SelectItem>
                <SelectItem value="15-25">15-25 کیلومتر (+20%)</SelectItem>
                <SelectItem value="25-50">25-50 کیلومتر (+40%)</SelectItem>
                <SelectItem value="50-85">50-85 کیلومتر (+70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>محل نصب داربست</Label>
            <RadioGroup value={onGround ? 'ground' : 'platform'} onValueChange={(v) => setOnGround(v === 'ground')}>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="ground" id="ground" />
                <Label htmlFor="ground" className="cursor-pointer">روی زمین</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="platform" id="platform" />
                <Label htmlFor="platform" className="cursor-pointer">روی سکو/پشت‌بام</Label>
              </div>
            </RadioGroup>

            {!onGround && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>ارتفاع پای کار (متر)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={conditions.platformHeight ?? ''}
                    onChange={(e) => setConditions({ ...conditions, platformHeight: parseFloat(e.target.value) || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ارتفاع داربست از پای کار (متر)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={conditions.scaffoldHeightFromPlatform ?? ''}
                    onChange={(e) => setConditions({ ...conditions, scaffoldHeightFromPlatform: parseFloat(e.target.value) || null })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>دسترسی خودرو</Label>
            <RadioGroup
              value={vehicleReachesSite ? 'reaches' : 'not-reaches'}
              onValueChange={(v) => setVehicleReachesSite(v === 'reaches')}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="reaches" id="reaches" />
                <Label htmlFor="reaches" className="cursor-pointer">خودرو به محل می‌رسد</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="not-reaches" id="not-reaches" />
                <Label htmlFor="not-reaches" className="cursor-pointer">خودرو به محل نمی‌رسد</Label>
              </div>
            </RadioGroup>

            {!vehicleReachesSite && (
              <div className="space-y-2 pt-2">
                <Label>فاصله خودرو تا محل (متر)</Label>
                <Input
                  type="number"
                  step="1"
                  value={conditions.vehicleDistance ?? ''}
                  onChange={(e) => setConditions({ ...conditions, vehicleDistance: parseFloat(e.target.value) || null })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price Summary */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle>خلاصه قیمت</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {priceData.breakdown.map((item, idx) => (
            <div key={idx} className="text-sm text-muted-foreground">{item}</div>
          ))}
          <div className="pt-3 border-t">
            <div className="text-xl font-bold">
              قیمت نهایی: <span className="text-primary">{priceData.total.toLocaleString('fa-IR')}</span> تومان
            </div>
            {priceData.pricePerMeter && (
              <div className="text-sm text-muted-foreground mt-1">
                (قیمت هر متر مکعب: {priceData.pricePerMeter.toLocaleString('fa-IR')} تومان)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={onSubmit} disabled={loading} className="w-full" size="lg">
        {loading ? 'در حال ثبت...' : 'ثبت درخواست'}
      </Button>
    </div>
  );
}
