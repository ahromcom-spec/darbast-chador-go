# راهنمای کامل مهاجرت به VPS ایرانی

## فهرست مطالب
1. پیش‌نیازهای سرور
2. راه‌اندازی دیتابیس PostgreSQL
3. ایمپورت داده‌ها
4. تبدیل Edge Functions به Node.js
5. راه‌اندازی Storage
6. استقرار فرانت‌اند
7. تنظیمات امنیتی
8. متغیرهای محیطی

---

## 1. پیش‌نیازهای سرور

### حداقل سخت‌افزار
- RAM: 4GB
- CPU: 2 Core
- Storage: 50GB SSD
- سیستم‌عامل: Ubuntu 22.04 LTS

### نصب نرم‌افزارها

```bash
# آپدیت سیستم
sudo apt update && sudo apt upgrade -y

# نصب Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# نصب Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# نصب PostgreSQL 15
sudo apt install -y postgresql-15 postgresql-contrib-15

# نصب Nginx
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 2. راه‌اندازی دیتابیس PostgreSQL

### ایجاد دیتابیس و کاربر

```bash
sudo -u postgres psql
```

```sql
-- ایجاد دیتابیس
CREATE DATABASE ahrom_db;

-- ایجاد کاربر
CREATE USER ahrom_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';

-- دادن دسترسی
GRANT ALL PRIVILEGES ON DATABASE ahrom_db TO ahrom_user;
ALTER DATABASE ahrom_db OWNER TO ahrom_user;

-- فعال‌سازی UUID
\c ahrom_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\q
```

### ایمپورت اسکیما

```bash
# ایمپورت به ترتیب
psql -U ahrom_user -d ahrom_db -f migration-data/01-enums.sql
psql -U ahrom_user -d ahrom_db -f migration-data/02-base-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/03-user-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/04-location-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/05-project-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/06-order-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/07-daily-report-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/08-finance-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/09-misc-tables.sql
psql -U ahrom_user -d ahrom_db -f migration-data/10-functions.sql
psql -U ahrom_user -d ahrom_db -f migration-data/11-triggers.sql
```

---

## 3. ایمپورت داده‌ها از JSON

### اسکریپت Node.js برای ایمپورت

فایل `import-data.js` ایجاد کنید:

```javascript
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'ahrom_db',
  user: 'ahrom_user',
  password: 'YOUR_SECURE_PASSWORD',
  port: 5432,
});

async function importData() {
  const client = await pool.connect();
  
  try {
    // 1. استان‌ها
    const provinces = JSON.parse(
      fs.readFileSync('./migration-data/data/01-provinces.json', 'utf8')
    );
    for (const p of provinces) {
      await client.query(
        'INSERT INTO provinces (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [p.id, p.name, p.created_at]
      );
    }
    console.log('✅ استان‌ها ایمپورت شد');

    // 2. شهرستان‌ها
    const districts = JSON.parse(
      fs.readFileSync('./migration-data/data/02-districts.json', 'utf8')
    );
    for (const d of districts) {
      await client.query(
        'INSERT INTO districts (id, name, province_id, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [d.id, d.name, d.province_id, d.created_at]
      );
    }
    console.log('✅ شهرستان‌ها ایمپورت شد');

    // 3. دسته‌بندی خدمات
    const categories = JSON.parse(
      fs.readFileSync('./migration-data/data/03-service-categories.json', 'utf8')
    );
    for (const c of categories) {
      await client.query(
        'INSERT INTO service_categories (id, name, description, icon, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [c.id, c.name, c.description, c.icon, c.is_active, c.created_at]
      );
    }
    console.log('✅ دسته‌بندی خدمات ایمپورت شد');

    // 4. انواع خدمات
    const serviceTypes = JSON.parse(
      fs.readFileSync('./migration-data/data/04-service-types.json', 'utf8')
    );
    for (const s of serviceTypes) {
      await client.query(
        `INSERT INTO service_types_v3 (id, name, description, category_id, is_active, sort_order, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.description, s.category_id, s.is_active, s.sort_order, s.created_at]
      );
    }
    console.log('✅ انواع خدمات ایمپورت شد');

    // 5. زیردسته‌ها
    const subcategories = JSON.parse(
      fs.readFileSync('./migration-data/data/05-subcategories.json', 'utf8')
    );
    for (const s of subcategories) {
      await client.query(
        `INSERT INTO subcategories (id, name, description, service_type_id, is_active, sort_order, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.description, s.service_type_id, s.is_active, s.sort_order, s.created_at]
      );
    }
    console.log('✅ زیردسته‌ها ایمپورت شد');

    // 6. لیست سفید تلفن
    const whitelist = JSON.parse(
      fs.readFileSync('./migration-data/data/06-phone-whitelist.json', 'utf8')
    );
    for (const w of whitelist) {
      await client.query(
        `INSERT INTO phone_whitelist (id, phone_number, allowed_roles, notes, added_by, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [w.id, w.phone_number, w.allowed_roles, w.notes, w.added_by, w.created_at, w.updated_at]
      );
    }
    console.log('✅ لیست سفید ایمپورت شد');

    // 7. نقش‌های کاربری
    const roles = JSON.parse(
      fs.readFileSync('./migration-data/data/07-user-roles.json', 'utf8')
    );
    for (const r of roles) {
      await client.query(
        `INSERT INTO user_roles (id, user_id, role, created_at) 
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.user_id, r.role, r.created_at]
      );
    }
    console.log('✅ نقش‌ها ایمپورت شد');

    // 8. کارمندان HR
    const employees = JSON.parse(
      fs.readFileSync('./migration-data/data/08-hr-employees.json', 'utf8')
    );
    for (const e of employees) {
      await client.query(
        `INSERT INTO hr_employees (id, full_name, phone_number, department, position, status, hire_date, notes, user_id, created_by, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
        [e.id, e.full_name, e.phone_number, e.department, e.position, e.status, e.hire_date, e.notes, e.user_id, e.created_by, e.created_at, e.updated_at]
      );
    }
    console.log('✅ کارمندان ایمپورت شد');

    // 9. ماژول‌ها
    const modules = JSON.parse(
      fs.readFileSync('./migration-data/data/09-module-assignments.json', 'utf8')
    );
    for (const m of modules) {
      await client.query(
        `INSERT INTO module_assignments (id, module_key, module_name, assigned_phone_number, assigned_user_id, assigned_by, assigned_at, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.module_key, m.module_name, m.assigned_phone_number, m.assigned_user_id, m.assigned_by, m.assigned_at, m.is_active, m.created_at, m.updated_at]
      );
    }
    console.log('✅ ماژول‌ها ایمپورت شد');

    console.log('\n🎉 تمام داده‌ها با موفقیت ایمپورت شد!');

  } catch (error) {
    console.error('❌ خطا:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

importData();
```

### اجرای اسکریپت

```bash
npm install pg
node import-data.js
```

---

## 4. تبدیل Edge Functions به Node.js

### ساختار پروژه Express

```
backend/
├── package.json
├── src/
│   ├── index.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── otp.js
│   │   ├── sms.js
│   │   └── payment.js
│   ├── middleware/
│   │   └── auth.js
│   └── services/
│       ├── sms.js
│       └── payment.js
└── .env
```

### package.json

```json
{
  "name": "ahrom-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1"
  }
}
```

### src/index.js

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import otpRoutes from './routes/otp.js';
import smsRoutes from './routes/sms.js';
import paymentRoutes from './routes/payment.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/payment', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 سرور در پورت ${PORT} اجرا شد`);
});
```

### src/routes/otp.js (نمونه)

```javascript
import express from 'express';
import { Pool } from 'pg';
import { sendSMS } from '../services/sms.js';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ارسال کد OTP
router.post('/send', async (req, res) => {
  try {
    const { phone_number } = req.body;
    
    if (!phone_number || !/^09\d{9}$/.test(phone_number)) {
      return res.status(400).json({ error: 'شماره تلفن نامعتبر است' });
    }

    // تولید کد 6 رقمی
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 دقیقه

    // ذخیره در دیتابیس
    await pool.query(
      `INSERT INTO otp_codes (phone_number, code, expires_at) 
       VALUES ($1, $2, $3)`,
      [phone_number, code, expiresAt]
    );

    // ارسال SMS
    await sendSMS(phone_number, `کد تایید شما: ${code}`);

    res.json({ success: true, message: 'کد ارسال شد' });
  } catch (error) {
    console.error('خطا در ارسال OTP:', error);
    res.status(500).json({ error: 'خطا در ارسال کد' });
  }
});

// تایید کد OTP
router.post('/verify', async (req, res) => {
  try {
    const { phone_number, code } = req.body;

    const result = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE phone_number = $1 AND code = $2 
       AND expires_at > NOW() AND verified = false
       ORDER BY created_at DESC LIMIT 1`,
      [phone_number, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'کد نامعتبر یا منقضی شده' });
    }

    // علامت‌گذاری به عنوان تایید شده
    await pool.query(
      'UPDATE otp_codes SET verified = true WHERE id = $1',
      [result.rows[0].id]
    );

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('خطا در تایید OTP:', error);
    res.status(500).json({ error: 'خطا در تایید کد' });
  }
});

export default router;
```

### src/services/sms.js

```javascript
import axios from 'axios';

export async function sendSMS(phone, message) {
  // برای SMS.ir
  const response = await axios.post('https://api.sms.ir/v1/send', {
    mobile: phone,
    message: message,
    lineNumber: process.env.SMS_LINE_NUMBER
  }, {
    headers: {
      'x-api-key': process.env.SMS_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}
```

---

## 5. راه‌اندازی Storage با MinIO

### docker-compose.yml

```yaml
version: '3.8'
services:
  minio:
    image: minio/minio:latest
    container_name: minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: YOUR_MINIO_PASSWORD
    volumes:
      - ./minio-data:/data
    command: server /data --console-address ":9001"
    restart: always
```

### ایجاد Bucket‌ها

```bash
docker exec -it minio mc alias set local http://localhost:9000 minioadmin YOUR_MINIO_PASSWORD

# ایجاد باکت‌ها
docker exec -it minio mc mb local/avatars
docker exec -it minio mc mb local/order-media
docker exec -it minio mc mb local/project-media
docker exec -it minio mc mb local/profile-photos

# تنظیم دسترسی عمومی برای آواتارها
docker exec -it minio mc anonymous set download local/avatars
```

---

## 6. استقرار فرانت‌اند

### بیلد پروژه

```bash
# کلون کردن
git clone YOUR_REPO_URL
cd YOUR_PROJECT

# نصب وابستگی‌ها
npm install

# ایجاد فایل .env
cat > .env << EOF
VITE_SUPABASE_URL=https://your-domain.ir/api
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=https://your-domain.ir/api
EOF

# بیلد
npm run build
```

### کانفیگ Nginx

فایل `/etc/nginx/sites-available/ahrom`:

```nginx
server {
    listen 80;
    server_name your-domain.ir www.your-domain.ir;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.ir www.your-domain.ir;

    ssl_certificate /etc/letsencrypt/live/your-domain.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.ir/privkey.pem;

    # Frontend
    root /var/www/ahrom/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # MinIO Storage Proxy
    location /storage/ {
        proxy_pass http://127.0.0.1:9000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

### فعال‌سازی سایت

```bash
sudo ln -s /etc/nginx/sites-available/ahrom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. تنظیمات امنیتی

### SSL با Certbot

```bash
sudo certbot --nginx -d your-domain.ir -d www.your-domain.ir
```

### Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5432/tcp   # PostgreSQL (فقط لوکال)
sudo ufw deny 9000/tcp   # MinIO (فقط از nginx)
```

### امنیت PostgreSQL

در فایل `/etc/postgresql/15/main/pg_hba.conf`:

```
# فقط اجازه اتصال لوکال
local   all   all                 peer
host    all   all   127.0.0.1/32  scram-sha-256
```

---

## 8. متغیرهای محیطی

### فایل `.env` برای Backend

```env
# Database
DATABASE_URL=postgresql://ahrom_user:YOUR_PASSWORD@localhost:5432/ahrom_db

# JWT
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters

# SMS (SMS.ir)
SMS_API_KEY=your_sms_api_key
SMS_LINE_NUMBER=30001234

# Zarinpal
ZARINPAL_MERCHANT_ID=your_merchant_id

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=YOUR_MINIO_PASSWORD

# Frontend
FRONTEND_URL=https://your-domain.ir

# Server
PORT=3001
NODE_ENV=production
```

---

## 9. چک‌لیست نهایی

- [ ] PostgreSQL نصب و کانفیگ شده
- [ ] تمام جداول ایمپورت شده
- [ ] داده‌های JSON ایمپورت شده
- [ ] Backend Node.js اجرا می‌شود
- [ ] MinIO راه‌اندازی شده
- [ ] Nginx کانفیگ شده
- [ ] SSL فعال است
- [ ] Firewall تنظیم شده
- [ ] فرانت‌اند بیلد و دیپلوی شده

---

## 10. خلاصه آمار پروژه

| مورد | تعداد |
|------|-------|
| جداول دیتابیس | 85+ |
| Edge Functions | 20+ |
| Storage Buckets | 6 |
| نقش‌های کاربری | 10 |
| Database Functions | 15+ |
| Triggers | 10+ |

---

## نکات مهم

1. **ترتیب ایمپورت**: حتماً جداول را به ترتیب اعلام شده ایمپورت کنید
2. **UUID**: همه شناسه‌ها UUID هستند
3. **Timestamps**: تمام تاریخ‌ها با timezone ذخیره شده‌اند
4. **JSONB**: فیلدهای payload و dimensions از نوع JSONB هستند
5. **Enums**: قبل از جداول، enum ها را ایجاد کنید

---

تاریخ تهیه: 1403/10/27
نسخه: 1.0
