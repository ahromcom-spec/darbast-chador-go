import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderAutomationRequest {
  orderId: string;
  orderCode: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderId, orderCode }: OrderAutomationRequest = await req.json()

    console.log(`شروع اتوماسیون اداری برای سفارش ${orderCode}`)

    // بارگذاری اطلاعات کامل سفارش
    const { data: order, error: orderError } = await supabase
      .from('projects_v3')
      .select(`
        *,
        customers!inner (
          id,
          customer_code,
          user_id
        ),
        provinces (name),
        districts (name),
        subcategories (name, code, service_type_id),
        service_types_v3 (name, code)
      `)
      .eq('id', orderId)
      .single()
    
    if (orderError) throw orderError
    if (!order) throw new Error('سفارش یافت نشد')

    // دریافت اطلاعات پروفایل مشتری
    const { data: customerProfile } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', order.customers.user_id)
      .single()

    console.log('اطلاعات سفارش بارگذاری شد:', order.code)

    // دریافت لیست CEO و مدیران کل برای ارسال نوتیفیکیشن
    const { data: ceoAndManagers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['ceo', 'general_manager'])

    console.log('تعداد مدیران یافت شده:', ceoAndManagers?.length || 0)

    // ایجاد نوتیفیکیشن برای CEO و مدیران کل
    if (ceoAndManagers && ceoAndManagers.length > 0) {
      const notifications = ceoAndManagers.map(manager => ({
        user_id: manager.user_id,
        type: 'info',
        title: `سفارش جدید ${order.code}`,
        body: `سفارش جدید از ${customerProfile?.full_name || 'مشتری'} در ${order.provinces?.name || ''} ${order.address} ثبت شد و منتظر تأیید است.`,
        link: '/ceo/orders'
      }))

      const { error: managersNotifError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (managersNotifError) {
        console.error('خطا در ایجاد نوتیفیکیشن مدیران:', managersNotifError)
      } else {
        console.log(`✅ نوتیفیکیشن برای ${ceoAndManagers.length} مدیر ارسال شد`)
      }
    }

    // ثبت log در audit_log
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        actor_user_id: order.customers.user_id,
        entity: 'projects_v3',
        entity_id: order.id,
        action: 'automation_started',
        meta: {
          order_code: order.code,
          automation_type: 'order_workflow',
          timestamp: new Date().toISOString()
        }
      })

    if (auditError) {
      console.error('خطا در ثبت audit log:', auditError)
    }

    // ارسال نوتیفیکیشن به مشتری
    const { error: customerNotifError } = await supabase
      .from('notifications')
      .insert({
        user_id: order.customers.user_id,
        type: 'success',
        title: `سفارش ${order.code} ثبت شد`,
        body: `سفارش شما با کد ${order.code} برای ${order.subcategories?.name || 'خدمات داربست'} با موفقیت ثبت شد و در حال بررسی توسط مدیریت است.`,
        link: '/user/my-orders'
      })

    if (customerNotifError) {
      console.error('خطا در ایجاد نوتیفیکیشن مشتری:', customerNotifError)
    } else {
      console.log('✅ نوتیفیکیشن برای مشتری ارسال شد')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'اتوماسیون اداری با موفقیت اجرا شد',
        orderCode: order.code 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('خطا در اتوماسیون اداری:', error)
    const errorMessage = error instanceof Error ? error.message : 'خطای ناشناخته'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
