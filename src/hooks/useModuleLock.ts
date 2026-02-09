import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LockStatus {
  isLocked: boolean;
  lockedBy: string | null;
  lockedByName: string | null;
  lockedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  isMine: boolean;
  canEdit: boolean;
}

interface UseModuleLockOptions {
  moduleKey: string;
  moduleDate?: string; // YYYY-MM-DD format
  onForceTakeover?: (previousOwnerId: string) => Promise<void>;
  autoAcquire?: boolean;
}

interface UseModuleLockReturn {
  lockStatus: LockStatus;
  isLoading: boolean;
  isReadOnly: boolean;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  refreshLock: () => Promise<void>;
}

const DEFAULT_LOCK_STATUS: LockStatus = {
  isLocked: false,
  lockedBy: null,
  lockedByName: null,
  lockedAt: null,
  expiresAt: null,
  isExpired: false,
  isMine: false,
  canEdit: true,
};

export function useModuleLock({
  moduleKey,
  moduleDate,
  onForceTakeover,
  autoAcquire = false,
}: UseModuleLockOptions): UseModuleLockReturn {
  const { user } = useAuth();
  const [lockStatus, setLockStatus] = useState<LockStatus>(DEFAULT_LOCK_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Get today's date in YYYY-MM-DD format if not provided
  const effectiveDate = moduleDate || new Date().toISOString().split('T')[0];

  // Fetch current lock status
  const fetchLockStatus = useCallback(async () => {
    if (!user) {
      setLockStatus(DEFAULT_LOCK_STATUS);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_module_lock_status', {
        p_module_key: moduleKey,
        p_module_date: effectiveDate,
      });

      if (error) throw error;

      const status = data as any;
      setLockStatus({
        isLocked: status.is_locked || false,
        lockedBy: status.locked_by || null,
        lockedByName: status.locked_by_name || null,
        lockedAt: status.locked_at || null,
        expiresAt: status.expires_at || null,
        isExpired: status.is_expired || false,
        isMine: status.is_mine || false,
        canEdit: status.can_edit ?? true,
      });
    } catch (error) {
      console.error('Error fetching lock status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, moduleKey, effectiveDate]);

  // Acquire lock
  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('acquire_module_lock', {
        p_module_key: moduleKey,
        p_module_date: effectiveDate,
      });

      if (error) throw error;

      const result = data as any;
      
      if (result.success) {
        // If this was a force takeover, trigger the callback
        if (result.action === 'force_takeover' && result.previous_owner && onForceTakeover) {
          await onForceTakeover(result.previous_owner);
        }

        await fetchLockStatus();
        
        if (result.action === 'acquired') {
          toast.success('کنترل ویرایش فعال شد');
        } else if (result.action === 'force_takeover') {
          toast.success('کنترل ویرایش به شما منتقل شد');
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error acquiring lock:', error);
      toast.error('خطا در دریافت کنترل ویرایش');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, moduleKey, effectiveDate, onForceTakeover, fetchLockStatus]);

  // Release lock
  const releaseLock = useCallback(async () => {
    if (!user || !lockStatus.isMine) return;

    try {
      const { error } = await supabase.rpc('release_module_lock', {
        p_module_key: moduleKey,
        p_module_date: effectiveDate,
      });

      if (error) throw error;

      setLockStatus(DEFAULT_LOCK_STATUS);
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }, [user, moduleKey, effectiveDate, lockStatus.isMine]);

  // Refresh lock (heartbeat)
  const refreshLock = useCallback(async () => {
    if (!user || !lockStatus.isMine) return;

    try {
      const { data, error } = await supabase.rpc('refresh_module_lock', {
        p_module_key: moduleKey,
        p_module_date: effectiveDate,
      });

      if (error) throw error;

      // If refresh failed, someone else took over
      if (!data) {
        await fetchLockStatus();
        toast.warning('کنترل ویرایش توسط کاربر دیگری گرفته شد');
      }
    } catch (error) {
      console.error('Error refreshing lock:', error);
    }
  }, [user, moduleKey, effectiveDate, lockStatus.isMine, fetchLockStatus]);

  // Set up heartbeat when we have the lock
  useEffect(() => {
    if (lockStatus.isMine) {
      // Refresh every 5 minutes to keep lock active
      heartbeatIntervalRef.current = setInterval(() => {
        refreshLock();
      }, 5 * 60 * 1000);

      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      };
    }
  }, [lockStatus.isMine, refreshLock]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`module-lock-${moduleKey}-${effectiveDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'module_edit_locks',
          filter: `module_key=eq.${moduleKey}`,
        },
        (payload) => {
          // Lock changed, refetch status
          fetchLockStatus();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, moduleKey, effectiveDate, fetchLockStatus]);

  // Initial fetch and auto-acquire
  useEffect(() => {
    fetchLockStatus().then(() => {
      if (autoAcquire && user) {
        acquireLock();
      }
    });
  }, [fetchLockStatus, autoAcquire, user, acquireLock]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (lockStatus.isMine) {
        // Fire and forget release using async wrapper
        (async () => {
          try {
            await supabase.rpc('release_module_lock', {
              p_module_key: moduleKey,
              p_module_date: effectiveDate,
            });
          } catch {
            // Ignore errors on unmount
          }
        })();
      }
    };
  }, [moduleKey, effectiveDate, lockStatus.isMine]);

  // Refresh lock on user activity
  useEffect(() => {
    if (!lockStatus.isMine) return;

    const handleActivity = () => {
      refreshLock();
    };

    // Debounce activity events
    let timeout: NodeJS.Timeout;
    const debouncedActivity = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleActivity, 30000); // Refresh after 30s of activity
    };

    window.addEventListener('keydown', debouncedActivity);
    window.addEventListener('click', debouncedActivity);

    return () => {
      window.removeEventListener('keydown', debouncedActivity);
      window.removeEventListener('click', debouncedActivity);
      clearTimeout(timeout);
    };
  }, [lockStatus.isMine, refreshLock]);

  const isReadOnly = !lockStatus.canEdit;

  return {
    lockStatus,
    isLoading,
    isReadOnly,
    acquireLock,
    releaseLock,
    refreshLock,
  };
}
