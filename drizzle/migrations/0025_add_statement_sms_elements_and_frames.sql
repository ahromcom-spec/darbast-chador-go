INSERT INTO public.sms_custom_variables (
  token, label, source_key, format, fallback, prefix, suffix, enabled, legacy_token, is_system, sort_order
) VALUES
  ('شماره_صورتحساب', 'شماره صورتحساب', 'event_statementNumber', 'text', 'ثبت نشده', '', '', true, 'statementNumber', true, 340),
  ('مبلغ_کل_صورتحساب', 'مبلغ کل صورتحساب', 'event_statementTotal', 'text', 'ثبت نشده', '', '', true, 'statementTotal', true, 350),
  ('پرداخت_شده_صورتحساب', 'مجموع پرداخت‌شده صورتحساب', 'event_statementPaid', 'text', 'ثبت نشده', '', '', true, 'statementPaid', true, 360),
  ('مانده_صورتحساب', 'مانده صورتحساب (پس از تخفیف)', 'event_statementRemaining', 'text', 'ثبت نشده', '', '', true, 'statementRemaining', true, 370),
  ('تخفیف_صورتحساب', 'مبلغ تخفیف صورتحساب', 'event_statementDiscount', 'text', 'ثبت نشده', '', '', true, 'statementDiscount', true, 380),
  ('توضیح_تخفیف_صورتحساب', 'توضیح تخفیف صورتحساب', 'event_statementDiscountNote', 'text', 'ثبت نشده', '', '', true, 'statementDiscountNote', true, 390),
  ('مبلغ_پرداخت_صورتحساب', 'مبلغ همین پرداخت صورتحساب', 'event_statementPaymentAmount', 'text', 'ثبت نشده', '', '', true, 'statementPaymentAmount', true, 400),
  ('روش_پرداخت', 'روش پرداخت', 'event_statementPaymentMethod', 'text', 'ثبت نشده', '', '', true, 'statementPaymentMethod', true, 410),
  ('تاریخ_واریز_صورتحساب', 'تاریخ واریز / سررسید چک', 'event_statementDepositDate', 'text', 'ثبت نشده', '', '', true, 'statementDepositDate', true, 420),
  ('سهم_سفارش_ها', 'سهم پرداخت از هر سفارش و صورتحساب', 'event_statementAllocation', 'text', 'ثبت نشده', '', '', true, 'statementAllocation', true, 430),
  ('کد_سفارش_های_صورتحساب', 'کد سفارش‌های صورتحساب / پرداخت', 'event_statementOrderCodes', 'text', 'ثبت نشده', '', '', true, 'statementOrderCodes', true, 440),
  ('تاریخ_بستن_صورتحساب', 'تاریخ بستن صورتحساب', 'event_statementClosedDate', 'text', 'ثبت نشده', '', '', true, 'statementClosedDate', true, 450)
ON CONFLICT (token) DO NOTHING;

INSERT INTO public.sms_templates (
  key, title, description, scope, stage_key, template, default_template, enabled,
  recipient_kinds, recipient_roles, recipient_phones, display_tab
) VALUES
  (
    'custom_statement_payment_customer',
    'ثبت پرداخت صورتحساب (مشتری)',
    'اطلاع‌رسانی به مشتری پس از ثبت پرداخت در صورتحساب با ذکر سهم هر سفارش',
    'custom',
    'statement_payment',
    E'مشتری گرامی {نام_مشتری}، پرداخت به مبلغ {مبلغ_پرداخت_صورتحساب} ({روش_پرداخت}) در تاریخ {تاریخ_واریز_صورتحساب} ثبت شد.\nجزئیات تخصیص: {سهم_سفارش_ها}\nمانده صورتحساب: {مانده_صورتحساب}',
    E'مشتری گرامی {نام_مشتری}، پرداخت به مبلغ {مبلغ_پرداخت_صورتحساب} ({روش_پرداخت}) در تاریخ {تاریخ_واریز_صورتحساب} ثبت شد.\nجزئیات تخصیص: {سهم_سفارش_ها}\nمانده صورتحساب: {مانده_صورتحساب}',
    false,
    ARRAY['customer']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    'customer'
  ),
  (
    'custom_statement_discount_customer',
    'تخفیف صورتحساب (مشتری)',
    'اطلاع‌رسانی به مشتری پس از ثبت یا تغییر تخفیف صورتحساب',
    'custom',
    'statement_discount',
    E'مشتری گرامی {نام_مشتری}، تخفیف به مبلغ {تخفیف_صورتحساب} برای صورتحساب {شماره_صورتحساب} ثبت شد.\nتوضیح: {توضیح_تخفیف_صورتحساب}\nمانده جدید: {مانده_صورتحساب}',
    E'مشتری گرامی {نام_مشتری}، تخفیف به مبلغ {تخفیف_صورتحساب} برای صورتحساب {شماره_صورتحساب} ثبت شد.\nتوضیح: {توضیح_تخفیف_صورتحساب}\nمانده جدید: {مانده_صورتحساب}',
    false,
    ARRAY['customer']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    'customer'
  ),
  (
    'custom_statement_closed_customer',
    'بستن صورتحساب (مشتری)',
    'اطلاع‌رسانی به مشتری هنگام بسته شدن صورتحساب',
    'custom',
    'statement_closed',
    E'مشتری گرامی {نام_مشتری}، صورتحساب {شماره_صورتحساب} در تاریخ {تاریخ_بستن_صورتحساب} بسته شد.\nجمع کل: {مبلغ_کل_صورتحساب} | پرداخت‌شده: {پرداخت_شده_صورتحساب} | مانده: {مانده_صورتحساب}',
    E'مشتری گرامی {نام_مشتری}، صورتحساب {شماره_صورتحساب} در تاریخ {تاریخ_بستن_صورتحساب} بسته شد.\nجمع کل: {مبلغ_کل_صورتحساب} | پرداخت‌شده: {پرداخت_شده_صورتحساب} | مانده: {مانده_صورتحساب}',
    false,
    ARRAY['customer']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    'customer'
  )
ON CONFLICT (key) DO NOTHING;