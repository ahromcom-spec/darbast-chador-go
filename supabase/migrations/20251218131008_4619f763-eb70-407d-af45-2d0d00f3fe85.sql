-- Add 'collected' value to execution_stage enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'collected' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'execution_stage')
  ) THEN
    ALTER TYPE public.execution_stage ADD VALUE 'collected';
  END IF;
END $$;