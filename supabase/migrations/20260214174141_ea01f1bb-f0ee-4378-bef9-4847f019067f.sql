-- Allow saving order report rows without selecting an order
ALTER TABLE daily_report_orders ALTER COLUMN order_id DROP NOT NULL;