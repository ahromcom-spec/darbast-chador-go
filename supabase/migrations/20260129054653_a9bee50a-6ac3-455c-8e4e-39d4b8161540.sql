-- ============================================
-- BANK CARDS TABLE - کارت‌های حساب بانکی
-- ============================================

-- جدول کارت‌های بانکی
CREATE TABLE bank_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_name VARCHAR(255) NOT NULL, -- نام کارت (مثلا: کارت اصلی شرکت)
  bank_name VARCHAR(255) NOT NULL, -- نام بانک
  card_number VARCHAR(20), -- شماره کارت (اختیاری)
  initial_balance NUMERIC(15,2) NOT NULL DEFAULT 0, -- موجودی اولیه
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0, -- موجودی فعلی
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE, -- تاریخ ثبت
  notes TEXT, -- توضیحات
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- جدول تراکنش‌های کارت بانکی
CREATE TABLE bank_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_card_id UUID NOT NULL REFERENCES bank_cards(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'deposit' یا 'withdrawal'
  amount NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  description TEXT,
  reference_type VARCHAR(50), -- 'daily_report_staff', 'order_payment', 'manual'
  reference_id UUID, -- شناسه مرجع (daily_report_staff.id یا order_payment.id)
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- اضافه کردن ستون bank_card_id به جدول daily_report_staff
ALTER TABLE daily_report_staff 
ADD COLUMN IF NOT EXISTS bank_card_id UUID REFERENCES bank_cards(id);

-- اضافه کردن ستون bank_card_id به جدول order_payments
ALTER TABLE order_payments 
ADD COLUMN IF NOT EXISTS bank_card_id UUID REFERENCES bank_cards(id);

-- Enable RLS
ALTER TABLE bank_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_card_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_cards (only CEO can manage)
CREATE POLICY "CEO can view all bank cards"
ON bank_cards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'ceo'
  )
);

CREATE POLICY "CEO can insert bank cards"
ON bank_cards FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'ceo'
  )
);

CREATE POLICY "CEO can update bank cards"
ON bank_cards FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'ceo'
  )
);

CREATE POLICY "CEO can delete bank cards"
ON bank_cards FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'ceo'
  )
);

-- RLS Policies for bank_card_transactions
CREATE POLICY "CEO can view all transactions"
ON bank_card_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'ceo'
  )
);

CREATE POLICY "Authenticated users can insert transactions"
ON bank_card_transactions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Index for performance
CREATE INDEX idx_bank_cards_is_active ON bank_cards(is_active);
CREATE INDEX idx_bank_card_transactions_card_id ON bank_card_transactions(bank_card_id);
CREATE INDEX idx_bank_card_transactions_reference ON bank_card_transactions(reference_type, reference_id);
CREATE INDEX idx_daily_report_staff_bank_card ON daily_report_staff(bank_card_id);
CREATE INDEX idx_order_payments_bank_card ON order_payments(bank_card_id);