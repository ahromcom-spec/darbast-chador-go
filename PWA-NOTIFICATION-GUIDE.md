# 🔔 راهنمای نوتیفیکیشن PWA - پروژه اهرم

## ✅ آنچه پیاده‌سازی شده است

### 1. **PWA با قابلیت نصب**
- ✨ پیکربندی کامل `vite-plugin-pwa`
- 📱 Manifest فارسی با RTL Support
- 🎨 آیکون‌های PWA (512x512)
- ⚡ Service Worker با قابلیت Cache
- 🔄 Auto-update

### 2. **سیستم نوتیفیکیشن**
- 🔔 Hook سفارشی `usePushNotifications`
- 📄 صفحه تنظیمات نوتیفیکیشن (`/settings/notifications`)
- 📲 صفحه نصب اپلیکیشن (`/settings/install`)
- 🎯 کامپوننت Notification Prompt در صفحه اصلی

### 3. **امکانات پیاده‌سازی شده**
- ✅ تشخیص پشتیبانی دستگاه
- ✅ درخواست مجوز نوتیفیکیشن
- ✅ اشتراک در Push Notifications
- ✅ ارسال نوتیفیکیشن تست
- ✅ لغو اشتراک
- ✅ راهنمای نصب برای iOS و Android

---

## 📱 نحوه استفاده

### برای کاربران:

#### **1. نصب اپلیکیشن**

**روی اندروید:**
1. از منوی مرورگر (سه نقطه) گزینه "Add to Home Screen" را بزنید
2. روی "Install" کلیک کنید
3. اپلیکیشن روی صفحه اصلی نصب می‌شود

**روی iOS:**
1. در Safari روی دکمه Share (مربع با فلش) بزنید
2. "Add to Home Screen" را انتخاب کنید
3. روی "Add" کلیک کنید

#### **2. فعال‌سازی نوتیفیکیشن**
1. بعد از نصب، به `/settings/notifications` بروید
2. روی "فعال‌سازی اعلان‌ها" کلیک کنید
3. به مرورگر اجازه ارسال نوتیفیکیشن دهید
4. می‌توانید یک نوتیفیکیشن تستی ارسال کنید

---

## 🔧 برای توسعه‌دهندگان

### نحوه ارسال نوتیفیکیشن از Backend

#### **روش 1: استفاده از Supabase Edge Function**

یک Edge Function ایجاد کنید:

\`\`\`typescript
// supabase/functions/send-push-notification/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  const { subscription, title, body, data } = await req.json();

  const pushPayload = {
    notification: {
      title,
      body,
      icon: '/ahrom-app-icon.png',
      badge: '/ahrom-app-icon.png',
      data
    }
  };

  // ارسال نوتیفیکیشن با استفاده از web-push
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'TTL': '86400', // 24 hours
      // VAPID headers
    },
    body: JSON.stringify(pushPayload)
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
\`\`\`

#### **روش 2: ذخیره Subscriptions در Database**

جدول برای ذخیره subscriptions:

\`\`\`sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);
\`\`\`

#### **روش 3: فعال‌سازی خودکار با Triggers**

مثال: ارسال نوتیفیکیشن وقتی سفارش تایید می‌شود:

\`\`\`sql
CREATE OR REPLACE FUNCTION send_push_on_order_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    -- فراخوانی edge function برای ارسال push
    PERFORM http_post(
      'https://your-edge-function-url/send-push',
      json_build_object(
        'user_id', NEW.customer_id,
        'title', 'سفارش تایید شد',
        'body', 'سفارش شما با کد ' || NEW.code || ' تایید شد'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_approval_push
  AFTER UPDATE ON projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION send_push_on_order_approval();
\`\`\`

---

## ⚙️ تنظیمات VAPID

برای ارسال Push Notifications واقعی، نیاز به VAPID keys دارید:

### تولید VAPID Keys:

\`\`\`bash
npx web-push generate-vapid-keys
\`\`\`

### اضافه کردن به Environment Variables:

\`\`\`.env
VITE_VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key  # فقط سرور
\`\`\`

### استفاده در Hook:

فایل \`src/hooks/usePushNotifications.ts\` را ویرایش کنید:

\`\`\`typescript
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
\`\`\`

---

## 📊 محدودیت‌ها و نکات مهم

### ✅ **چیزهایی که کار می‌کنند:**

- ✅ نوتیفیکیشن در **Android Chrome/Edge/Firefox** (کامل)
- ✅ نوتیفیکیشن در **Desktop Chrome/Edge/Firefox**
- ✅ نصب PWA روی **iOS Safari** (بدون Push - فقط Local Notifications)
- ✅ نصب PWA روی **Android**

### ⚠️ **محدودیت‌ها:**

- ❌ iOS Safari هنوز از Web Push API پشتیبانی نمی‌کند (فقط Safari 16.4+ در macOS)
- ⚠️ در iOS فقط می‌توان از Local Notifications استفاده کرد
- ⚠️ برای Push واقعی در iOS باید Native App با Capacitor استفاده کرد

---

## 🚀 مراحل بعدی (اختیاری)

اگر نیاز به Push Notification کامل در iOS دارید:

1. **تبدیل به Native App با Capacitor**
2. استفاده از Firebase Cloud Messaging (FCM)
3. یا استفاده از سرویس‌های شخص ثالث مثل OneSignal

---

## 📚 منابع مفید

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Web Push Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Can I Use - Push API](https://caniuse.com/push-api)

---

## 🎯 خلاصه

این پروژه الان یک **PWA کامل** با قابلیت:
- نصب روی گوشی (iOS و Android)
- کار آفلاین
- نوتیفیکیشن در Android و Desktop
- UX بهتر و سریع‌تر

برای فعال‌سازی کامل Push Notifications، فقط باید:
1. VAPID Keys تولید کنید
2. Subscription را در دیتابیس ذخیره کنید  
3. Edge Function برای ارسال Push ایجاد کنید
4. از Triggers استفاده کنید تا خودکار نوتیفیکیشن ارسال شود
