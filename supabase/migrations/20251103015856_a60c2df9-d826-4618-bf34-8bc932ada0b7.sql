-- Update phone whitelist with manager phone numbers
DELETE FROM public.phone_whitelist;

-- CEO (مدیریت کل)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09111111111', ARRAY['ceo'], 'مدیریت کل');

-- General Manager (مدیر اجرایی کل)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09222222222', ARRAY['general_manager'], 'مدیر اجرایی کل');

-- Executive Manager - General (مدیریت خدمات اجرای داربست به همراه اجناس)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09011111111', ARRAY['scaffold_executive_manager'], 'مدیریت خدمات اجرای داربست به همراه اجناس');

-- Executive Manager - Scaffold with Materials (مدیر اجرایی خدمات اجرای داربست به همراه اجناس)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09012121212', ARRAY['scaffold_executive_manager'], 'مدیر اجرایی خدمات اجرای داربست به همراه اجناس');

-- Sales Manager - General (مدیر فروش کل)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09333333333', ARRAY['sales_manager'], 'مدیر فروش کل');

-- Sales Manager - Scaffold with Materials (مدیر فروش خدمات اجرای داربست به همراه اجناس)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09013131313', ARRAY['sales_manager'], 'مدیر فروش خدمات اجرای داربست به همراه اجناس');

-- Finance Manager - General (مدیر مالی کل)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09444444444', ARRAY['finance_manager'], 'مدیر مالی کل');

-- Finance Manager - Scaffold with Materials (مدیر مالی خدمات اجرای داربست به همراه اجناس)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09014141414', ARRAY['finance_manager'], 'مدیر مالی خدمات اجرای داربست به همراه اجناس');

-- Warehouse Manager - General (مدیر انبارداری کل)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09555555555', ARRAY['warehouse_manager'], 'مدیر انبارداری کل');

-- Warehouse Manager - Scaffold with Materials (مدیر انبارداری خدمات اجرای داربست به همراه اجناس)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09015151515', ARRAY['warehouse_manager'], 'مدیر انبارداری خدمات اجرای داربست به همراه اجناس');

-- Support and Security Manager - General (مدیر پشتیبانی و حراست کل)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09666666666', ARRAY['admin'], 'مدیر پشتیبانی و حراست کل');

-- Support and Security Manager - Scaffold with Materials (مدیر پشتیبانی و حراست خدمات اجرای داربست به همراه اجناس)
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09016161616', ARRAY['admin'], 'مدیر پشتیبانی و حراست خدمات اجرای داربست به همراه اجناس');
