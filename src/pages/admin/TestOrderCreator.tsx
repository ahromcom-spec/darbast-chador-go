import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, TestTube, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function TestOrderCreator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<any>(null);

  const createTestOrder = async () => {
    if (!user) return;

    setCreating(true);
    try {
      // 1. پیدا کردن یا ساخت مشتری تستی
      const testPhone = `0912${Math.floor(1000000 + Math.random() * 9000000)}`;
      
      // ایجاد پروفایل تستی
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          full_name: 'مشتری تستی',
          phone_number: testPhone
        })
        .select()
        .single();

      if (profileError && !profileError.message.includes('duplicate')) {
        throw profileError;
      }

      // پیدا کردن یا ساخت customer
      let customerId;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // 2. پیدا کردن استان تهران
      const { data: province } = await supabase
        .from('provinces')
        .select('id')
        .eq('name', 'تهران')
        .maybeSingle();

      if (!province) throw new Error('استان تهران یافت نشد');

      // 3. پیدا کردن نوع خدمت داربست با اجناس (کد 10)
      const { data: serviceType } = await supabase
        .from('service_types_v3')
        .select('id')
        .eq('code', '10')
        .maybeSingle();

      if (!serviceType) throw new Error('نوع خدمت داربست یافت نشد');

      // 4. پیدا کردن زیرشاخه با اجناس (کد 10)
      const { data: subcategory } = await supabase
        .from('subcategories')
        .select('id')
        .eq('service_type_id', serviceType.id)
        .eq('code', '10')
        .maybeSingle();

      if (!subcategory) throw new Error('زیرشاخه با اجناس یافت نشد');

      // 5. ایجاد سفارش تستی
      const orderCode = `TEST-${Date.now().toString().slice(-6)}`;
      const { data: order, error: orderError } = await supabase
        .from('projects_v3')
        .insert({
          customer_id: customerId,
          province_id: province.id,
          subcategory_id: subcategory.id,
          code: orderCode,
          address: 'تهران، خیابان ولیعصر، پلاک تست',
          detailed_address: 'طبقه ۳، واحد ۱۲',
          status: 'pending' as const,
          notes: JSON.stringify({
            total_area: 250,
            dimensions: [
              { length: 10, width: 5, height: 3 },
              { length: 8, width: 6, height: 3 }
            ]
          })
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 6. ایجاد رکوردهای تایید
      const approvals = [
        { order_id: order.id, approver_role: 'ceo' },
        { order_id: order.id, approver_role: 'sales_manager' },
        { order_id: order.id, approver_role: 'scaffold_executive_manager' }
      ];

      const { error: approvalsError } = await supabase
        .from('order_approvals')
        .insert(approvals);

      if (approvalsError) throw approvalsError;

      setLastCreatedOrder(order);

      toast({
        title: '✓ سفارش تستی ایجاد شد',
        description: `سفارش ${orderCode} با موفقیت ایجاد شد و آماده تست است.`
      });

    } catch (error: any) {
      console.error('Error creating test order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا در ایجاد سفارش تستی',
        description: error.message || 'لطفاً دوباره تلاش کنید'
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="ایجاد سفارش تستی"
        description="ابزار تست برای شبیه‌سازی فرآیند کامل سفارش"
        showBackButton={true}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            ایجاد سفارش تست
          </CardTitle>
          <CardDescription>
            با کلیک روی دکمه زیر، یک سفارش تستی کامل با تمام تاییدهای لازم ایجاد می‌شود
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
            <h3 className="font-medium text-sm">سفارش شامل موارد زیر خواهد بود:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground mr-6 list-disc">
              <li>نوع خدمت: داربست با اجناس</li>
              <li>استان: تهران</li>
              <li>وضعیت: در انتظار تایید (pending)</li>
              <li>رکوردهای تایید برای: مدیرعامل، مدیر فروش، مدیر اجرایی</li>
              <li>مشتری تستی با شماره رندوم</li>
              <li>آدرس و جزئیات نمونه</li>
            </ul>
          </div>

          <Separator />

          <Button
            onClick={createTestOrder}
            disabled={creating}
            size="lg"
            className="w-full gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                در حال ایجاد سفارش تستی...
              </>
            ) : (
              <>
                <TestTube className="h-5 w-5" />
                ایجاد سفارش تستی جدید
              </>
            )}
          </Button>

          {lastCreatedOrder && (
            <>
              <Separator />
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-medium">آخرین سفارش ایجاد شده</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">کد سفارش:</span>
                    <div className="font-medium">{lastCreatedOrder.code}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">وضعیت:</span>
                    <div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                        در انتظار تایید
                      </Badge>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">ID:</span>
                    <div className="font-mono text-xs">{lastCreatedOrder.id}</div>
                  </div>
                </div>
                
                <div className="pt-2 space-y-2">
                  <h4 className="text-sm font-medium">مراحل تست:</h4>
                  <ol className="text-sm space-y-1 text-muted-foreground mr-6 list-decimal">
                    <li>رفتن به داشبورد مدیرعامل و تایید سفارش</li>
                    <li>رفتن به داشبورد مدیر فروش و تایید سفارش</li>
                    <li>رفتن به کارتابل مدیر اجرایی و تایید با زمان‌بندی</li>
                    <li>بعد از تایید همه، سفارش در «آماده اجرا» ظاهر می‌شود</li>
                    <li>شروع اجرا → سفارش به «در حال اجرا» می‌رود</li>
                    <li>اتمام اجرا → سفارش به «تکمیل شده» می‌رود</li>
                  </ol>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>راهنمای تست</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <h4 className="font-medium">۱. تایید توسط مدیرعامل (CEO)</h4>
            <p className="text-muted-foreground mr-4">
              برو به داشبورد مدیرعامل → سفارشات در انتظار → سفارش تستی را تایید کن
            </p>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-medium">۲. تایید توسط مدیر فروش</h4>
            <p className="text-muted-foreground mr-4">
              برو به داشبورد مدیر فروش → سفارشات در انتظار → سفارش را تایید کن
            </p>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-medium">۳. تایید و زمان‌بندی توسط مدیر اجرایی</h4>
            <p className="text-muted-foreground mr-4">
              برو به کارتابل مدیر اجرایی → تایید سفارش با تعیین تاریخ شروع و پایان
            </p>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-medium">۴. شروع و اتمام اجرا</h4>
            <p className="text-muted-foreground mr-4">
              پس از تایید همه، در کارتابل مدیر اجرایی → آماده اجرا ظاهر می‌شود → شروع اجرا → اتمام اجرا
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
