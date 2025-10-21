import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Building2, MapPin, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeHtml } from '@/lib/security';

interface Province {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface District {
  id: string;
  name: string;
  province_id: string;
}

interface ServiceType {
  id: string;
  name: string;
  code: string;
}

interface Subcategory {
  id: string;
  name: string;
  code: string;
  service_type_id: string;
}

interface Customer {
  id: string;
  user_id: string;
  customer_code: string;
}

export default function NewServiceRequestForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [address, setAddress] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // شناسایی استان قم
  const qomProvince = provinces.find(p => p.code === '10');
  const isQomSelected = selectedProvince === qomProvince?.id;
  const isOtherProvinceSelected = selectedProvince && !isQomSelected;

  useEffect(() => {
    loadInitialData();
  }, [user]);

  useEffect(() => {
    if (selectedProvince) {
      loadDistricts(selectedProvince);
    } else {
      setDistricts([]);
      setSelectedDistrict('');
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedServiceType) {
      loadSubcategories(selectedServiceType);
    } else {
      setSubcategories([]);
      setSelectedSubcategory('');
    }
  }, [selectedServiceType]);

  const loadInitialData = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      setDataLoading(true);
      
      // بارگذاری استان‌ها
      const { data: provincesData, error: provincesError } = await supabase
        .from('provinces')
        .select('*')
        .order('name');

      if (provincesError) throw provincesError;
      setProvinces(provincesData || []);

      // تنظیم پیش‌فرض قم
      const qom = provincesData?.find(p => p.code === '10');
      if (qom) {
        setSelectedProvince(qom.id);
      }

      // بارگذاری انواع خدمات
      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('service_types_v3')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (serviceTypesError) throw serviceTypesError;
      setServiceTypes(serviceTypesData || []);

      // تنظیم پیش‌فرض داربست فلزی
      const scaffolding = serviceTypesData?.find(st => st.code === '10');
      if (scaffolding) {
        setSelectedServiceType(scaffolding.id);
      }

      // بارگذاری یا ایجاد رکورد مشتری
      let { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerError && customerError.code !== 'PGRST116') {
        throw customerError;
      }

      // اگر مشتری وجود نداشت، ایجاد کن
      if (!customerData) {
        const { data: newCustomerData, error: insertError } = await supabase
          .from('customers')
          .insert([{ user_id: user.id }])
          .select()
          .single();

        if (insertError) throw insertError;
        customerData = newCustomerData;
      }

      setCustomer(customerData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('خطا در بارگذاری اطلاعات: ' + error.message);
    } finally {
      setDataLoading(false);
    }
  };

  const loadDistricts = async (provinceId: string) => {
    try {
      const { data, error } = await supabase
        .from('districts')
        .select('*')
        .eq('province_id', provinceId)
        .order('name');

      if (error) throw error;
      setDistricts(data || []);

      // تنظیم پیش‌فرض شهر قم
      const qomCity = data?.find(d => d.name === 'شهر قم');
      if (qomCity) {
        setSelectedDistrict(qomCity.id);
      }
    } catch (error: any) {
      console.error('Error loading districts:', error);
      toast.error('خطا در بارگذاری مناطق');
    }
  };

  const loadSubcategories = async (serviceTypeId: string) => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('service_type_id', serviceTypeId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setSubcategories(data || []);

      // تنظیم پیش‌فرض "با مصالح"
      const withMaterials = data?.find(sc => sc.code === '01');
      if (withMaterials) {
        setSelectedSubcategory(withMaterials.id);
      }
    } catch (error: any) {
      console.error('Error loading subcategories:', error);
      toast.error('خطا در بارگذاری زیرشاخه‌ها');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer) {
      toast.error('خطا: اطلاعات مشتری یافت نشد');
      return;
    }

    if (!selectedProvince || !selectedSubcategory || !address.trim()) {
      toast.error('لطفاً تمام فیلدهای الزامی را پر کنید');
      return;
    }

    // بررسی استان قم
    if (!isQomSelected) {
      toast.error('در حال حاضر فقط در استان قم خدمات ارائه می‌دهیم');
      return;
    }

    if (!selectedDistrict) {
      toast.error('لطفاً منطقه را انتخاب کنید');
      return;
    }

    // Validate and sanitize inputs
    const serviceRequestValidation = z.object({
      address: z.string()
        .trim()
        .min(10, { message: 'آدرس باید حداقل 10 کاراکتر باشد' })
        .max(500, { message: 'آدرس نباید بیش از 500 کاراکتر باشد' }),
      detailedAddress: z.string()
        .max(500, { message: 'آدرس تکمیلی نباید بیش از 500 کاراکتر باشد' })
        .optional(),
      notes: z.string()
        .max(2000, { message: 'یادداشت‌ها نباید بیش از 2000 کاراکتر باشد' })
        .optional()
    });

    try {
      serviceRequestValidation.parse({
        address: address.trim(),
        detailedAddress: detailedAddress?.trim(),
        notes: notes?.trim()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    // Sanitize inputs
    const sanitizedAddress = sanitizeHtml(address.trim());
    const sanitizedDetailedAddress = detailedAddress ? sanitizeHtml(detailedAddress.trim()) : '';
    const sanitizedNotes = notes ? sanitizeHtml(notes.trim()) : '';

    setLoading(true);
    try {
      // Get service type id
      const { data: serviceTypeData } = await supabase
        .from('service_types_v3')
        .select('id')
        .eq('id', selectedServiceType)
        .single();

      if (!serviceTypeData) throw new Error('نوع خدمات یافت نشد');

      // Create or get location
      const { data: existingLocation } = await supabase
        .from('locations')
        .select('id')
        .eq('user_id', user.id)
        .eq('province_id', selectedProvince)
        .eq('address_line', sanitizedAddress)
        .maybeSingle();

      let locationId = existingLocation?.id;

      if (!locationId) {
        const { data: newLocation, error: locError } = await supabase
          .from('locations')
          .insert([{
            user_id: user.id,
            province_id: selectedProvince,
            district_id: selectedDistrict || null,
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

      // Get or create project in hierarchy
      const { data: hierarchyProjectId, error: hierarchyError } = await supabase
        .rpc('get_or_create_project', {
          _user_id: user.id,
          _location_id: locationId,
          _service_type_id: serviceTypeData.id,
          _subcategory_id: selectedSubcategory
        });

      if (hierarchyError) throw hierarchyError;

      // ایجاد سفارش به صورت اتمیک و لینک به hierarchy
      const { data: createdRows, error: createError } = await supabase
        .rpc('create_project_v3', {
          _customer_id: customer.id,
          _province_id: selectedProvince,
          _district_id: selectedDistrict || null,
          _subcategory_id: selectedSubcategory,
          _hierarchy_project_id: hierarchyProjectId,
          _address: sanitizedAddress,
          _detailed_address: sanitizedDetailedAddress || null,
          _notes: sanitizedNotes ? { raw: sanitizedNotes } as any : null
        });

      if (createError) throw createError;
      const createdProject = createdRows?.[0];
      if (!createdProject) throw new Error('خطا در ایجاد پروژه');

      toast.success('درخواست شما با موفقیت ثبت شد', {
        description: `کد پروژه: ${createdProject.code}`
      });

      // اتوماسیون اداری حالا با database trigger اجرا می‌شود (order-automation function حذف شد)

      // انتقال به داشبورد پروژه‌ها
      navigate('/user/projects');
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error('خطا در ثبت درخواست: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-2xl space-y-6">
        {/* دکمه بازگشت */}
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت
        </Button>

        {/* کارت اصلی فرم */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              فرم درخواست خدمات
            </CardTitle>
            <CardDescription>
              اطلاعات پروژه خود را وارد کنید
            </CardDescription>
            {customer && (
              <p className="text-sm text-muted-foreground mt-2">
                کد مشتری شما: <span className="font-mono font-bold">{customer.customer_code}</span>
              </p>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* انتخاب استان */}
              <div className="space-y-2">
                <Label htmlFor="province">
                  استان <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
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

              {/* پیام برای استان‌های غیر قم */}
              {isOtherProvinceSelected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    خدمات ما به زودی در استان شما نیز ارائه خواهد شد.
                  </AlertDescription>
                </Alert>
              )}

              {/* انتخاب منطقه (فقط برای قم) */}
              {isQomSelected && districts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="district">
                    منطقه <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                    <SelectTrigger id="district">
                      <SelectValue placeholder="انتخاب منطقه" />
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

              {/* نوع خدمات */}
              <div className="space-y-2">
                <Label htmlFor="serviceType">
                  نوع خدمات <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
                  <SelectTrigger id="serviceType">
                    <SelectValue placeholder="انتخاب نوع خدمات" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map(serviceType => (
                      <SelectItem key={serviceType.id} value={serviceType.id}>
                        {serviceType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* زیرشاخه */}
              {subcategories.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">
                    زیرشاخه <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                    <SelectTrigger id="subcategory">
                      <SelectValue placeholder="انتخاب زیرشاخه" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map(subcategory => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* آدرس */}
              <div className="space-y-2">
                <Label htmlFor="address">
                  <MapPin className="inline h-4 w-4 ml-1" />
                  آدرس <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="آدرس کامل پروژه را وارد کنید (حداکثر 500 کاراکتر)"
                  required
                  disabled={isOtherProvinceSelected}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-left">
                  {address.length}/500 کاراکتر
                </p>
              </div>

              {/* آدرس تکمیلی */}
              {isQomSelected && (
                <div className="space-y-2">
                  <Label htmlFor="detailedAddress">
                    آدرس تکمیلی (اختیاری)
                  </Label>
                  <Input
                    id="detailedAddress"
                    value={detailedAddress}
                    onChange={(e) => setDetailedAddress(e.target.value)}
                    placeholder="پلاک، واحد، کوچه و ... (حداکثر 500 کاراکتر)"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-left">
                    {detailedAddress.length}/500 کاراکتر
                  </p>
                </div>
              )}

              {/* یادداشت */}
              {isQomSelected && (
                <div className="space-y-2">
                  <Label htmlFor="notes">
                    توضیحات تکمیلی (اختیاری)
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="هر گونه توضیحات اضافی در مورد پروژه... (حداکثر 2000 کاراکتر)"
                    rows={3}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-left">
                    {notes.length}/2000 کاراکتر
                  </p>
                </div>
              )}

              {/* دکمه ارسال */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || isOtherProvinceSelected}
              >
                {loading ? 'در حال ثبت...' : 'ثبت درخواست'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
