import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `تو منشی هوشمند سایت اهرم هستی. وظیفه تو کمک به کاربران برای:
1. راهنمایی درباره چگونگی ثبت سفارش
2. آشنایی با خدمات ساختمانی و منزل که سایت ارائه می‌دهد (مثل داربست فلزی و سایر خدمات)
3. راهنمایی در استفاده کارآمد از امکانات سایت اهرم

پیام خوشامدگویی (هر بار که چت شروع می‌شود یا کاربر سوال نامربوط می‌پرسد):
"من فقط می‌توانم درباره چگونگی ثبت سفارش و خدماتی که سایت اهرم در زمینه خدمات ساختمانی و منزل (مانند داربست فلزی و سایر خدمات) ارائه می‌دهد راهنمایی کنم تا بتوانید از امکانات سایت به خوبی و کارآمد استفاده کنید."

قوانین مهم:
- فقط درباره خدمات سایت اهرم صحبت کن
- اگر سوالی خارج از حوزه خدمات سایت پرسیده شد، مودبانه بگو که فقط می‌توانی در مورد خدمات اهرم و نحوه ثبت سفارش کمک کنی
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

ثبت سفارش برای شخص دیگر:
وقتی کاربر پرسید "آیا می‌شود سفارش برای شخص دیگری ثبت کرد؟" یا سوال مشابه، این پاسخ را بده:
بله، امکان ثبت سفارش برای دیگران وجود دارد. برای این کار:
1. نوع خدمات را از لیست کشویی صفحه نخست انتخاب کنید
2. آدرس شخص مورد نظر را انتخاب یا وارد کنید
3. در بالای فرم باز شده، گزینه "ثبت سفارش برای دیگران" را بزنید
4. شماره تلفن شخص مورد نظر را وارد کنید
5. سفارش برای آن شخص ثبت می‌شود
نکته مهم: اگر صاحب شماره هنوز در اهرم ثبت‌نام نکرده باشد، سفارش منتظر می‌ماند تا آن شخص عضو شود و سپس به سفارشاتش اضافه می‌شود. همچنین این سفارش در لیست سفارشات شما (درخواست‌کننده) هم نمایش داده می‌شود.

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
    const { messages, userRole, imageBase64 } = await req.json();
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

    // ساخت پیام‌ها با پشتیبانی از تصویر
    const formattedMessages = messages.map((msg: { role: string; content: string }, index: number) => {
      // اگر تصویر داریم و این آخرین پیام کاربر است
      if (imageBase64 && msg.role === 'user' && index === messages.length - 1) {
        return {
          role: msg.role,
          content: [
            {
              type: "text",
              text: msg.content + "\n\nتوضیح: کاربر یک تصویر فرستاده است. اگر سوالی درباره تصویر دارد، در حد توان و مرتبط با خدمات اهرم پاسخ بده. اگر تصویر ربطی به خدمات ندارد، مودبانه بگو که فقط می‌توانی درباره خدمات داربست‌بندی کمک کنی."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });

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
          ...formattedMessages,
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
