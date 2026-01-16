# داده‌های خام برای مهاجرت VPS

این پوشه شامل داده‌های خام استخراج شده از دیتابیس است. همه فایل‌ها به فرمت JSON هستند.

## فایل‌های موجود

| فایل | توضیح | تعداد رکورد |
|------|-------|-------------|
| `01-provinces.json` | استان‌ها | 6 |
| `02-districts.json` | شهرستان‌ها | 27 |
| `03-service-categories.json` | دسته‌بندی خدمات | 6 |
| `04-service-types.json` | انواع خدمات | 7 |
| `05-subcategories.json` | زیردسته‌ها | 11 |
| `06-phone-whitelist.json` | لیست سفید تلفن | 14 |
| `07-user-roles.json` | نقش‌های کاربران | 10 |
| `08-hr-employees.json` | کارمندان | 7 |
| `09-module-assignments.json` | تخصیص ماژول‌ها | 5 |
| `10-order-payments.json` | پرداخت‌های سفارشات | 3 |

## نحوه استفاده

1. اول اسکیماها (`migration-data/*.sql`) را در PostgreSQL اجرا کنید
2. سپس داده‌ها را با این ترتیب وارد کنید:
   - provinces → districts → service_categories → service_types → subcategories
   - phone_whitelist
   - profiles (از auth.users اصلی)
   - customers
   - user_roles
   - hr_employees
   - سپس جداول وابسته

## نکته مهم

- داده‌های `profiles` و `customers` نیاز به همگام‌سازی با `auth.users` دارند
- داده‌های `projects_v3` و `projects_hierarchy` حجیم هستند و جداگانه استخراج می‌شوند
- فایل‌های رسانه (عکس/ویدیو) باید از Storage دانلود شوند

## Storage Buckets

باکت‌های موجود:
- `profile-images` - عکس پروفایل کاربران
- `project-media` - فایل‌های رسانه پروژه‌ها
- `project-hierarchy-media` - رسانه سلسله‌مراتب پروژه
- `order-media` - رسانه سفارشات  
- `expert-pricing-media` - رسانه قیمت‌گذاری کارشناسی
