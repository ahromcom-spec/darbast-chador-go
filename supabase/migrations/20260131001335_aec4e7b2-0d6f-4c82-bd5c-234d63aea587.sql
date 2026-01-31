-- افزودن شماره مدیرعامل به لیست سفید با نقش ceo
INSERT INTO phone_whitelist (phone_number, allowed_roles, notes)
VALUES ('09125511494', ARRAY['ceo'], 'مدیرعامل - ورود با رمز ثابت یا کد تایید')
ON CONFLICT (phone_number) DO UPDATE SET
  allowed_roles = EXCLUDED.allowed_roles,
  notes = EXCLUDED.notes;