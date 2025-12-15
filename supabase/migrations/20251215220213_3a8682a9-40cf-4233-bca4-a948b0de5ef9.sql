-- Step 1: Add new role for rental executive manager
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rental_executive_manager';