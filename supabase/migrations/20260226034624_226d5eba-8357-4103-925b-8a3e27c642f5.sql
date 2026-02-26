-- ثبت پرداخت آنلاین سفارش 1000266 که در order_payments ثبت نشده بود
INSERT INTO order_payments (order_id, paid_by, amount, payment_method, receipt_number, notes, payment_date)
VALUES (
  '9ac939bd-49da-42fa-8d27-d8066c80ebcc',
  '9dd2b192-c33e-4f38-9636-31c73656b1bc',
  80000,
  'zarinpal',
  '83350763601',
  'پرداخت آنلاین زرین‌پال - کد پیگیری: 83350763601 (ثبت اصلاحی)',
  '2026-02-25T03:59:39.627Z'
);

-- بروزرسانی total_paid
UPDATE projects_v3 SET total_paid = 80000 WHERE id = '9ac939bd-49da-42fa-8d27-d8066c80ebcc';