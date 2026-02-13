DROP FUNCTION IF EXISTS public.get_module_lock_status(text, date);

CREATE OR REPLACE FUNCTION public.get_module_lock_status(p_module_key TEXT, p_module_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock RECORD;
    v_user_id UUID := auth.uid();
BEGIN
    SELECT 
        l.*,
        p.full_name as locked_by_name
    INTO v_lock
    FROM public.module_edit_locks l
    LEFT JOIN public.profiles p ON p.user_id = l.locked_by
    WHERE l.module_key = p_module_key AND l.module_date = p_module_date;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_locked', false,
            'can_edit', true,
            'locked_by', null,
            'locked_by_name', null
        );
    END IF;

    RETURN jsonb_build_object(
        'is_locked', true,
        'locked_by', v_lock.locked_by,
        'locked_by_name', v_lock.locked_by_name,
        'locked_at', v_lock.locked_at,
        'expires_at', v_lock.expires_at,
        'is_expired', v_lock.expires_at < now(),
        'is_mine', v_lock.locked_by = v_user_id,
        'can_edit', v_lock.locked_by = v_user_id OR v_lock.expires_at < now()
    );
END;
$$;