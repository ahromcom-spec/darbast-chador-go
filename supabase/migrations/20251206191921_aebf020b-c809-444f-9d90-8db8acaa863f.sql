-- اضافه کردن وضعیت pending_registration برای انتقال سفارش به کاربران ثبت‌نام نکرده
-- این وضعیت برای زمانی است که کاربر مقصد هنوز ثبت‌نام نکرده است

-- تابع برای بررسی و انتقال خودکار سفارشات در انتظار ثبت‌نام به کاربران تازه ثبت‌نام کرده
CREATE OR REPLACE FUNCTION public.auto_assign_pending_transfers()
RETURNS TRIGGER AS $$
DECLARE
  transfer_record RECORD;
BEGIN
  -- بررسی آیا این شماره موبایل درخواست انتقال در انتظار دارد
  FOR transfer_record IN 
    SELECT * FROM public.order_transfer_requests 
    WHERE to_phone_number = NEW.phone_number 
    AND status = 'pending_registration'
  LOOP
    -- بروزرسانی درخواست انتقال با user_id کاربر جدید
    UPDATE public.order_transfer_requests
    SET 
      to_user_id = NEW.user_id,
      status = 'pending_recipient',
      updated_at = now()
    WHERE id = transfer_record.id;
    
    -- ارسال نوتیفیکیشن به کاربر مقصد
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.user_id,
      'درخواست انتقال سفارش',
      'یک سفارش از طرف کاربر دیگری برای شما ثبت شده است. لطفاً آن را بررسی و تایید کنید.',
      'transfer_request',
      '/user/orders'
    );
    
    -- ارسال نوتیفیکیشن به کاربر مبدا که کاربر مقصد ثبت‌نام کرده
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      transfer_record.from_user_id,
      'کاربر مقصد ثبت‌نام کرد',
      'کاربر مقصد سفارشی که برای او ثبت کرده بودید اکنون ثبت‌نام کرده است. سفارش در انتظار تایید ایشان است.',
      'transfer_update',
      '/user/orders/' || transfer_record.order_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- حذف trigger قبلی اگر وجود داشت
DROP TRIGGER IF EXISTS on_profile_created_check_transfers ON public.profiles;

-- ایجاد trigger برای بررسی انتقالات در انتظار ثبت‌نام
CREATE TRIGGER on_profile_created_check_transfers
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_pending_transfers();