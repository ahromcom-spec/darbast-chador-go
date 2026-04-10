# داده‌های خام برای مهاجرت VPS

این پوشه شامل داده‌های خام استخراج شده از دیتابیس است. همه فایل‌ها به فرمت JSON هستند.

**آخرین بروزرسانی:** 2026-04-10

## فایل‌های موجود

| فایل | جدول | تعداد رکورد |
|------|-------|-------------|
| `01-provinces.json` | استان‌ها | 6 |
| `02-districts.json` | شهرستان‌ها | 27 |
| `03-service-categories.json` | دسته‌بندی خدمات | 6 |
| `04-service-types.json` | انواع خدمات | 7 |
| `05-subcategories.json` | زیردسته‌ها | 11 |
| `06-phone-whitelist.json` | لیست سفید تلفن | 15 |
| `07-user-roles.json` | نقش‌های کاربران | 11 |
| `08-hr-employees.json` | کارمندان | 21 |
| `09-module-assignments.json` | تخصیص ماژول‌ها | 13 |
| `10-order-payments.json` | پرداخت‌های سفارشات | 32 |
| `11-regions.json` | مناطق سلسله‌مراتبی | 53 |
| `12-service-activity-types.json` | انواع فعالیت خدمات | 14 |
| `13-organizational-positions.json` | سمت‌های سازمانی | 22 |
| `14-activity-types.json` | انواع فعالیت | 14 |
| `15-profiles.json` | پروفایل‌ها | 64 |
| `16-customers.json` | مشتریان | 63 |
| `17-locations.json` | مکان‌ها | 217 |
| `18-projects-hierarchy.json` | سلسله‌مراتب پروژه‌ها | 194 |
| `19-projects-v3.json` | سفارشات | 68 |
| `20-bank-cards.json` | کارت‌های بانکی | 7 |
| `21-staff-salary-settings.json` | تنظیمات حقوق | 20 |
| `22-order-approvals.json` | تأییدیه‌های سفارش | 272 |
| `23-order-messages.json` | پیام‌های سفارش | 2 |
| `24-order-renewals.json` | تمدید سفارش | 12 |
| `25-order-transfer-requests.json` | درخواست انتقال | 8 |
| `26-collection-requests.json` | درخواست جمع‌آوری | 18 |
| `27-daily-reports.json` | گزارش‌های روزانه | 163 |
| `28-daily-report-orders.json` | سفارشات گزارش روزانه | 89 |
| `29-daily-report-staff.json` | پرسنل گزارش روزانه | 694 |
| `30-daily-report-date-locks.json` | قفل تاریخ گزارش | 64 |
| `31-bank-card-transactions.json` | تراکنش‌های کارت بانکی | 213 |
| `32-wallet-transactions.json` | تراکنش‌های کیف پول | 365 |
| `33-project-media.json` | رسانه پروژه‌ها | 74 |
| `34-daily-report-order-media.json` | رسانه گزارش روزانه | 13 |
| `35-expert-pricing-requests.json` | درخواست قیمت‌گذاری | 3 |
| `36-order-collaborators.json` | همکاران سفارش | 0 |
| `37-order-daily-logs.json` | لاگ روزانه سفارش | 18 |
| `38-audit-log.json` | لاگ بازرسی | 537 |
| `39-notifications.json` | اعلان‌ها | 5340 |
| `40-contractor-profiles.json` | پروفایل پیمانکار | 0 |
| `41-internal-staff-profiles.json` | پروفایل کارمند داخلی | 0 |
| `42-staff-profiles.json` | درخواست نقش | 2 |
| `43-module-shortcuts.json` | میانبر ماژول‌ها | 8 |
| `44-profile-photos.json` | عکس پروفایل | 11 |
| `45-contractor-verification-requests.json` | تأیید پیمانکار | 0 |
| `46-staff-verification-requests.json` | تأیید نیرو | 0 |
| `47-collection-request-messages.json` | پیام جمع‌آوری | 0 |
| `48-approved-media.json` | رسانه تأیید شده | 16 |
| `49-module-edit-locks.json` | قفل ویرایش ماژول | 3 |
| `50-repair-requests.json` | درخواست تعمیر | 0 |

## نحوه ایمپورت در Supabase Self-Hosted

### روش ۱: با اسکریپت Node.js (توصیه شده)

```bash
cd migration-data

# 1. اول اسکیماها را اجرا کنید
cat 01-enums.sql | docker exec -i supabase-db psql -U postgres
cat 02-base-tables.sql | docker exec -i supabase-db psql -U postgres
cat 03-user-tables.sql | docker exec -i supabase-db psql -U postgres
cat 04-location-tables.sql | docker exec -i supabase-db psql -U postgres
cat 05-project-tables.sql | docker exec -i supabase-db psql -U postgres
cat 06-order-tables.sql | docker exec -i supabase-db psql -U postgres
cat 07-daily-report-tables.sql | docker exec -i supabase-db psql -U postgres
cat 08-finance-tables.sql | docker exec -i supabase-db psql -U postgres
cat 09-misc-tables.sql | docker exec -i supabase-db psql -U postgres
cat 10-functions.sql | docker exec -i supabase-db psql -U postgres
cat 11-triggers.sql | docker exec -i supabase-db psql -U postgres

# 2. سپس داده‌ها را ایمپورت کنید
SUPABASE_URL=http://localhost:8000 \
SUPABASE_SERVICE_KEY=your-service-role-key \
node import.js
```

### روش ۲: مستقیم با psql

```bash
# برای هر فایل JSON:
cat data/01-provinces.json | docker exec -i supabase-db psql -U postgres -c "
  CREATE TEMP TABLE tmp (data jsonb);
  \\copy tmp FROM STDIN;
  INSERT INTO provinces SELECT * FROM jsonb_populate_recordset(null::provinces, (SELECT data FROM tmp));
"
```

### روش ۳: با اسکریپت psql ایمپورت

```bash
cat import-psql.sql | docker exec -i supabase-db psql -U postgres
```

## ترتیب ایمپورت

1. provinces → districts → regions
2. service_categories → service_types_v3 → subcategories
3. service_activity_types, organizational_positions, activity_types
4. phone_whitelist
5. profiles → customers
6. user_roles, hr_employees
7. locations → projects_hierarchy → projects_v3
8. order_approvals, order_payments, order_messages, order_renewals
9. daily_reports → daily_report_orders, daily_report_staff
10. bank_cards → bank_card_transactions
11. wallet_transactions, notifications, audit_log

## نکات مهم

- داده‌های `profiles` نیاز به ایجاد کاربران مطابق در `auth.users` دارند
- قبل از ایمپورت profiles باید کاربران را در GoTrue ثبت کنید
- فایل‌های رسانه (عکس/ویدیو) باید از Storage جداگانه دانلود شوند
- مجموع حجم داده: ~4.2 مگابایت

## Storage Buckets

باکت‌های موجود:
- `profile-images` - عکس پروفایل کاربران
- `project-media` - فایل‌های رسانه پروژه‌ها
- `project-hierarchy-media` - رسانه سلسله‌مراتب پروژه
- `order-media` - رسانه سفارشات  
- `expert-pricing-media` - رسانه قیمت‌گذاری کارشناسی
- `daily-report-media` - رسانه گزارش روزانه
