-- ===================================================
-- Module Edit Locks Table: Track which user has edit control of a module
-- ===================================================

CREATE TABLE public.module_edit_locks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    module_key TEXT NOT NULL,
    module_date DATE NOT NULL DEFAULT CURRENT_DATE,
    locked_by UUID NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Unique lock per module per date
    UNIQUE(module_key, module_date)
);

-- Enable RLS
ALTER TABLE public.module_edit_locks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view locks
CREATE POLICY "Authenticated users can view locks"
ON public.module_edit_locks
FOR SELECT
TO authenticated
USING (true);

-- Users can insert locks (acquire lock)
CREATE POLICY "Authenticated users can acquire locks"
ON public.module_edit_locks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = locked_by);

-- Users can update their own locks (refresh, extend) or take over expired locks
CREATE POLICY "Users can update own locks or take expired"
ON public.module_edit_locks
FOR UPDATE
TO authenticated
USING (
    auth.uid() = locked_by 
    OR expires_at < now()
);

-- Users can delete their own locks (release)
CREATE POLICY "Users can release own locks"
ON public.module_edit_locks
FOR DELETE
TO authenticated
USING (auth.uid() = locked_by);

-- Enable realtime for locks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.module_edit_locks;

-- ===================================================
-- Module Version History Table: Store temporary versions of module data
-- ===================================================

CREATE TABLE public.module_version_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    module_key TEXT NOT NULL,
    module_date DATE NOT NULL,
    saved_by UUID NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    data_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Index for efficient cleanup
    CONSTRAINT positive_version CHECK (version_number > 0)
);

-- Enable RLS
ALTER TABLE public.module_version_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view version history
CREATE POLICY "Authenticated users can view history"
ON public.module_version_history
FOR SELECT
TO authenticated
USING (true);

-- Users can insert versions (save)
CREATE POLICY "Authenticated users can save versions"
ON public.module_version_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = saved_by);

-- Only admins or system can delete old versions (cleanup)
CREATE POLICY "System can delete old versions"
ON public.module_version_history
FOR DELETE
TO authenticated
USING (true);

-- Index for faster queries
CREATE INDEX idx_module_version_history_lookup 
ON public.module_version_history(module_key, module_date, version_number DESC);

-- ===================================================
-- Function: Acquire or take over a module lock
-- ===================================================

CREATE OR REPLACE FUNCTION public.acquire_module_lock(
    p_module_key TEXT,
    p_module_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_lock RECORD;
    v_user_id UUID := auth.uid();
    v_user_name TEXT;
    v_result JSONB;
BEGIN
    -- Get current user name
    SELECT full_name INTO v_user_name 
    FROM public.profiles 
    WHERE id = v_user_id;

    -- Check for existing lock
    SELECT * INTO v_current_lock
    FROM public.module_edit_locks
    WHERE module_key = p_module_key AND module_date = p_module_date
    FOR UPDATE;

    IF NOT FOUND THEN
        -- No lock exists, create new one
        INSERT INTO public.module_edit_locks (module_key, module_date, locked_by, locked_at, last_activity_at, expires_at)
        VALUES (p_module_key, p_module_date, v_user_id, now(), now(), now() + interval '30 minutes');
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'acquired',
            'locked_by', v_user_id,
            'locked_by_name', v_user_name
        );
    ELSIF v_current_lock.locked_by = v_user_id THEN
        -- Already have the lock, refresh it
        UPDATE public.module_edit_locks
        SET last_activity_at = now(), 
            expires_at = now() + interval '30 minutes',
            updated_at = now()
        WHERE id = v_current_lock.id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'refreshed',
            'locked_by', v_user_id,
            'locked_by_name', v_user_name
        );
    ELSIF v_current_lock.expires_at < now() THEN
        -- Lock is expired, take over
        UPDATE public.module_edit_locks
        SET locked_by = v_user_id,
            locked_at = now(),
            last_activity_at = now(),
            expires_at = now() + interval '30 minutes',
            updated_at = now()
        WHERE id = v_current_lock.id;
        
        v_result := jsonb_build_object(
            'success', true,
            'action', 'took_over_expired',
            'locked_by', v_user_id,
            'locked_by_name', v_user_name,
            'previous_owner', v_current_lock.locked_by
        );
    ELSE
        -- Someone else has active lock, take over (with auto-save trigger)
        v_result := jsonb_build_object(
            'success', true,
            'action', 'force_takeover',
            'previous_owner', v_current_lock.locked_by,
            'locked_by', v_user_id,
            'locked_by_name', v_user_name
        );
        
        -- Take over the lock
        UPDATE public.module_edit_locks
        SET locked_by = v_user_id,
            locked_at = now(),
            last_activity_at = now(),
            expires_at = now() + interval '30 minutes',
            updated_at = now()
        WHERE id = v_current_lock.id;
    END IF;

    RETURN v_result;
END;
$$;

-- ===================================================
-- Function: Release a module lock
-- ===================================================

CREATE OR REPLACE FUNCTION public.release_module_lock(
    p_module_key TEXT,
    p_module_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    DELETE FROM public.module_edit_locks
    WHERE module_key = p_module_key 
        AND module_date = p_module_date 
        AND locked_by = v_user_id;
    
    RETURN FOUND;
END;
$$;

-- ===================================================
-- Function: Refresh lock activity (heartbeat)
-- ===================================================

CREATE OR REPLACE FUNCTION public.refresh_module_lock(
    p_module_key TEXT,
    p_module_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    UPDATE public.module_edit_locks
    SET last_activity_at = now(),
        expires_at = now() + interval '30 minutes',
        updated_at = now()
    WHERE module_key = p_module_key 
        AND module_date = p_module_date 
        AND locked_by = v_user_id;
    
    RETURN FOUND;
END;
$$;

-- ===================================================
-- Function: Save version and cleanup old versions
-- ===================================================

CREATE OR REPLACE FUNCTION public.save_module_version(
    p_module_key TEXT,
    p_module_date DATE,
    p_data_snapshot JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_next_version INT;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.module_version_history
    WHERE module_key = p_module_key AND module_date = p_module_date;

    -- Insert new version
    INSERT INTO public.module_version_history (module_key, module_date, saved_by, version_number, data_snapshot)
    VALUES (p_module_key, p_module_date, v_user_id, v_next_version, p_data_snapshot);

    -- Cleanup: Keep only last 10 versions
    DELETE FROM public.module_version_history
    WHERE module_key = p_module_key 
        AND module_date = p_module_date
        AND version_number <= (v_next_version - 10);

    RETURN v_next_version;
END;
$$;

-- ===================================================
-- Function: Get module lock status
-- ===================================================

CREATE OR REPLACE FUNCTION public.get_module_lock_status(
    p_module_key TEXT,
    p_module_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock RECORD;
    v_user_id UUID := auth.uid();
    v_user_name TEXT;
BEGIN
    SELECT 
        l.*,
        p.full_name as locked_by_name
    INTO v_lock
    FROM public.module_edit_locks l
    LEFT JOIN public.profiles p ON p.id = l.locked_by
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