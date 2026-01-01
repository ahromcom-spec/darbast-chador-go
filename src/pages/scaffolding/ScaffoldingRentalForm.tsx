import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Building2, MapPin, Package, Upload } from 'lucide-react';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MediaUploader } from '@/components/orders/MediaUploader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { sendOrderSms } from '@/lib/orderSms';

const rentalFormSchema = z.object({
  itemType: z.string().min(1, 'لطفا نوع جنس را انتخاب کنید'),
  itemSubType: z.string().min(1, 'لطفا زیرمجموعه را انتخاب کنید'),
  quantity: z.number()
    .min(1, 'تعداد حداقل باید 1 باشد')
    .max(600, 'تعداد حداکثر باید 600 باشد'),
  rentalStartDate: z.string().min(1, 'تاریخ شروع اجاره را انتخاب کنید'),
  rentalEndDate: z.string().min(1, 'تاریخ پایان اجاره را انتخاب کنید'),
  additionalNotes: z.string().optional(),
});

type RentalFormValues = z.infer<typeof rentalFormSchema>;

const ITEM_TYPES = {
  cross_screw: {
    label: 'پیچ تنظیم صلیبی یک متری',
    price: 60000,
    subTypes: {
      bowl_screw: {
        label: 'پیچ تنظیم کاسه‌ای 70 سانتی',
        price: 40000,
      }
    }
  }
};

export default function ScaffoldingRentalForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const editOrderId = searchParams.get('edit');
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<string>('');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  
  // Extract service selection data
  const stateData = location.state || {};
  const serviceSelection = stateData?.serviceSelection || stateData;
  const {
    hierarchyProjectId: stateHierarchyProjectId,
    // ✅ داده‌های لازم برای ساخت/یافتن پروژه سلسله‌مراتبی وقتی مستقیم از نقشه می‌آید
    locationId: stateLocationId = serviceSelection?.locationId,
    serviceTypeId: stateServiceTypeId = serviceSelection?.serviceTypeId,

    provinceId: stateProvinceId,
    districtId: stateDistrictId,
    subcategoryId: stateSubcategoryId = serviceSelection?.subcategoryId,
    serviceName: stateServiceName = serviceSelection?.serviceName,
    subcategoryName: stateSubcategoryName = serviceSelection?.subcategoryName,
    locationAddress: stateLocationAddress,
    locationTitle: stateLocationTitle,
    provinceName: stateProvinceName,
    districtName: stateDistrictName
  } = stateData;

  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: {
      itemType: '',
      itemSubType: '',
      quantity: 1,
      rentalStartDate: '',
      rentalEndDate: '',
      additionalNotes: '',
    }
  });

  const itemType = form.watch('itemType');
  const itemSubType = form.watch('itemSubType');
  const quantity = form.watch('quantity');

  // Fetch order data if editing
  useEffect(() => {
    if (editOrderId) {
      fetchOrderData();
    }
  }, [editOrderId]);

  const fetchOrderData = async () => {
    if (!editOrderId) return;
    
    setLoadingOrder(true);
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          *,
          subcategory:subcategories!projects_v3_subcategory_id_fkey (
            id,
            name,
            code
          ),
          province:provinces!projects_v3_province_id_fkey (
            id,
            name
          ),
          district:districts!projects_v3_district_id_fkey (
            id,
            name
          )
        `)
        .eq('id', editOrderId)
        .maybeSingle();

      if (error) throw error;
      
      if (data && data.notes) {
        setOrderData(data);
        
        // Parse notes to populate form
        const notes = typeof data.notes === 'string' ? JSON.parse(data.notes) : data.notes;
        
        // Find matching item type
        let foundItemType = '';
        let foundSubType = '';
        
        if (notes.item_type) {
          Object.entries(ITEM_TYPES).forEach(([key, value]) => {
            if (value.label === notes.item_type) {
              foundItemType = key;
            }
          });
        }
        
        if (notes.item_sub_type && foundItemType) {
          const itemTypeData = ITEM_TYPES[foundItemType as keyof typeof ITEM_TYPES];
          if (itemTypeData?.subTypes) {
            Object.entries(itemTypeData.subTypes).forEach(([key, value]) => {
              if (value.label === notes.item_sub_type) {
                foundSubType = key;
              }
            });
          }
        }
        
        form.reset({
          itemType: foundItemType,
          itemSubType: foundSubType,
          quantity: notes.quantity || 1,
          rentalStartDate: notes.rental_start_date || '',
          rentalEndDate: notes.rental_end_date || '',
          additionalNotes: notes.additional_notes || '',
        });
      }
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری اطلاعات سفارش',
        variant: 'destructive'
      });
      navigate('/');
    } finally {
      setLoadingOrder(false);
    }
  };

  // Merge order data with state data
  const hierarchyProjectId = orderData?.hierarchy_project_id || stateHierarchyProjectId;
  const provinceId = orderData?.province_id || stateProvinceId;
  const districtId = orderData?.district_id || stateDistrictId;
  const subcategoryId = orderData?.subcategory_id || stateSubcategoryId;
  const serviceName = orderData?.subcategory?.service_type?.name || stateServiceName || 'داربست فلزی';
  const subcategoryName = orderData?.subcategory?.name || stateSubcategoryName;
  const locationAddress = orderData?.address || stateLocationAddress;
  const locationTitle = orderData?.detailed_address || stateLocationTitle;
  const provinceName = orderData?.province?.name || stateProvinceName;
  const districtName = orderData?.district?.name || stateDistrictName;
  const customerName = orderData?.customer_name;
  const customerPhone = orderData?.customer_phone;

  // Show loading spinner while fetching order data
  if (loadingOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="در حال بارگذاری اطلاعات سفارش..." />
      </div>
    );
  }

  // Calculate total price
  const calculateTotal = () => {
    if (!itemType || !quantity) return 0;
    
    const mainItemPrice = ITEM_TYPES[itemType as keyof typeof ITEM_TYPES]?.price || 0;
    const subItemPrice = itemSubType && ITEM_TYPES[itemType as keyof typeof ITEM_TYPES]?.subTypes?.[itemSubType as keyof typeof ITEM_TYPES.cross_screw.subTypes]?.price || 0;
    
    return (mainItemPrice + subItemPrice) * quantity;
  };

  const onSubmit = async (values: RentalFormValues) => {
    if (!user) {
      toast({
        title: 'خطا',
        description: 'لطفا ابتدا وارد حساب کاربری خود شوید',
        variant: 'destructive'
      });
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      // Get customer ID
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customerData) {
        throw new Error('اطلاعات مشتری یافت نشد');
      }

      const orderNotes = {
        service_type: 'کرایه اجناس داربست',
        item_type: ITEM_TYPES[values.itemType as keyof typeof ITEM_TYPES]?.label,
        item_sub_type: values.itemSubType ? ITEM_TYPES[values.itemType as keyof typeof ITEM_TYPES]?.subTypes?.[values.itemSubType as keyof typeof ITEM_TYPES.cross_screw.subTypes]?.label : null,
        quantity: values.quantity,
        rental_start_date: values.rentalStartDate,
        rental_end_date: values.rentalEndDate,
        total_price: calculateTotal(),
        additional_notes: values.additionalNotes,
      };

      // ✅ اطمینان از وجود hierarchyProjectId (در حالت جدید ممکن است فقط locationId داشته باشیم)
      let finalHierarchyProjectId = hierarchyProjectId;

      if (!finalHierarchyProjectId && user && stateLocationId && stateServiceTypeId && subcategoryId) {
        const { data: projectId, error: projectError } = await supabase.rpc('get_or_create_project', {
          _user_id: user.id,
          _location_id: stateLocationId,
          _service_type_id: stateServiceTypeId,
          _subcategory_id: subcategoryId,
        });

        if (projectError) throw projectError;
        finalHierarchyProjectId = projectId;
      }

      if (!finalHierarchyProjectId) {
        throw new Error('شناسه پروژه یافت نشد. لطفاً مجدداً تلاش کنید.');
      }

      const { data: orderData, error: orderError } = await supabase
        .rpc('create_project_v3', {
          _customer_id: customerData.id,
          _province_id: provinceId || null,
          _district_id: districtId || null,
          _subcategory_id: subcategoryId,
          _hierarchy_project_id: finalHierarchyProjectId, // ✅ حتماً باید مقدار داشته باشد
          _address: locationAddress || 'آدرس ثبت نشده - کرایه اجناس',
          _detailed_address: locationTitle || null,
          _notes: orderNotes,
        });

      if (orderError) throw orderError;

      // Save order ID for media upload (orderData is the order ID string)
      const orderId = Array.isArray(orderData) ? orderData[0]?.id : orderData;
      const orderCode = Array.isArray(orderData) ? orderData[0]?.code : null;
      setCreatedOrderId(orderId);

      // ارسال نوتیفیکیشن به مدیران (در پس‌زمینه)
      supabase.functions.invoke('notify-managers-new-order', {
        body: {
          order_code: orderCode || orderId,
          order_id: orderId,
          customer_name: user?.user_metadata?.full_name || '',
          customer_phone: user?.user_metadata?.phone_number || user?.phone || '',
          service_type: 'کرایه اجناس داربست'
        }
      }).catch(err => {
        console.error('Notify managers error:', err);
      });

      // ارسال پیامک به مشتری (در پس‌زمینه)
      const customerPhone = user?.user_metadata?.phone_number || user?.phone;
      if (customerPhone && orderCode) {
        sendOrderSms(customerPhone, orderCode, 'submitted', {
          orderId: orderId,
          serviceType: 'کرایه اجناس داربست',
          address: locationAddress || 'ثبت نشده'
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      toast({
        title: '✅ سفارش ثبت شد',
        description: 'سفارش کرایه اجناس شما با موفقیت ثبت شد. می‌توانید تصاویر مرتبط را آپلود کنید.',
      });
    } catch (error: any) {
      console.error('خطا در ثبت سفارش:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ثبت سفارش',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!subcategoryId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">خطا</CardTitle>
            <CardDescription>
              اطلاعات خدمات دریافت نشد. لطفا مجدداً از صفحه اصلی اقدام کنید.
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
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/hero-background.webp)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>
      
      <div className="relative z-10 container mx-auto px-4 max-w-5xl py-8">
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
                <Building2 className="h-6 w-6" />
                {editOrderId ? `جزئیات سفارش - کد: ${orderData?.code}` : `فرم ثبت سفارش ${serviceName || 'کرایه اجناس داربست'}`}
              </CardTitle>
              {editOrderId && orderData && (
                <CardDescription className="text-base font-semibold">
                  وضعیت: {
                    orderData.status === 'pending' ? 'در انتظار تایید' :
                    orderData.status === 'approved' ? 'تایید شده' :
                    orderData.status === 'in_progress' ? 'در حال اجرا' :
                    orderData.status === 'completed' ? 'تکمیل شده' :
                    orderData.status === 'rejected' ? 'رد شده' :
                    orderData.status
                  }
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="pt-6 pb-4 border-b bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locationAddress && (
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
                )}

                <Alert className="border-primary/30">
                  <Package className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">نوع خدمات:</p>
                      <p className="text-sm">{serviceName || 'داربست فلزی'}</p>
                      <p className="text-xs text-muted-foreground">{subcategoryName || 'خدمات کرایه اجناس'}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>

            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Item Selection Section */}
                  <Card className="border-2 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-lg">نوع اجناس خود را انتخاب کنید</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="itemType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>نوع جنس اصلی *</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedItemType(value);
                                form.setValue('itemSubType', '');
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="انتخاب کنید..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(ITEM_TYPES).map(([key, item]) => (
                                  <SelectItem key={key} value={key}>
                                    {item.label} - {item.price.toLocaleString('fa-IR')} تومان
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedItemType && (
                        <FormField
                          control={form.control}
                          name="itemSubType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>زیرمجموعه *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="انتخاب کنید..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.entries(ITEM_TYPES[selectedItemType as keyof typeof ITEM_TYPES]?.subTypes || {}).map(([key, subItem]) => (
                                    <SelectItem key={key} value={key}>
                                      {subItem.label} - {subItem.price.toLocaleString('fa-IR')} تومان
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>تعداد (حداکثر 600) *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={600}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Total Price Display */}
                      {quantity > 0 && itemType && (
                        <Alert className="border-green-500/50 bg-green-500/10">
                          <AlertDescription>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold">مجموع قیمت کرایه:</span>
                              <span className="text-xl font-bold text-green-600">
                                {calculateTotal().toLocaleString('fa-IR')} تومان
                              </span>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Date Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rentalStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>تاریخ شروع اجاره *</FormLabel>
                          <FormControl>
                            <PersianDatePicker
                              value={field.value}
                              onChange={(date) => field.onChange(date)}
                              placeholder="انتخاب تاریخ شروع"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rentalEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>تاریخ پایان اجاره *</FormLabel>
                          <FormControl>
                            <PersianDatePicker
                              value={field.value}
                              onChange={(date) => field.onChange(date)}
                              placeholder="انتخاب تاریخ پایان"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Additional Notes */}
                  <FormField
                    control={form.control}
                    name="additionalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>توضیحات تکمیلی (اختیاری)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="توضیحات اضافی خود را اینجا بنویسید..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image Upload Section - Show after order creation */}
                  {createdOrderId && (
                    <Card className="border-2 border-primary/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Upload className="h-5 w-5" />
                          آپلود تصاویر (اختیاری)
                        </CardTitle>
                        <CardDescription>
                          تصاویر مرتبط با سفارش خود را آپلود کنید
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <MediaUploader projectId={createdOrderId} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Submit Button */}
                  <div className="flex gap-3">
                    {!createdOrderId ? (
                      <>
                        <Button
                          type="submit"
                          size="lg"
                          className="flex-1"
                          disabled={loading}
                        >
                          {loading ? 'در حال ثبت...' : 'ثبت سفارش'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={() => navigate(-1)}
                        >
                          انصراف
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="lg"
                        className="flex-1"
                        onClick={() => navigate('/profile?tab=orders')}
                      >
                        مشاهده سفارشات من
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
