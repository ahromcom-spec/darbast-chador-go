-- Clear existing phone whitelist and add new management phone numbers
DELETE FROM public.phone_whitelist;

-- Insert new management phone numbers with their roles
INSERT INTO public.phone_whitelist (phone_number, allowed_roles, notes)
VALUES
  ('09111111111', ARRAY['ceo'], 'مدیریت کل'),
  ('09011111111', ARRAY['scaffold_executive_manager'], 'مدیریت خدمات اجرای داربست به همراه اجناس'),
  ('09222222222', ARRAY['scaffold_executive_manager'], 'مدیر اجرایی کل'),
  ('09012121212', ARRAY['scaffold_executive_manager'], 'مدیر اجرایی خدمات اجرای داربست به همراه اجناس'),
  ('09333333333', ARRAY['sales_manager'], 'مدیر فروش کل'),
  ('09013131313', ARRAY['sales_manager'], 'مدیر فروش خدمات اجرای داربست به همراه اجناس'),
  ('09444444444', ARRAY['finance_manager'], 'مدیر مالی کل'),
  ('09014141414', ARRAY['finance_manager'], 'مدیر مالی خدمات اجرای داربست به همراه اجناس'),
  ('09555555555', ARRAY['warehouse_manager'], 'مدیر انبارداری کل'),
  ('09015151515', ARRAY['warehouse_manager'], 'مدیر انبارداری خدمات اجرای داربست به همراه اجناس'),
  ('09666666666', ARRAY['support_manager'], 'مدیر پشتیبانی و خراست کل'),
  ('09016161616', ARRAY['support_manager'], 'مدیر پشتیبانی و خراست خدمات اجرای داربست به همراه اجناس');