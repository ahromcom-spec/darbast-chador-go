-- Enable RLS (idempotent)
ALTER TABLE public.bank_card_transactions ENABLE ROW LEVEL SECURITY;

-- Allow CEO to delete bank card transactions (needed to re-sync daily report edits without duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'bank_card_transactions' 
      AND policyname = 'CEO can delete bank card transactions'
  ) THEN
    CREATE POLICY "CEO can delete bank card transactions"
    ON public.bank_card_transactions
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'ceo'::app_role
      )
    );
  END IF;
END $$;