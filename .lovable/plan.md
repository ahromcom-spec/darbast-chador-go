## هدف
طراحی سیستم کامل مدیریت پیمانکاران به‌صورت ماژول مستقل، حذف آن از پنل CEO، اضافه کردن کلید خروج/غیرفعال‌سازی برای پیمانکاران، و امکان ارسال سفارش به پیمانکاران (دستی + خودکار با انتخاب توسط پیمانکار).

---

## ۱) حذف از پنل CEO
- در `src/pages/user/UserProfile.tsx` (یا هر فایلی که «پنل مدیریت CEO» را رندر می‌کند) کارت **«تایید پیمانکاران»** از بخش CEO حذف شود.
- مسیر/لینک قبلی به ماژول جدید پیمانکاران ری‌دایرکت شود.

---

## ۲) ماژول جدید «مدیریت پیمانکاران»
ماژول مستقل در `src/pages/ceo/ContractorsModule.tsx` با تب‌بندی:
1. **در انتظار تأیید** — درخواست‌های `contractor_verification_requests` با status=pending → تأیید/رد (همانند کد موجود `useContractorVerificationRequests`).
2. **پیمانکاران فعال** — لیست `contractor_profiles` تأییدشده + جزئیات (صنف، فعالیت، محدوده، شماره) + دکمه فعال/غیرفعال/حذف.
3. **سفارش‌های در دست پیمانکاران** — وضعیت assignmentها (pending / accepted / rejected).

ثبت ماژول در سیستم ماژول‌های قابل اختصاص (`module_hierarchy_states`) با کلید `contractors_management` و نام «مدیریت پیمانکاران» تا CEO بتواند به افراد دیگر هم اختصاص دهد.

ارجاع خودکار: پس از ثبت‌نام پیمانکار در `ContractorRegister`، toast + لینک «درخواست شما در ماژول مدیریت پیمانکاران بررسی می‌شود».

---

## ۳) کلید خروج/غیرفعال‌سازی برای پیمانکاران در «دسترسی سریع»
در تب «دسترسی سریع» پروفایل (`UserProfile.tsx` → `QuickAccess` section)، اگر کاربر نقش `contractor` دارد:
- **دکمه «غیرفعال‌سازی موقت»** → `contractor_profiles.is_active = false` (سفارش جدید نمی‌بیند، حساب می‌ماند).
- **دکمه «فعال‌سازی مجدد»** اگر inactive است.
- **دکمه «خروج از پیمانکاری»** با تأیید دوبار → حذف نقش contractor از `user_roles` + soft delete پروفایل پیمانکار.

---

## ۴) سیستم ارجاع سفارش به پیمانکاران
### دستی (در ماژول سفارشات CEO)
- در صفحه جزئیات هر سفارش، دکمه **«ارسال به پیمانکاران»** → دیالوگ انتخاب:
  - حالت ۱: همه پیمانکاران فعالِ منطبق با نوع خدمت سفارش
  - حالت ۲: انتخاب دستی از لیست
- ایجاد رکوردهای `project_assignments` با status=pending.

### خودکار
- هوک `useAutoAssignProjects` قبلاً وجود دارد و روی INSERT در `service_requests` کار می‌کند → بهبود: تطبیق بر اساس `service_category_id` و `region_id` پیمانکار.
- در ماژول جدید، **سوییچ «ارجاع خودکار»** برای فعال/غیرفعال کردن قرارگیرد (در `localStorage` یا تنظیمات سیستم).

### نمای پیمانکار (`ContractorDashboard`)
- لیست سفارش‌های pending مخصوص او از `project_assignments`.
- دکمه‌های **«قبول می‌کنم»** / **«رد می‌کنم»**.
- پس از قبول اولین پیمانکار → بقیه pendingها برای آن سفارش به `cancelled` تغییر کنند (قفل اولین نفر) + ارسال notification.

---

## بخش فنی

**فایل‌های اصلی:**
- ایجاد: `src/pages/ceo/ContractorsModule.tsx`, `src/components/contractor/ContractorQuickActions.tsx`, `src/components/orders/AssignContractorsDialog.tsx`
- ویرایش: `src/pages/user/UserProfile.tsx` (حذف کارت CEO + اضافه کردن QuickActions), `src/pages/contractor/ContractorRegister.tsx` (toast بعد ثبت), `src/pages/contractor/ContractorDashboard.tsx` (قبول/رد)، `src/hooks/useAutoAssignProjects.ts` (فیلتر region)، روتر اصلی برای مسیر `/ceo/contractors`.

**دیتابیس:**
- جدول `project_assignments` موجود است (ستون‌های `status`, `contractor_id`, `service_request_id`).
- تریگر/RPC: تابع `accept_assignment(assignment_id)` که در یک تراکنش وضعیت این assignment را `accepted` و بقیه assignmentهای همان `service_request_id` را `cancelled` کند.
- RLS: پیمانکار فقط assignmentهای خودش را ببیند/آپدیت کند.
- اضافه کردن `is_active` به `contractor_profiles` اگر نباشد.

---

## خارج از محدوده (می‌توان بعداً افزود)
- پرداخت/کارمزد به پیمانکاران
- چت داخلی بین مشتری و پیمانکار
- رتبه‌بندی پیمانکار پس از اتمام کار