
-- اضافه کردن ستون allowed_modules به جدول bank_cards
-- این ستون یک آرایه از کلیدهای ماژول است که به این کارت دسترسی دارند
-- اگر null یا خالی باشد، همه ماژول‌ها دسترسی دارند (حالت پیش‌فرض)
ALTER TABLE public.bank_cards
ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT NULL;

-- کامنت توضیحی
COMMENT ON COLUMN public.bank_cards.allowed_modules IS 
  'آرایه‌ای از کلیدهای ماژول که به این کارت دسترسی دارند. اگر NULL باشد، همه ماژول‌ها دسترسی دارند.';
