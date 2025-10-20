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
          user_id,
          profiles (full_name, phone_number)
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

    console.log('اطلاعات سفارش بارگذاری شد:', order.code)

    // ایجاد نوتیفیکیشن برای مدیر اجرایی
    const { error: execNotifError } = await supabase
      .from('notifications')
      .insert({
        user_id: null, // برای همه مدیران اجرایی
        type: 'order_approval',
        title: `سفارش جدید ${order.code}`,
        message: `سفارش جدید از ${order.customers?.profiles?.full_name} در ${order.address} ثبت شد و منتظر تأیید است.`,
        metadata: {
          order_id: order.id,
          order_code: order.code,
          customer_name: order.customers?.profiles?.full_name,
          address: order.address,
          service_type: order.service_types_v3?.name,
          subcategory: order.subcategories?.name
        }
      })

    if (execNotifError) {
      console.error('خطا در ایجاد نوتیفیکیشن مدیر اجرایی:', execNotifError)
    } else {
      console.log('نوتیفیکیشن برای مدیر اجرایی ارسال شد')
    }

    // ثبت log در audit_log
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        actor_user_id: order.customers?.user_id,
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
        user_id: order.customers?.user_id,
        type: 'order_created',
        title: `سفارش ${order.code} ثبت شد`,
        message: `سفارش شما با کد ${order.code} با موفقیت ثبت شد و در حال بررسی است.`,
        metadata: {
          order_id: order.id,
          order_code: order.code,
          status: order.status
        }
      })

    if (customerNotifError) {
      console.error('خطا در ایجاد نوتیفیکیشن مشتری:', customerNotifError)
    } else {
      console.log('نوتیفیکیشن برای مشتری ارسال شد')
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
