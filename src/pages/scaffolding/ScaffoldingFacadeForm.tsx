import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Plus, Trash2, AlertCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { sendOrderSms } from '@/lib/orderSms';

// Import comprehensive validation schemas
import { orderDimensionSchema, orderFormSchema } from '@/lib/validations';
import { sanitizeHtml } from '@/lib/security';
import { getOrCreateProjectSchema, createProjectV3Schema } from '@/lib/rpcValidation';

interface Dimension {
  id: string;
  length: string;
  height: string;
}

export default function ScaffoldingFacadeForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Use form persistence to save user's progress
  const { formData, updateField, clearForm, isLoaded: formLoaded } = useFormPersistence('scaffolding-facade', {
    projectAddress: '',
    durationMonths: '',
  });
  
  const [projectAddress, setProjectAddress] = useState('');
  const [dimensions, setDimensions] = useState<Dimension[]>([
    { id: '1', length: '', height: '' }
  ]);
  const [durationMonths, setDurationMonths] = useState<string>('');
  const [projectLocation, setProjectLocation] = useState<{
    address: string;
    coordinates: [number, number];
    distance: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // بيانات النظام
  const [customer, setCustomer] = useState<any>(null);
  const [qomProvinceId, setQomProvinceId] = useState<string>('');
  const [qomCityId, setQomCityId] = useState<string>('');
  const [scaffoldingServiceId, setScaffoldingServiceId] = useState<string>('');
  const [withMaterialsSubcategoryId, setWithMaterialsSubcategoryId] = useState<string>('');

  useEffect(() => {
    loadInitialData();
  }, [user]);

  // Load saved form data when available
  useEffect(() => {
    if (formLoaded && formData.projectAddress) {
      setProjectAddress(formData.projectAddress);
    }
    if (formLoaded && formData.durationMonths) {
      setDurationMonths(formData.durationMonths);
    }
  }, [formLoaded]);

  // Save form data as user types
  useEffect(() => {
    if (formLoaded) {
      updateField('projectAddress', projectAddress);
    }
  }, [projectAddress, formLoaded]);

  useEffect(() => {
    if (formLoaded) {
      updateField('durationMonths', durationMonths);
    }
  }, [durationMonths, formLoaded]);

  const loadInitialData = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    try {
      setDataLoading(true);

      // تحميل استان قم
      const { data: qom } = await supabase
        .from('provinces')
        .select('id')
        .eq('code', '10')
        .single();
      
      if (qom) setQomProvinceId(qom.id);

      // تحميل شهر قم
      const { data: qomCity } = await supabase
        .from('districts')
        .select('id')
        .eq('name', 'شهر قم')
        .maybeSingle();
      
      if (qomCity) setQomCityId(qomCity.id);

      // تحميل نوع خدمة داربست فلزي
      const { data: scaffolding } = await supabase
        .from('service_types_v3')
        .select('id')
        .eq('code', '10')
        .single();
      
      if (scaffolding) setScaffoldingServiceId(scaffolding.id);

      // تحميل زيرشاخه "با مصالح" (کد 10)
      if (scaffolding) {
        const { data: withMaterials } = await supabase
          .from('subcategories')
          .select('id')
          .eq('service_type_id', scaffolding.id)
          .eq('code', '10')
          .single();
        
        if (withMaterials) setWithMaterialsSubcategoryId(withMaterials.id);
      }

      // تحميل أو إنشاء سجل المشتري
      let { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!customerData) {
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert([{ user_id: user.id }])
          .select()
          .single();
        
        if (insertError) {
          console.error('خطا در ایجاد مشتری:', insertError);
          throw new Error('امکان ایجاد حساب مشتری وجود ندارد. لطفاً با پشتیبانی تماس بگیرید.');
        }
        
        customerData = newCustomer;
      }

      if (!customerData) {
        throw new Error('برای شما حساب مشتری یافت نشد. لطفاً با پشتیبانی تماس بگیرید.');
      }

      setCustomer(customerData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'خطا در بارگذاری اطلاعات',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDataLoading(false);
    }
  };

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

  const calculatePrice = (area: number, months: string): number => {
    const monthsPricing = {
      '1': { base50: 3200000, base100: 4200000, perMeter: 45000 },
      '2': { base50: 3000000, base100: 4000000, perMeter: 42000 },
      '3+': { base50: 2800000, base100: 3800000, perMeter: 39000 },
    };

    const pricing = monthsPricing[months as keyof typeof monthsPricing];
    if (!pricing) return 0;

    if (area <= 50) {
      return pricing.base50;
    } else if (area <= 100) {
      return pricing.base100;
    } else {
      return area * pricing.perMeter;
    }
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

    if (!durationMonths) {
      newErrors.durationMonths = 'انتخاب مدت زمان الزامی است';
    }

    // Individual dimension validation for better error messages
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
        description: 'اطلاعات سیستم کامل نیست. لطفاً صفحه را رفرش کنید',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const totalArea = calculateTotalArea();
      const estimatedPrice = calculatePrice(totalArea, durationMonths);

      const dimensionsData = dimensions.map(d => ({
        length: parseFloat(d.length),
        height: parseFloat(d.height),
        area: parseFloat(d.length) * parseFloat(d.height)
      }));

      // ایجاد یا پیدا کردن پروژه در ساختار سلسله‌مراتبی
      let hierarchyProjectId: string | null = null;
      const locationId = localStorage.getItem('selectedLocationId');
      
      if (locationId && scaffoldingServiceId && withMaterialsSubcategoryId) {
        try {
          const validated = getOrCreateProjectSchema.parse({
            _user_id: user.id,
            _location_id: locationId,
            _service_type_id: scaffoldingServiceId,
            _subcategory_id: withMaterialsSubcategoryId
          });
          const { data: projectId, error: hierarchyError } = await supabase.rpc('get_or_create_project', validated as { _user_id: string; _location_id: string; _service_type_id: string; _subcategory_id: string });
          
          if (!hierarchyError && projectId) {
            hierarchyProjectId = projectId;
          }
        } catch (error) {
          console.error('خطا در ایجاد پروژه سلسله‌مراتبی:', error);
        }
      }

      // ایجاد سفارش به صورت اتمیک با لینک به پروژه سلسله‌مراتبی
      const validated = createProjectV3Schema.parse({
        _customer_id: customer.id,
        _province_id: qomProvinceId,
        _district_id: qomCityId || null,
        _subcategory_id: withMaterialsSubcategoryId,
        _hierarchy_project_id: hierarchyProjectId,
        _address: projectAddress,
        _detailed_address: projectLocation
          ? `موقعیت: ${projectLocation.coordinates[1]},${projectLocation.coordinates[0]} - فاصله: ${projectLocation.distance}km`
          : null,
        _notes: JSON.stringify({
          service_type: 'facade_with_materials',
          dimensions: dimensionsData,
          total_area: totalArea,
          duration_months: durationMonths,
          estimated_price: estimatedPrice
        })
      });
      const { data: createdRows, error: createError } = await supabase.rpc('create_project_v3', validated as any);

      if (createError) throw createError;
      const createdProject = createdRows?.[0];
      if (!createdProject) throw new Error('خطا در ایجاد سفارش');

      // Clear the saved form data after successful submission
      clearForm();

      toast({
        title: '✅ سفارش با موفقیت ثبت شد',
        description: `کد پروژه: ${createdProject.code}\nسفارش شما در انتظار تایید مدیرعامل است.`,
        duration: 5000,
      });

      // ارسال پیامک تایید ثبت سفارش به مشتری (در پس‌زمینه)
      if (user?.phone) {
        sendOrderSms(user.phone, createdProject.code, 'submitted', {
          serviceType: 'داربست نما',
          address: projectAddress || 'ثبت نشده'
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      // ارسال نوتیفیکیشن به مدیران (در پس‌زمینه)
      supabase.functions.invoke('notify-managers-new-order', {
        body: {
          order_code: createdProject.code,
          order_id: createdProject.id,
          customer_name: user?.user_metadata?.full_name || '',
          customer_phone: user?.phone || '',
          service_type: 'داربست نما'
        }
      }).catch(err => {
        console.error('Notify managers error:', err);
      });

      // Navigate after a short delay to let user see the success message
      setTimeout(() => {
        navigate('/user/projects');
      }, 1500);
    } catch (error: any) {
      console.error('خطا در ثبت درخواست:', error);
      
      let errorMessage = 'مشکلی در ثبت درخواست پیش آمد. لطفاً دوباره تلاش کنید.';
      
      // Provide more specific error messages
      if (error.message?.includes('generate_project_code')) {
        errorMessage = 'خطا در تولید کد پروژه. لطفاً با پشتیبانی تماس بگیرید.';
      } else if (error.message?.includes('projects_v3')) {
        errorMessage = 'خطا در ذخیره پروژه. لطفاً اطلاعات را بررسی کرده و دوباره امتحان کنید.';
      } else if (error.code === '23505') {
        errorMessage = 'این پروژه قبلاً ثبت شده است.';
      } else if (error.code === 'PGRST116') {
        errorMessage = 'دسترسی به دیتابیس ممکن نیست. لطفاً ابتدا وارد حساب کاربری شوید.';
      }
      
      toast({
        title: '❌ خطا در ثبت سفارش',
        description: errorMessage,
        variant: 'destructive',
        duration: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

  const totalArea = calculateTotalArea();
  const estimatedPrice = durationMonths ? calculatePrice(totalArea, durationMonths) : 0;

  if (dataLoading) {
    return (
      <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
      <CardHeader>
        <CardTitle className="text-xl">فرم درخواست داربست نما و سطحی</CardTitle>
        <CardDescription>لطفاً اطلاعات پروژه خود را با دقت وارد کنید</CardDescription>
      </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Address */}
              <div className="space-y-2">
                <Label htmlFor="projectAddress">آدرس محل پروژه *</Label>
                <Input
                  id="projectAddress"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  placeholder="آدرس کامل پروژه را وارد کنید"
                  className={errors.projectAddress ? 'border-destructive' : ''}
                />
                {errors.projectAddress && (
                  <p className="text-sm text-destructive">{errors.projectAddress}</p>
                )}
              </div>

              {/* Dimensions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>ابعاد داربست (برای محاسبه متراژ)</Label>
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
                </div>

                {dimensions.map((dim, index) => (
                  <Card key={dim.id} className="p-4 bg-card/90 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>طول داربست (متر)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={dim.length}
                            onChange={(e) => updateDimension(dim.id, 'length', e.target.value)}
                            placeholder="مثال: 6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ارتفاع داربست (متر)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={dim.height}
                            onChange={(e) => updateDimension(dim.id, 'height', e.target.value)}
                            placeholder="مثال: 9"
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
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {errors[`dimension${dim.id}`] && (
                      <p className="text-sm text-destructive mt-2">{errors[`dimension${dim.id}`]}</p>
                    )}
                  </Card>
                ))}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    جمع متراژ داربست: <strong>{totalArea.toFixed(2)} متر مربع</strong>
                  </AlertDescription>
                </Alert>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="durationMonths">شرایط تعداد ماه *</Label>
                <Select value={durationMonths} onValueChange={setDurationMonths}>
                  <SelectTrigger className={errors.durationMonths ? 'border-destructive' : ''}>
                    <SelectValue placeholder="انتخاب کنید..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover backdrop-blur-md border-2 z-[100]">
                    <SelectItem value="1">به شرط یک ماه</SelectItem>
                    <SelectItem value="2">به شرط دو ماه</SelectItem>
                    <SelectItem value="3+">به شرط سه ماه و بیشتر</SelectItem>
                  </SelectContent>
                </Select>
                {errors.durationMonths && (
                  <p className="text-sm text-destructive">{errors.durationMonths}</p>
                )}
              </div>

              {/* Price Estimate */}
              {estimatedPrice > 0 && (
                <Alert className="bg-primary/10 border-primary">
                  <AlertDescription className="text-lg font-semibold">
                    قیمت تخمینی: {estimatedPrice.toLocaleString('fa-IR')} تومان
                  </AlertDescription>
                </Alert>
              )}


              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={loading || dataLoading}
                  className="flex-1 construction-gradient"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      در حال ثبت سفارش...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      ثبت سفارش
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  انصراف
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
  );
}
