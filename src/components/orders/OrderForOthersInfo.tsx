import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Users, 
  User, 
  ArrowRight,
  Clock,
  Check,
  X,
  Phone,
  AlertTriangle
} from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface OrderForOthersData {
  id: string;
  from_user_id: string;
  from_name: string;
  from_phone: string;
  to_user_id: string | null;
  to_name: string | null;
  to_phone: string;
  status: string;
  created_at: string;
}

interface OrderForOthersInfoProps {
  orderId: string;
  onStatusChange?: () => void;
}

export function OrderForOthersInfo({ orderId, onStatusChange }: OrderForOthersInfoProps) {
  const [data, setData] = useState<OrderForOthersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrderForOthersData();
  }, [orderId]);

  const fetchOrderForOthersData = async () => {
    try {
      setLoading(true);
      
      // دریافت درخواست انتقال با وضعیت "سفارش برای دیگران"
      const { data: transferData, error } = await supabase
        .from('order_transfer_requests')
        .select('*')
        .eq('order_id', orderId)
        .in('status', ['pending_recipient', 'pending_registration', 'accepted', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching transfer data:', error);
        return;
      }

      if (!transferData) {
        setData(null);
        return;
      }

      // دریافت اطلاعات ثبت‌کننده
      const { data: fromProfile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', transferData.from_user_id)
        .maybeSingle();

      // دریافت اطلاعات گیرنده (اگر ثبت‌نام کرده)
      let toName = null;
      if (transferData.to_user_id) {
        const { data: toProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', transferData.to_user_id)
          .maybeSingle();
        toName = toProfile?.full_name;
      }

      setData({
        id: transferData.id,
        from_user_id: transferData.from_user_id,
        from_name: fromProfile?.full_name || 'کاربر',
        from_phone: fromProfile?.phone_number || '',
        to_user_id: transferData.to_user_id,
        to_name: toName,
        to_phone: transferData.to_phone_number,
        status: transferData.status,
        created_at: transferData.created_at
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!data || !user) return;
    
    try {
      setAccepting(true);

      // 1. دریافت اطلاعات سفارش
      const { data: order, error: orderFetchError } = await supabase
        .from('projects_v3')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderFetchError) throw orderFetchError;
      if (!order) throw new Error('سفارش یافت نشد');

      // 2. دریافت اطلاعات زیرشاخه
      const { data: subcategory } = await supabase
        .from('subcategories')
        .select('id, name, service_type_id')
        .eq('id', order.subcategory_id)
        .maybeSingle();

      // 3. ایجاد یا دریافت پروفایل مشتری برای کاربر گیرنده
      let { data: recipientCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!recipientCustomer) {
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({ user_id: user.id })
          .select('id')
          .single();

        if (createError) throw createError;
        recipientCustomer = newCustomer;
      }

      const customerId = recipientCustomer?.id;
      if (!customerId) throw new Error('خطا در ایجاد پروفایل مشتری');

      // 4. دریافت شماره تلفن فرستنده
      const { data: fromProfile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', data.from_user_id)
        .maybeSingle();

      // 5. ایجاد لوکیشن برای گیرنده
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          user_id: user.id,
          address_line: order.address,
          title: order.detailed_address || 'آدرس انتقالی',
          lat: order.location_lat || 34.6401,
          lng: order.location_lng || 50.8764,
          province_id: order.province_id,
          district_id: order.district_id,
        })
        .select('id')
        .single();

      if (locationError) throw locationError;

      // 6. ایجاد پروژه در hierarchy برای گیرنده
      const serviceTypeId = subcategory?.service_type_id;
      if (!serviceTypeId) throw new Error('خطا در دریافت نوع خدمات');

      const { data: newHierarchy, error: hierarchyError } = await supabase
        .from('projects_hierarchy')
        .insert({
          user_id: user.id,
          location_id: newLocation.id,
          service_type_id: serviceTypeId,
          subcategory_id: order.subcategory_id,
          title: `پروژه انتقالی - ${order.code}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (hierarchyError) throw hierarchyError;

      // 7. بروزرسانی وضعیت درخواست انتقال
      const { error: transferError } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'completed',
          recipient_responded_at: new Date().toISOString()
        })
        .eq('id', data.id);

      if (transferError) throw transferError;

      // 8. انتقال مالکیت سفارش
      const { error: ownershipError } = await supabase.rpc('transfer_order_ownership' as any, {
        p_order_id: orderId,
        p_new_customer_id: customerId,
        p_new_hierarchy_id: newHierarchy.id,
        p_transferred_from_user_id: data.from_user_id,
        p_transferred_from_phone: fromProfile?.phone_number || data.to_phone,
      });

      if (ownershipError) throw ownershipError;

      toast({
        title: '✅ سفارش پذیرفته شد',
        description: 'سفارش شما با موفقیت پذیرفته شد و در پروژه‌های شما قرار گرفت. در حال انتقال...',
      });

      // ارسال نوتیفیکیشن به ثبت‌کننده
      await supabase.rpc('send_notification', {
        _user_id: data.from_user_id,
        _title: '✅ سفارش پذیرفته شد',
        _body: `${data.to_name || data.to_phone} سفارشی که برای ایشان ثبت کرده بودید را پذیرفت.`,
        _link: `/user/orders/${orderId}`,
        _type: 'success'
      });

      onStatusChange?.();

      // انتقال کاربر به صفحه سفارشات
      setTimeout(() => {
        navigate(`/user/orders/${orderId}`);
      }, 1500);
    } catch (error: any) {
      console.error('Error accepting transfer:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در پذیرش سفارش',
        variant: 'destructive'
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!data) return;
    
    try {
      setRejecting(true);
      
      const { error } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'recipient_rejected',
          recipient_responded_at: new Date().toISOString(),
          recipient_rejection_reason: 'کاربر سفارش را نپذیرفت'
        })
        .eq('id', data.id);

      if (error) throw error;

      toast({
        title: 'سفارش رد شد',
        description: 'شما این سفارش را رد کردید',
      });

      // ارسال نوتیفیکیشن به ثبت‌کننده
      await supabase.rpc('send_notification', {
        _user_id: data.from_user_id,
        _title: '❌ سفارش رد شد',
        _body: `${data.to_name || data.to_phone} سفارشی که برای ایشان ثبت کرده بودید را نپذیرفت.`,
        _link: `/user/orders/${orderId}`,
        _type: 'warning'
      });

      fetchOrderForOthersData();
      onStatusChange?.();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!data) {
    return null;
  }

  const isRecipient = user?.id === data.to_user_id;
  const isSender = user?.id === data.from_user_id;
  const isPending = data.status === 'pending_recipient' || data.status === 'pending_registration';
  const isAccepted = data.status === 'accepted' || data.status === 'completed';

  return (
    <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-orange-700 dark:text-orange-400">
          <Users className="h-5 w-5" />
          📦 سفارش برای شخص دیگر
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* نمایش اطلاعات ثبت‌کننده و گیرنده */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ثبت‌کننده */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground mb-2">ثبت‌کننده سفارش</div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="font-medium">{data.from_name}</span>
              {isSender && (
                <Badge variant="outline" className="text-xs">شما</Badge>
              )}
            </div>
            {data.from_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Phone className="h-3 w-3" />
                <span dir="ltr">{data.from_phone}</span>
              </div>
            )}
          </div>

          {/* گیرنده */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground mb-2">گیرنده سفارش</div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-green-600" />
              <span className="font-medium">{data.to_name || 'کاربر'}</span>
              {isRecipient && (
                <Badge variant="outline" className="text-xs">شما</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Phone className="h-3 w-3" />
              <span dir="ltr">{data.to_phone}</span>
            </div>
          </div>
        </div>

        {/* وضعیت */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            تاریخ ثبت: {formatPersianDate(data.created_at, { showDayOfWeek: true })}
          </div>
          
          {data.status === 'pending_registration' && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
              <Clock className="h-3 w-3 ml-1" />
              در انتظار ثبت‌نام گیرنده
            </Badge>
          )}
          
          {data.status === 'pending_recipient' && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              <Clock className="h-3 w-3 ml-1" />
              در انتظار تایید گیرنده
            </Badge>
          )}
          
          {isAccepted && (
            <Badge variant="default" className="bg-green-100 text-green-700">
              <Check className="h-3 w-3 ml-1" />
              پذیرفته شده
            </Badge>
          )}
        </div>

        {/* دکمه‌های عمل برای گیرنده */}
        {isRecipient && isPending && data.status === 'pending_recipient' && (
          <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-700">این سفارش برای شما ثبت شده است</AlertTitle>
            <AlertDescription className="text-yellow-600">
              آیا این سفارش را می‌پذیرید؟ پس از پذیرش، سفارش به لیست سفارشات شما اضافه می‌شود.
            </AlertDescription>
            <div className="flex gap-2 mt-3">
              <Button 
                onClick={handleAccept} 
                disabled={accepting}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 ml-1" />
                {accepting ? 'در حال پذیرش...' : 'پذیرفتن سفارش'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleReject}
                disabled={rejecting}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4 ml-1" />
                {rejecting ? 'در حال رد...' : 'رد کردن'}
              </Button>
            </div>
          </Alert>
        )}

        {/* پیام برای ثبت‌کننده */}
        {isSender && isPending && (
          <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/20">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">در انتظار تایید</AlertTitle>
            <AlertDescription className="text-blue-600">
              {data.status === 'pending_registration' 
                ? `کاربر با شماره ${data.to_phone} هنوز ثبت‌نام نکرده است. پس از ثبت‌نام، سفارش در لیست ایشان نمایش داده می‌شود.`
                : `این سفارش در انتظار تایید ${data.to_name || data.to_phone} است.`
              }
            </AlertDescription>
          </Alert>
        )}

        {/* پیام تایید شده */}
        {isAccepted && (
          <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">
              {isSender ? 'سفارش منتقل شد' : 'این سفارش به شما منتقل شده است'}
            </AlertTitle>
            <AlertDescription className="text-green-600">
              {isSender
                ? `این سفارش به ${data.to_name || data.to_phone} منتقل شد و دیگر در دسترس شما نیست.`
                : `این سفارش از طرف ${data.from_name}${data.from_phone ? ` (${data.from_phone})` : ''} به شما منتقل شده است و اکنون به‌طور کامل در اختیار شماست.`}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
