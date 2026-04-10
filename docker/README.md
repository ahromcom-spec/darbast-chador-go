# راه‌اندازی Supabase Self-Hosted (بدون فرانت‌اند)

## پیش‌نیازها
- Docker >= 20.10
- Docker Compose >= 2.0
- حداقل 4GB RAM

## شروع سریع

```bash
cd docker

# 1. کپی فایل تنظیمات
cp .env.example .env

# 2. ویرایش متغیرها (حتماً مقادیر امن تولید کنید)
nano .env

# 3. تولید JWT keys
node -e "
const crypto = require('crypto');
const secret = crypto.randomBytes(32).toString('base64');
console.log('JWT_SECRET=' + secret);
"

# 4. تولید ANON_KEY و SERVICE_ROLE_KEY
# به https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys مراجعه کنید

# 5. اجرا
docker compose up -d

# 6. بررسی وضعیت
docker compose ps
```

## سرویس‌ها

| سرویس | پورت | توضیح |
|--------|------|-------|
| Kong (API Gateway) | 8000 | نقطه ورود اصلی API |
| PostgreSQL | 5432 | دیتابیس |
| GoTrue (Auth) | 9999 (internal) | احراز هویت |
| PostgREST | 3000 (internal) | REST API |
| Realtime | 4000 (internal) | WebSocket |
| Storage | 5000 (internal) | ذخیره فایل |
| Edge Functions | 9000 (internal) | توابع سرورلس |
| pg-meta | 8080 (internal) | متادیتای دیتابیس |

## اتصال فرانت‌اند

در `.env` فرانت‌اند:
```
VITE_SUPABASE_URL=http://YOUR_SERVER_IP:8000
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
```

## ایمپورت دیتابیس

```bash
# اتصال به دیتابیس
docker exec -it supabase-db psql -U postgres

# یا ایمپورت فایل‌های migration
cat ../migration-data/01-enums.sql | docker exec -i supabase-db psql -U postgres
```

## پشتیبان‌گیری

```bash
# بک‌اپ کامل
docker exec supabase-db pg_dump -U postgres > backup_$(date +%Y%m%d).sql

# بازیابی
cat backup.sql | docker exec -i supabase-db psql -U postgres
```

## توقف

```bash
docker compose down        # توقف (حفظ داده‌ها)
docker compose down -v     # توقف + حذف داده‌ها
```
