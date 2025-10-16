-- تغییر فیلد customer_code به nullable تا trigger به‌صورت خودکار کد تولید کند
ALTER TABLE public.customers 
ALTER COLUMN customer_code DROP NOT NULL;