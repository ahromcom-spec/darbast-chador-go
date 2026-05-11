## هدف

ساخت یک اسکریپت bash واحد که روی VPS اجرا شود و یک فایل `.env` کامل و درست برای نسخه رسمی self-hosted Supabase تولید کند، شامل:
- همه ~۶۰ متغیر مورد نیاز
- JWT_SECRET تصادفی + ANON_KEY و SERVICE_ROLE_KEY واقعی (تولید شده با همان JWT_SECRET)
- پسوردهای امن تصادفی برای DB، Dashboard، Logflare، Pooler و SECRET_KEY_BASE
- مقادیر پیش‌فرض درست برای DOCKER_SOCKET_LOCATION، STUDIO_PORT، Kong، Realtime و...

## خروجی نهایی

یک فایل: `/mnt/documents/generate-env.sh`

## مراحل اجرای کاربر روی VPS

```text
1. آپلود فایل: scp generate-env.sh root@VPS:/opt/ahrom/supabase/
2. cd /opt/ahrom/supabase
3. cp .env .env.broken.backup   (بکاپ از نسخه شکسته)
4. chmod +x generate-env.sh
5. ./generate-env.sh             (فایل .env کامل می‌سازد)
6. docker compose --env-file .env config > /dev/null && echo OK
7. docker compose up -d
```

## ساختار اسکریپت

```text
generate-env.sh
├── بررسی وجود node یا python (برای ساخت JWT)
├── تولید رشته‌های تصادفی (openssl rand)
│   ├── POSTGRES_PASSWORD     (32 char)
│   ├── JWT_SECRET            (40 char، حداقل 32)
│   ├── DASHBOARD_PASSWORD    (24 char)
│   ├── SECRET_KEY_BASE       (64 char)
│   ├── VAULT_ENC_KEY         (32 char)
│   ├── LOGFLARE_API_KEY      (32 char)
│   └── POOLER_TENANT_ID      (random)
├── ساخت ANON_KEY و SERVICE_ROLE_KEY با node/python
│   └── HMAC-SHA256 امضا با JWT_SECRET (10 سال انقضا)
├── نوشتن .env با تمام متغیرها
└── چاپ خلاصه‌ای از کلیدهای مهم به stdout
```

## فهرست کامل متغیرهایی که در .env نوشته می‌شود

```text
# Secrets
POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
DASHBOARD_USERNAME, DASHBOARD_PASSWORD, SECRET_KEY_BASE, VAULT_ENC_KEY

# Database
POSTGRES_HOST=db, POSTGRES_DB=postgres, POSTGRES_PORT=5432

# Supavisor (Pooler)
POOLER_PROXY_PORT_TRANSACTION=6543, POOLER_DEFAULT_POOL_SIZE=20,
POOLER_MAX_CLIENT_CONN=100, POOLER_TENANT_ID=, POOLER_DB_POOL_SIZE=5

# API Proxy / Kong
KONG_HTTP_PORT=8000, KONG_HTTPS_PORT=8443

# API
PGRST_DB_SCHEMAS=public,storage,graphql_public

# Auth
SITE_URL=http://localhost:3000, ADDITIONAL_REDIRECT_URLS=,
JWT_EXPIRY=3600, DISABLE_SIGNUP=false, API_EXTERNAL_URL=http://localhost:8000

# Mailer
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify, MAILER_URLPATHS_INVITE=...,
MAILER_URLPATHS_RECOVERY=..., MAILER_URLPATHS_EMAIL_CHANGE=...

# Email auth
ENABLE_EMAIL_SIGNUP=true, ENABLE_EMAIL_AUTOCONFIRM=true,
SMTP_ADMIN_EMAIL=admin@example.com, SMTP_HOST=supabase-mail,
SMTP_PORT=2500, SMTP_USER=fake, SMTP_PASS=fake,
SMTP_SENDER_NAME=fake, ENABLE_ANONYMOUS_USERS=false

# Phone auth
ENABLE_PHONE_SIGNUP=true, ENABLE_PHONE_AUTOCONFIRM=true

# Studio
STUDIO_DEFAULT_ORGANIZATION=Ahrom, STUDIO_DEFAULT_PROJECT=Default,
STUDIO_PORT=3000, SUPABASE_PUBLIC_URL=http://localhost:8000,
IMGPROXY_ENABLE_WEBP_DETECTION=true, OPENAI_API_KEY=

# Functions
FUNCTIONS_VERIFY_JWT=false

# Logs (Logflare/Vector)
LOGFLARE_PUBLIC_ACCESS_TOKEN=, LOGFLARE_PRIVATE_ACCESS_TOKEN=,
DOCKER_SOCKET_LOCATION=/var/run/docker.sock

# Google Cloud (optional, خالی)
GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID, GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER
```

## نکات مهم

- **JWT همگام‌سازی**: همه سه مقدار `JWT_SECRET`/`ANON_KEY`/`SERVICE_ROLE_KEY` در همین یک اجرا تولید و با هم سازگار می‌شوند. دیگر نگرانی JWT mismatch وجود ندارد.
- **SMTP/OPENAI خالی**: از مقادیر stub استفاده می‌شود تا compose اجرا شود. کاربر بعداً می‌تواند مقادیر واقعی بگذارد.
- **CRLF safe**: اسکریپت با line endings یونیکس نوشته می‌شود و کاربر هم می‌تواند `dos2unix` بزند.
- **بدون نیاز به اینترنت**: اسکریپت فقط از `openssl` و `node` (یا `python3`) که روی VPS موجودند استفاده می‌کند.

پس از تأیید این پلن، اسکریپت را می‌سازم و در `/mnt/documents/generate-env.sh` قرار می‌دهم تا دانلود کنید.