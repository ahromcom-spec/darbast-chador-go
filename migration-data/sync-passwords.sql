-- همگام‌سازی رمز عبور ثابت کاربرانی که بعد از export ثبت کرده‌اند
-- این فایل را روی VPS با psql اجرا کنید:
-- docker exec -i <db_container> psql -U postgres -d postgres < sync-passwords.sql

UPDATE public.profiles
SET user_password_hash = '49eb173adac96c8787d02161a02dff47a7a089139e1ce31512d7785922cb4e82',
    password_set_at = '2026-01-31 18:39:50.644+00',
    recovery_email = 'ahrom.com@gmail.com',
    recovery_email_verified = false
WHERE user_id = '1733c786-1dd0-4708-a67e-73e7ed6fff13'
   OR phone_number = '09388231167';

UPDATE public.profiles
SET user_password_hash = '900b4ea81ddc646f3d857e127356ba2db79397479509f4a8b47f3877c6a3c960',
    password_set_at = '2026-01-31 04:53:01.737+00'
WHERE user_id = 'e2567080-4ae6-4a73-a804-79d90831021c'
   OR phone_number = '09111111111';

UPDATE public.profiles
SET user_password_hash = 'pbkdf2$210000$uo4GZXk3JW9w1mBifsWMNg==$pI59VKhwtTscxlcHQvt3YTYjEt6SVUC10YsBSfgPzbk=',
    password_set_at = '2026-01-31 23:15:56.297+00',
    recovery_email = 'ahrom.com@gmail.com',
    recovery_email_verified = false
WHERE user_id = '55edfafc-6890-4b71-8ddd-4426494bb275'
   OR phone_number = '09125511494';

-- بررسی نتیجه
SELECT phone_number, full_name, (user_password_hash IS NOT NULL) AS has_password, password_set_at
FROM public.profiles
WHERE user_password_hash IS NOT NULL;
