# راهنمای امنیت پروژه اهرم

## نکات کلیدی امنیتی

### 1. حفاظت از داده‌های حساس

#### اطلاعات تماس پیمانکاران
- ❌ شماره تلفن و ایمیل پیمانکاران **هرگز** عمومی نیستند
- ✅ فقط خود پیمانکار، ادمین‌ها و مدیران کل می‌توانند این اطلاعات را ببینند
- ✅ از function امن `get_contractor_contact_info()` استفاده کنید
- 🔒 دایرکتوری عمومی پیمانکاران فقط اطلاعات غیرحساس نمایش می‌دهد

```typescript
// استفاده صحیح:
const { data } = await supabase.rpc('get_contractor_contact_info', {
  _contractor_id: contractorId
});
```

#### دایرکتوری عمومی پیمانکاران
- ✅ فقط شامل نام شرکت، توضیحات، سابقه و موقعیت کلی
- ❌ ایمیل، تلفن، آدرس کامل و اطلاعات تماس مستقیم نمایش داده نمی‌شود
- ✅ برای تماس با پیمانکار از مکانیزم امن پلتفرم استفاده کنید

#### اطلاعات شخصی کاربران  
- ✅ شماره تلفن‌ها فقط برای خود کاربر قابل مشاهده هستند
- ✅ آدرس‌ها فقط برای کاربر، ادمین و پیمانکاران مربوطه قابل دسترس هستند
- ✅ موقعیت جغرافیایی کامل محافظت شده است

### 2. سیستم OTP امن

#### تغییرات امنیتی:
- ❌ کاربران دیگر نمی‌توانند مستقیماً OTP را تایید کنند
- ✅ تایید OTP فقط از طریق edge functions انجام می‌شود
- ✅ Rate limiting: حداکثر 3 درخواست در 5 دقیقه

#### استفاده صحیح:
```typescript
// فقط از edge functions استفاده کنید
const { data, error } = await supabase.functions.invoke('verify-otp', {
  body: { phone_number, code }
});
```

### 3. حفاظت از Audit Logs

- ✅ امکان DELETE یا UPDATE روی audit logs وجود ندارد
- ✅ فقط سیستم می‌تواند رکوردها را ثبت کند
- ✅ مدیران کل می‌توانند لاگ‌ها را مشاهده کنند

### 4. Validation و Sanitization

#### استفاده از validation schemas:
```typescript
import { phoneSchema, profileSchema, serviceRequestSchema } from '@/lib/validations';

// Validate phone number
const result = phoneSchema.safeParse({ phone: phoneNumber });
if (!result.success) {
  // Handle validation errors
  console.error(result.error.errors);
}
```

#### Sanitize user input:
```typescript
import { sanitizeHtml, sanitizePhoneNumber } from '@/lib/security';

// Prevent XSS
const safeText = sanitizeHtml(userInput);

// Clean phone numbers
const cleanPhone = sanitizePhoneNumber(phoneInput);
```

### 5. Rate Limiting

```typescript
import { checkRateLimit } from '@/lib/security';

// Check if user can perform action
const canProceed = checkRateLimit(
  `action:${userId}`,
  5,  // max 5 attempts
  60000 // in 1 minute
);

if (!canProceed) {
  toast.error('تعداد درخواست‌های شما بیش از حد مجاز است');
  return;
}
```

#### محدودیت‌های Rate Limiting موجود:
- **OTP**: حداکثر 3 درخواست در 5 دقیقه
- **دایرکتوری پیمانکاران**: حداکثر 10 درخواست در دقیقه (جلوگیری از scraping)
- **ثبت درخواست سرویس**: حداکثر 5 درخواست در 10 دقیقه

```typescript
// استفاده از rate limiting در edge functions
import { supabase } from './supabase-client';

const canCreateRequest = await supabase.rpc('check_service_request_rate_limit', {
  _user_id: userId
});

if (!canCreateRequest) {
  return new Response('تعداد درخواست‌های شما بیش از حد مجاز است', { status: 429 });
}
```

### 6. Role-Based Access Control

```typescript
import { hasRole } from '@/lib/security';

// Check user role
const isAdmin = await hasRole('admin');
const isManager = await hasRole('general_manager');

if (!isAdmin && !isManager) {
  toast.error('دسترسی غیرمجاز');
  navigate('/');
  return;
}
```

### 7. Safe Error Handling

```typescript
import { getSafeErrorMessage } from '@/lib/security';

try {
  // ... database operation
} catch (error) {
  const safeMessage = getSafeErrorMessage(error);
  toast.error(safeMessage);
  // Error details are not exposed to users
}
```

### 8. File Upload Security

```typescript
import { validateFileUpload } from '@/lib/security';

const handleFileUpload = (file: File) => {
  const validation = validateFileUpload(file, 5, [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]);

  if (!validation.valid) {
    toast.error(validation.error);
    return;
  }

  // Proceed with upload
};
```

## Database Security Functions

### 1. `has_role(user_id, role)`
بررسی نقش کاربر

### 2. `get_contractor_contact_info(contractor_id)`
دریافت امن اطلاعات تماس پیمانکار

### 3. `check_rate_limit(user_id, action, limit, window)`
بررسی محدودیت تعداد درخواست

### 4. `verify_otp_code(phone_number, code)`
تایید کد OTP (فقط از edge functions)

### 5. `check_otp_rate_limit(phone_number)`
بررسی محدودیت ارسال OTP

### 6. `check_directory_rate_limit(user_id)`
بررسی محدودیت جستجو در دایرکتوری پیمانکاران (ضد scraping)

### 7. `check_service_request_rate_limit(user_id)`
بررسی محدودیت ثبت درخواست سرویس

## Workflow Security Guidelines

### سیستم مدیریت گردش کار امن

#### دسترسی به وظایف (Workflow Tasks):
- **مدیران عملیات**: دسترسی کامل به تمام وظایف
- **مدیر انبار**: فقط وظایف مرتبط با انبار (`warehouse_pick`)
- **مدیر مالی**: فقط وظایف مرتبط با امور مالی (`finance`)
- **پیمانکاران**: مشاهده وظایف سرویس‌های محول شده

#### دسترسی به اقلام سرویس (Service Line Items):
- **مدیران عملیات**: دسترسی کامل
- **پیمانکاران**: مشاهده اقلام سرویس‌های خود (برای دانستن مصالح مورد نیاز)
- **مشتریان**: مشاهده اقلام سرویس‌های خود

#### دسترسی به رزرو موجودی (Inventory Reservations):
- **مدیر انبار**: دسترسی کامل
- **مدیران عملیات**: فقط مشاهده
- **پیمانکاران**: مشاهده رزروهای مرتبط با سرویس‌های خود

## بهترین روش‌ها (Best Practices)

### ✅ انجام دهید:
1. همیشه از validation schemas استفاده کنید
2. همیشه ورودی کاربر را sanitize کنید
3. از safe error messages استفاده کنید
4. Role-based access control را چک کنید
5. از rate limiting استفاده کنید
6. فایل‌ها را validate کنید

### ❌ انجام ندهید:
1. داده‌های حساس را در console.log قرار ندهید
2. پیام‌های خطای raw را به کاربر نشان ندهید
3. اعتماد کامل به ورودی کاربر نداشته باشید
4. مستقیماً با جداول حساس کار نکنید (از functions استفاده کنید)
5. اطلاعات احراز هویت را در localStorage ذخیره نکنید

## Checklist امنیتی قبل از Deploy

- [ ] تمام ورودی‌های کاربر validate شده‌اند
- [ ] RLS policies روی تمام جداول فعال است
- [ ] اطلاعات حساس sanitize شده‌اند
- [ ] Error messages امن هستند
- [ ] Rate limiting فعال است
- [ ] File uploads محدود شده‌اند
- [ ] Audit logging فعال است
- [ ] Password protection فعال شده
- [ ] HTTPS در production فعال است
- [ ] Environment variables امن هستند

## گزارش مشکلات امنیتی

اگر مشکل امنیتی پیدا کردید:
1. بلافاصله به تیم توسعه اطلاع دهید
2. از قرار دادن جزئیات در کد عمومی خودداری کنید  
3. از email امن برای گزارش استفاده کنید

## منابع بیشتر

- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://react.dev/learn/security)
