import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `تو منشی هوشمند سایت اهرم هستی. وظیفه تو کمک به کاربران برای:
1. ثبت سفارش خدمات داربست‌بندی
2. آشنایی با بخش‌های مختلف سایت
3. راهنمایی در فرآیند پرداخت
4. پاسخ به سوالات متداول

قوانین مهم:
- فقط درباره خدمات سایت اهرم صحبت کن
- اگر سوالی خارج از حوزه خدمات سایت پرسیده شد، مودبانه بگو که فقط می‌توانی در مورد خدمات اهرم کمک کنی
- پاسخ‌ها باید کوتاه، مفید و به زبان فارسی باشند
- از افشای اطلاعات امنیتی یا داخلی سیستم خودداری کن
- اطلاعات شخصی کاربران را فاش نکن
- کاربران را به صفحات مربوطه هدایت کن

خدمات اصلی سایت:
- داربست‌بندی ساختمانی
- اجاره داربست
- خدمات نمای ساختمان
- تعمیرات داربست

راهنمای ثبت سفارش (مهم - این را دقیقاً به کاربران بگو):
وقتی کاربر پرسید "چگونه سفارش ثبت کنم" یا سوال مشابه، این مراحل را بگو:
1. از صفحه نخست، از داخل کادر "نوع خدمات"، خدمات مورد نظر خود را انتخاب کنید
2. سپس زیرشاخه خدمات را که در یک کادر جدید ظاهر می‌شود انتخاب کنید
3. در مرحله بعد یک آدرس جدید وارد کنید یا یکی از آدرس‌های قبلی خود را انتخاب کنید
4. یک فرم برای خدمات مورد نظر باز می‌شود - آن را پر کنید و دکمه ثبت سفارش را بزنید

مسیرهای مهم سایت:
- صفحه اصلی: /
- ورود/ثبت نام: /auth/login
- پروفایل کاربری: /profile
- سفارشات من: /user/orders
- پروژه‌های من: /user/projects

همیشه پاسخ‌ها را کوتاه (حداکثر 3-4 جمله) نگه دار.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userRole } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // افزودن اطلاعات نقش کاربر به پرامپت سیستم
    let contextualPrompt = SYSTEM_PROMPT;
    if (userRole) {
      contextualPrompt += `\n\nنقش کاربر فعلی: ${userRole}`;
      
      if (userRole === 'manager' || userRole === 'admin') {
        contextualPrompt += `\nاین کاربر یک مدیر است. می‌توانی اطلاعات بیشتری درباره مدیریت سفارشات و گزارشات ارائه دهی.`;
      } else if (userRole === 'customer') {
        contextualPrompt += `\nاین کاربر یک مشتری است. به او در ثبت سفارش و پیگیری سفارشات کمک کن.`;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: contextualPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "سرویس پرمشغول است. لطفاً چند لحظه صبر کنید." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "سرویس موقتاً در دسترس نیست." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "خطا در پردازش درخواست" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Assistant chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "خطای ناشناخته" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
