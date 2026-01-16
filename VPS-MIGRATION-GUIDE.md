# 📦 راهنمای کامل مهاجرت به VPS ایرانی

> تاریخ استخراج: ۱۶ دی ۱۴۰۴ (2026-01-16)

---

## 📁 ساختار پروژه

```
ahrom-project/
├── 1-frontend/           # کد فرانت‌اند React
├── 2-database/           # اسکیما و داده‌های دیتابیس
├── 3-storage/            # فایل‌های رسانه‌ای
├── 4-edge-functions/     # توابع سرور (نیاز به تبدیل به Node.js)
└── 5-auth/               # تنظیمات احراز هویت
```

---

## 🗂️ بخش ۱: دیتابیس

### جداول اصلی (به ترتیب اولویت import)

| # | نام جدول | توضیح | وابستگی |
|---|---------|-------|---------|
| 1 | `provinces` | استان‌ها | - |
| 2 | `districts` | شهرستان‌ها | provinces |
| 3 | `regions` | مناطق سلسله‌مراتبی | parent_id (self) |
| 4 | `service_categories` | دسته‌بندی خدمات | - |
| 5 | `service_types_v3` | انواع خدمات | - |
| 6 | `subcategories` | زیردسته خدمات | service_types_v3 |
| 7 | `service_activity_types` | انواع فعالیت | - |
| 8 | `organizational_positions` | سمت‌های سازمانی | parent_id (self) |
| 9 | `profiles` | پروفایل کاربران | auth.users |
| 10 | `customers` | مشتریان | profiles |
| 11 | `user_roles` | نقش‌های کاربران | profiles |
| 12 | `phone_whitelist` | لیست سفید شماره‌ها | - |
| 13 | `locations` | مکان‌ها | provinces, districts |
| 14 | `projects_hierarchy` | سلسله‌مراتب پروژه‌ها | locations, service_types |
| 15 | `projects_v3` | سفارش‌ها (اصلی) | customers, subcategories |
| 16 | `contractors` | پیمانکاران | profiles |
| 17 | `hr_employees` | کارکنان HR | profiles |
| 18 | `notifications` | اعلان‌ها | profiles |
| 19 | `order_messages` | پیام‌های سفارش | projects_v3 |
| 20 | `order_payments` | پرداخت‌ها | projects_v3 |
| 21 | `order_approvals` | تأییدیه‌ها | projects_v3 |
| 22 | `collection_requests` | درخواست جمع‌آوری | projects_v3, customers |
| 23 | `order_renewals` | تمدید سفارش | projects_v3, customers |
| 24 | `daily_reports` | گزارش روزانه | profiles |
| 25 | `daily_report_orders` | سفارش‌های گزارش | daily_reports, projects_v3 |
| 26 | `daily_report_staff` | پرسنل گزارش | daily_reports |
| 27 | `wallet_transactions` | تراکنش‌های کیف پول | profiles |
| 28 | `project_media` | رسانه سفارش | projects_v3 |
| 29 | `module_assignments` | تخصیص ماژول | profiles |
| 30 | `audit_log` | لاگ عملیات | - |

### آمار داده‌ها

| جدول | تعداد رکورد |
|------|-------------|
| profiles | ~25+ |
| customers | ~25+ |
| user_roles | 10 |
| projects_v3 | ~25+ |
| locations | ~80+ |
| notifications | 1400+ |
| daily_reports | ~20 |
| hr_employees | 7 |
| order_payments | 3 |
| wallet_transactions | ~30 |

---

## 🗄️ بخش ۲: Storage Buckets

### باکت‌های موجود

| نام باکت | توضیح | تعداد فایل |
|----------|-------|------------|
| `order-media` | رسانه‌های سفارش | ~100+ |
| `executive-progress` | پیشرفت اجرایی | ~10 |
| `profile-images` | تصاویر پروفایل | ~15 |
| `profile-photos` | گالری پروفایل | ~11 |
| `expert-pricing-media` | رسانه قیمت‌گذاری | - |

### دانلود فایل‌ها

آدرس پایه Storage:
```
https://gclbltatkbwbqxqqrcea.supabase.co/storage/v1/object/public/{bucket_name}/{file_path}
```

---

## ⚡ بخش ۳: Edge Functions (نیاز به تبدیل)

### لیست توابع

| نام تابع | کاربرد | اولویت |
|----------|--------|--------|
| `send-otp` | ارسال کد تأیید SMS | 🔴 بالا |
| `verify-otp` | تأیید کد OTP | 🔴 بالا |
| `send-ceo-otp` | کد تأیید مدیرعامل | 🔴 بالا |
| `verify-ceo-otp` | تأیید مدیرعامل | 🔴 بالا |
| `register-without-otp` | ثبت‌نام بدون OTP | 🔴 بالا |
| `admin-login-as-user` | ورود به نام کاربر | 🟡 متوسط |
| `send-push-notification` | نوتیفیکیشن | 🟡 متوسط |
| `get-onesignal-app-id` | OneSignal | 🟡 متوسط |
| `get-vapid-public-key` | VAPID Key | 🟡 متوسط |
| `send-order-sms` | SMS سفارش | 🟡 متوسط |
| `notify-managers-new-order` | اعلان مدیران | 🟡 متوسط |
| `zarinpal-payment` | درگاه پرداخت | 🟢 پایین |
| `zarinpal-verify` | تأیید پرداخت | 🟢 پایین |
| `get-mapbox-token` | توکن نقشه | 🟢 پایین |
| `get-road-route` | مسیریابی | 🟢 پایین |
| `geocode-nominatim` | Geocoding | 🟢 پایین |
| `parse-excel-report` | پردازش اکسل | 🟢 پایین |
| `assistant-chat` | چت هوشمند | 🟢 پایین |
| `moderate-image` | بررسی تصاویر | 🟢 پایین |
| `cleanup-empty-locations` | پاکسازی | 🟢 پایین |

---

## 🔐 بخش ۴: نقش‌ها و دسترسی‌ها

### نقش‌های سیستم (app_role)

| نقش | توضیح فارسی |
|-----|------------|
| `ceo` | مدیرعامل |
| `general_manager` | مدیر کل |
| `sales_manager` | مدیر فروش |
| `scaffold_executive_manager` | مدیر اجرایی داربست |
| `executive_manager_scaffold_execution_with_materials` | مدیر اجرایی داربست با اجناس |
| `rental_executive_manager` | مدیر اجرایی کرایه |
| `finance_manager` | مدیر مالی |
| `warehouse_manager` | مدیر انبار |
| `support_security_manager` | مدیر پشتیبانی و حراست |
| `contractor` | پیمانکار |
| `customer` | مشتری |
| `admin` | مدیر سیستم |

---

## 🛠️ بخش ۵: Database Functions

### توابع مهم

```sql
-- بررسی نقش کاربر
has_role(_user_id uuid, _role app_role) → boolean

-- ارسال نوتیفیکیشن
send_notification(_user_id, _title, _body, _link, _type) → uuid

-- ثبت لاگ
log_audit(_action, _entity, _entity_id, _meta) → uuid

-- بررسی لیست سفید
check_phone_whitelist(_phone) → TABLE(is_whitelisted, allowed_roles)

-- ایجاد سفارش
create_project_v3(...) → SETOF projects_v3

-- مدیریت کیف پول
add_wallet_transaction(...) → uuid
get_wallet_balance(_user_id) → numeric
```

---

## 📋 بخش ۶: Triggers

| تریگر | جدول | کاربرد |
|-------|------|--------|
| `create_order_approvals` | projects_v3 | ایجاد تأییدیه‌های خودکار |
| `check_and_update_order_status` | order_approvals | بروزرسانی وضعیت سفارش |
| `notify_managers_on_new_order` | projects_v3 | اعلان به مدیران |
| `trigger_order_automation` | projects_v3 | اتوماسیون سفارش |
| `sync_order_approval_to_wallet` | projects_v3 | همگام‌سازی با کیف پول |
| `sync_order_payment_to_wallet` | order_payments | ثبت پرداخت در کیف پول |
| `sync_daily_report_to_wallet` | daily_report_staff | گزارش روزانه به کیف پول |
| `auto_assign_pending_transfers` | profiles | تخصیص خودکار انتقال |
| `ensure_customer_exists` | auth.users | ایجاد رکورد مشتری |

---

## 🌐 بخش ۷: RLS Policies

### سیاست‌های امنیتی

تمام جداول دارای Row Level Security فعال هستند با سیاست‌های:
- کاربران فقط داده‌های خود را می‌بینند
- مدیران دسترسی گسترده‌تر دارند
- برخی جداول عمومی هستند (provinces, districts, etc.)

---

## 📱 بخش ۸: Environment Variables

### متغیرهای مورد نیاز

```env
# Database
DATABASE_URL=postgresql://...

# Supabase (برای جایگزینی)
VITE_SUPABASE_URL=https://your-vps-api.com
VITE_SUPABASE_PUBLISHABLE_KEY=your-api-key

# SMS - Parsgreen
PARSGREEN_API_KEY=...

# Maps
MAPBOX_TOKEN=...

# Push Notifications
ONESIGNAL_APP_ID=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Payment
ZARINPAL_MERCHANT_ID=...

# AI (optional)
OPENAI_API_KEY=...
```

---

## 🚀 مراحل مهاجرت

### مرحله ۱: آماده‌سازی سرور
```bash
# نصب Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# نصب PostgreSQL 15+
sudo apt install postgresql-15

# نصب nginx
sudo apt install nginx
```

### مرحله ۲: ایجاد دیتابیس
```bash
# ایجاد دیتابیس
sudo -u postgres createdb ahrom_db
sudo -u postgres createuser ahrom_user

# اجرای schema
psql -d ahrom_db < schema.sql

# Import داده‌ها (به ترتیب اولویت)
psql -d ahrom_db < data/provinces.sql
psql -d ahrom_db < data/districts.sql
# ... بقیه جداول
```

### مرحله ۳: تبدیل Edge Functions به Node.js
```bash
# ایجاد پروژه Express
mkdir ahrom-api && cd ahrom-api
npm init -y
npm install express @supabase/supabase-js cors

# ساختار
api/
├── routes/
│   ├── auth.js       # OTP routes
│   ├── orders.js     # Order routes
│   └── ...
├── middleware/
│   └── auth.js
└── index.js
```

### مرحله ۴: تنظیم Storage
```bash
# استفاده از MinIO برای S3-compatible storage
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /data/minio:/data \
  minio/minio server /data --console-address ":9001"
```

### مرحله ۵: Frontend Build
```bash
# Clone کد
git clone https://github.com/lovable/your-project

# تنظیم env
echo "VITE_SUPABASE_URL=https://your-vps-api.com" > .env

# Build
npm install
npm run build

# کپی به nginx
cp -r dist/* /var/www/ahrom/
```

---

## 📊 خلاصه آمار

| بخش | تعداد |
|-----|-------|
| جداول دیتابیس | 85+ |
| Edge Functions | 20 |
| Storage Buckets | 5 |
| نقش‌های کاربری | 12 |
| Database Functions | 40+ |
| Triggers | 15+ |

---

## ⚠️ نکات مهم

1. **ترتیب Import**: داده‌ها باید به ترتیب وابستگی import شوند
2. **UUIDs**: تمام IDها از نوع UUID هستند
3. **Timestamps**: همه در timezone UTC ذخیره شده‌اند
4. **JSONB**: فیلد `notes` در projects_v3 از نوع JSONB است
5. **Enums**: انواع شمارشی مانند `app_role`, `project_status_v3` باید ایجاد شوند

---

## 📞 پشتیبانی

برای سؤالات فنی، به مستندات پروژه مراجعه کنید یا با تیم توسعه تماس بگیرید.
