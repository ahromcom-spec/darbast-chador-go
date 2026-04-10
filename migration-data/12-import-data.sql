-- ============================================
-- 12-IMPORT-DATA.SQL - وارد کردن داده‌ها
-- ترتیب اجرا: بعد از اجرای فایل‌های 01 تا 11
-- ============================================

-- ابتدا داده‌های پایه بدون وابستگی
-- استان‌ها
\echo 'Importing provinces...'
\set provinces `cat migration-data/data/01-provinces.json`
SELECT import_json_data('provinces', :'provinces');

-- شهرستان‌ها
\echo 'Importing districts...'
\set districts `cat migration-data/data/02-districts.json`
SELECT import_json_data('districts', :'districts');

-- NOTE: This SQL approach won't work easily with psql.
-- Use the Node.js import script instead: node migration-data/import.js
