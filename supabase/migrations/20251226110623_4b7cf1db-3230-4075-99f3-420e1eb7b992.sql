-- First, merge duplicate daily reports (keep the oldest one for each date)
-- This function handles merging orders and staff from duplicate reports

DO $$
DECLARE
    dup_record RECORD;
    keep_id UUID;
    delete_id UUID;
BEGIN
    -- Loop through dates that have duplicates
    FOR dup_record IN
        SELECT report_date, array_agg(id ORDER BY created_at ASC) as ids
        FROM daily_reports
        GROUP BY report_date
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the first (oldest) report
        keep_id := dup_record.ids[1];
        
        -- Loop through duplicates to merge and delete
        FOR i IN 2..array_length(dup_record.ids, 1)
        LOOP
            delete_id := dup_record.ids[i];
            
            -- Move orders from duplicate to the kept report (if not already exists)
            UPDATE daily_report_orders
            SET daily_report_id = keep_id
            WHERE daily_report_id = delete_id
            AND order_id NOT IN (
                SELECT order_id FROM daily_report_orders WHERE daily_report_id = keep_id
            );
            
            -- Delete remaining duplicate orders (that already exist in kept report)
            DELETE FROM daily_report_orders WHERE daily_report_id = delete_id;
            
            -- Move staff from duplicate to kept report (if not already exists by staff_user_id or staff_name)
            UPDATE daily_report_staff
            SET daily_report_id = keep_id
            WHERE daily_report_id = delete_id
            AND (
                -- Staff not already in kept report
                (staff_user_id IS NOT NULL AND staff_user_id NOT IN (
                    SELECT staff_user_id FROM daily_report_staff 
                    WHERE daily_report_id = keep_id AND staff_user_id IS NOT NULL
                ))
                OR 
                (staff_user_id IS NULL AND staff_name NOT IN (
                    SELECT COALESCE(staff_name, '') FROM daily_report_staff 
                    WHERE daily_report_id = keep_id AND staff_user_id IS NULL
                ))
            );
            
            -- Delete remaining duplicate staff
            DELETE FROM daily_report_staff WHERE daily_report_id = delete_id;
            
            -- Now delete the duplicate report
            DELETE FROM daily_reports WHERE id = delete_id;
            
            RAISE NOTICE 'Merged report % into % for date %', delete_id, keep_id, dup_record.report_date;
        END LOOP;
    END LOOP;
END $$;

-- Add unique constraint on report_date to prevent future duplicates
-- Each date can only have ONE report
ALTER TABLE daily_reports
ADD CONSTRAINT daily_reports_report_date_unique UNIQUE (report_date);