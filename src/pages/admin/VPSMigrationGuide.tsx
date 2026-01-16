import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Database, Server, Code, FolderOpen, Shield, Settings } from "lucide-react";

const VPSMigrationGuide = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 print:p-0 print:bg-white" dir="rtl">
      {/* Print Button - Hidden in print */}
      <div className="print:hidden mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">راهنمای مهاجرت به VPS</h1>
        <Button onClick={handlePrint} className="gap-2">
          <Download className="h-4 w-4" />
          دانلود PDF
        </Button>
      </div>

      {/* PDF Content */}
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
        {/* Header */}
        <div className="text-center border-b-2 border-primary pb-6 print:pb-4">
          <h1 className="text-3xl font-bold text-primary mb-2">🚀 راهنمای کامل مهاجرت به VPS</h1>
          <p className="text-muted-foreground">پروژه احرام - نسخه ۱.۰</p>
          <p className="text-sm text-muted-foreground mt-2">تاریخ: {new Date().toLocaleDateString('fa-IR')}</p>
        </div>

        {/* Table of Contents */}
        <Card className="print:shadow-none print:border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📑 فهرست مطالب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>پیش‌نیازهای سرور</li>
              <li>راه‌اندازی دیتابیس PostgreSQL</li>
              <li>وارد کردن داده‌ها</li>
              <li>تبدیل Edge Functions به Node.js</li>
              <li>راه‌اندازی Storage (MinIO)</li>
              <li>استقرار فرانت‌اند</li>
              <li>تنظیمات امنیتی</li>
              <li>عیب‌یابی</li>
            </ol>
          </CardContent>
        </Card>

        {/* Section 1: Server Requirements */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              ۱. پیش‌نیازهای سرور
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">حداقل مشخصات سخت‌افزاری:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>RAM: ۴ گیگابایت (پیشنهادی: ۸ گیگابایت)</li>
                <li>CPU: ۲ هسته (پیشنهادی: ۴ هسته)</li>
                <li>Storage: ۵۰ گیگابایت SSD</li>
                <li>سیستم‌عامل: Ubuntu 22.04 LTS</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">نصب نرم‌افزارهای مورد نیاز:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# بروزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# نصب PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# نصب Nginx
sudo apt install -y nginx

# نصب Git
sudo apt install -y git

# بررسی نسخه‌ها
node --version  # v20.x.x
psql --version  # 15.x
nginx -v`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Database Setup */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              ۲. راه‌اندازی دیتابیس PostgreSQL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">ایجاد دیتابیس و کاربر:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# ورود به PostgreSQL
sudo -u postgres psql

# ایجاد کاربر
CREATE USER ahrom_user WITH PASSWORD 'رمز_قوی_خود';

# ایجاد دیتابیس
CREATE DATABASE ahrom_db OWNER ahrom_user;

# اعطای دسترسی‌ها
GRANT ALL PRIVILEGES ON DATABASE ahrom_db TO ahrom_user;

# خروج
\\q`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">اجرای اسکیماها (به ترتیب):</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# اتصال به دیتابیس
psql -U ahrom_user -d ahrom_db

# اجرای فایل‌های SQL به ترتیب
\\i migration-data/01-enums.sql
\\i migration-data/02-base-tables.sql
\\i migration-data/03-user-tables.sql
\\i migration-data/04-location-tables.sql
\\i migration-data/05-project-tables.sql
\\i migration-data/06-order-tables.sql
\\i migration-data/07-daily-report-tables.sql
\\i migration-data/08-finance-tables.sql
\\i migration-data/09-misc-tables.sql
\\i migration-data/10-functions.sql
\\i migration-data/11-triggers.sql`}
              </pre>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ نکته مهم:</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                ترتیب اجرای فایل‌ها بسیار مهم است. هر فایل به فایل قبلی وابستگی دارد.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Data Import */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              ۳. وارد کردن داده‌ها
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">ترتیب وارد کردن داده‌ها:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li><code className="bg-muted px-2 py-1 rounded">01-provinces.json</code> → جدول provinces</li>
                <li><code className="bg-muted px-2 py-1 rounded">02-districts.json</code> → جدول districts</li>
                <li><code className="bg-muted px-2 py-1 rounded">03-service-categories.json</code> → جدول service_categories</li>
                <li><code className="bg-muted px-2 py-1 rounded">04-service-types.json</code> → جدول service_types_v3</li>
                <li><code className="bg-muted px-2 py-1 rounded">05-subcategories.json</code> → جدول subcategories</li>
                <li><code className="bg-muted px-2 py-1 rounded">06-phone-whitelist.json</code> → جدول phone_whitelist</li>
                <li><code className="bg-muted px-2 py-1 rounded">07-user-roles.json</code> → جدول user_roles</li>
                <li><code className="bg-muted px-2 py-1 rounded">08-hr-employees.json</code> → جدول hr_employees</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-2">اسکریپت Node.js برای وارد کردن JSON:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`// import-data.js
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user: 'ahrom_user',
  host: 'localhost',
  database: 'ahrom_db',
  password: 'رمز_خود',
  port: 5432,
});

async function importJson(filePath, tableName) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const row of data) {
    const columns = Object.keys(row).join(', ');
    const values = Object.values(row);
    const placeholders = values.map((_, i) => \`$\${i + 1}\`).join(', ');
    
    await pool.query(
      \`INSERT INTO \${tableName} (\${columns}) VALUES (\${placeholders}) ON CONFLICT DO NOTHING\`,
      values
    );
  }
  console.log(\`✅ \${tableName} imported\`);
}

// اجرا
importJson('./migration-data/data/01-provinces.json', 'provinces');`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Edge Functions */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              ۴. تبدیل Edge Functions به Node.js
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">ساختار پروژه Express:</h4>
              <pre className="bg-muted p-4 rounded-lg text-sm text-left" dir="ltr">
{`backend/
├── src/
│   ├── routes/
│   │   ├── auth.js        # send-otp, verify-otp
│   │   ├── sms.js         # send-order-sms
│   │   ├── payment.js     # zarinpal-*
│   │   ├── maps.js        # get-mapbox-token, geocode
│   │   └── notifications.js
│   ├── middleware/
│   │   └── auth.js
│   └── index.js
├── package.json
└── .env`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">نمونه تبدیل send-otp:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`// routes/auth.js
const express = require('express');
const router = express.Router();

router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    // تولید کد OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    
    // ذخیره در دیتابیس
    await pool.query(
      'INSERT INTO otp_codes (phone_number, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL \\'5 minutes\\')',
      [phone, otp]
    );
    
    // ارسال SMS (با کاوه‌نگار یا ملی‌پیامک)
    // await sendSMS(phone, \`کد تایید: \${otp}\`);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">لیست توابع با اولویت:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  <span className="font-semibold text-red-600">اولویت بالا:</span>
                  <ul className="list-disc list-inside mt-1">
                    <li>send-otp</li>
                    <li>verify-otp</li>
                    <li>send-order-sms</li>
                  </ul>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                  <span className="font-semibold text-yellow-600">اولویت متوسط:</span>
                  <ul className="list-disc list-inside mt-1">
                    <li>zarinpal-payment</li>
                    <li>zarinpal-verify</li>
                    <li>get-mapbox-token</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Storage */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              ۵. راه‌اندازی Storage (MinIO)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">نصب MinIO با Docker:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# نصب Docker
curl -fsSL https://get.docker.com | sh

# اجرای MinIO
docker run -d \\
  --name minio \\
  -p 9000:9000 \\
  -p 9001:9001 \\
  -v /data/minio:/data \\
  -e MINIO_ROOT_USER=admin \\
  -e MINIO_ROOT_PASSWORD=رمز_قوی \\
  minio/minio server /data --console-address ":9001"

# ایجاد باکت‌ها
mc alias set local http://localhost:9000 admin رمز_قوی
mc mb local/profile-images
mc mb local/project-media
mc mb local/order-media
mc mb local/expert-pricing-media
mc mb local/project-hierarchy-media`}
              </pre>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 نکته:</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                برای انتقال فایل‌ها از Supabase Storage، باید URL هر فایل را استخراج و دانلود کنید.
                این کار با اسکریپت جداگانه انجام می‌شود.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Frontend Deployment */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              ۶. استقرار فرانت‌اند
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">بیلد و استقرار:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# کلون پروژه
git clone https://github.com/YOUR_REPO/ahrom-app.git
cd ahrom-app

# نصب وابستگی‌ها
npm install

# ایجاد فایل .env
cat > .env << EOF
VITE_API_URL=https://api.yourdomain.com
VITE_STORAGE_URL=https://storage.yourdomain.com
EOF

# بیلد
npm run build

# کپی به nginx
sudo cp -r dist/* /var/www/ahrom/`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">تنظیمات Nginx:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# /etc/nginx/sites-available/ahrom
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/ahrom;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # Gzip
    gzip on;
    gzip_types text/css application/javascript;
}

# فعال‌سازی
sudo ln -s /etc/nginx/sites-available/ahrom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Section 7: Security */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              ۷. تنظیمات امنیتی
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">SSL با Certbot:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# نصب Certbot
sudo apt install certbot python3-certbot-nginx

# دریافت SSL
sudo certbot --nginx -d yourdomain.com

# تمدید خودکار
sudo certbot renew --dry-run`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">فایروال:</h4>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto text-left" dir="ltr">
{`# تنظیم UFW
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable`}
              </pre>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">🔐 چک‌لیست امنیتی:</h4>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                <li>رمز دیتابیس حداقل ۱۶ کاراکتر</li>
                <li>فایل‌های .env در .gitignore</li>
                <li>Rate limiting روی API</li>
                <li>CORS محدود به دامنه خودتان</li>
                <li>بکاپ روزانه دیتابیس</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Section 8: Environment Variables */}
        <Card className="print:shadow-none print:border print:break-inside-avoid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              ۸. متغیرهای محیطی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <h4 className="font-semibold mb-2">فایل .env بکند:</h4>
              <pre className="bg-muted p-4 rounded-lg text-sm text-left" dir="ltr">
{`# Database
DATABASE_URL=postgresql://ahrom_user:PASSWORD@localhost:5432/ahrom_db

# JWT
JWT_SECRET=your_super_secret_key_here

# SMS Provider (کاوه‌نگار)
KAVENEGAR_API_KEY=your_api_key

# Payment (زرین‌پال)
ZARINPAL_MERCHANT_ID=your_merchant_id

# Maps
MAPBOX_TOKEN=your_mapbox_token

# Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=your_password`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="print:shadow-none print:border bg-primary/5">
          <CardHeader>
            <CardTitle>📊 خلاصه پروژه</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div className="bg-background p-3 rounded-lg">
                <div className="text-2xl font-bold text-primary">۸۵+</div>
                <div className="text-sm text-muted-foreground">جدول دیتابیس</div>
              </div>
              <div className="bg-background p-3 rounded-lg">
                <div className="text-2xl font-bold text-primary">۲۰</div>
                <div className="text-sm text-muted-foreground">Edge Function</div>
              </div>
              <div className="bg-background p-3 rounded-lg">
                <div className="text-2xl font-bold text-primary">۵</div>
                <div className="text-sm text-muted-foreground">Storage Bucket</div>
              </div>
              <div className="bg-background p-3 rounded-lg">
                <div className="text-2xl font-bold text-primary">۱۲</div>
                <div className="text-sm text-muted-foreground">نقش کاربری</div>
              </div>
              <div className="bg-background p-3 rounded-lg">
                <div className="text-2xl font-bold text-primary">۴۰+</div>
                <div className="text-sm text-muted-foreground">تابع دیتابیس</div>
              </div>
              <div className="bg-background p-3 rounded-lg">
                <div className="text-2xl font-bold text-primary">۱۵+</div>
                <div className="text-sm text-muted-foreground">Trigger</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm pt-6 border-t">
          <p>این راهنما توسط سیستم Lovable AI تولید شده است</p>
          <p className="mt-1">در صورت نیاز به راهنمایی بیشتر، با تیم پشتیبانی تماس بگیرید</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default VPSMigrationGuide;
