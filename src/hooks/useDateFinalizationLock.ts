import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DateLockStatus {
  isLocked: boolean;
  lockedBy: string | null;
  lockedByName: string | null;
  lockedAt: string | null;
  lockedByModuleKey: string | null;
}

interface UseDateFinalizationLockOptions {
  reportDate: string; // YYYY-MM-DD
  enabled?: boolean;
}

interface UseDateFinalizationLockReturn {
  lockStatus: DateLockStatus;
  isLoading: boolean;
  isDateLocked: boolean;
  toggleLock: () => Promise<void>;
}

const DEFAULT_STATUS: DateLockStatus = {
  isLocked: false,
  lockedBy: null,
  lockedByName: null,
  lockedAt: null,
  lockedByModuleKey: null,
};

export function useDateFinalizationLock({
  reportDate,
  enabled = true,
}: UseDateFinalizationLockOptions): UseDateFinalizationLockReturn {
  const { user } = useAuth();
  const [lockStatus, setLockStatus] = useState<DateLockStatus>(DEFAULT_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchLockStatus = useCallback(async () => {
    if (!user || !enabled || !reportDate) {
      setLockStatus(DEFAULT_STATUS);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_report_date_locks')
        .select('*')
        .eq('report_date', reportDate)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Fetch locker's name
        let lockedByName: string | null = null;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', data.locked_by)
            .maybeSingle();
          lockedByName = profile?.full_name || null;
        } catch {}

        setLockStatus({
          isLocked: true,
          lockedBy: data.locked_by,
          lockedByName,
          lockedAt: data.locked_at,
          lockedByModuleKey: data.locked_by_module_key,
        });
      } else {
        setLockStatus(DEFAULT_STATUS);
      }
    } catch (error) {
      console.error('Error fetching date lock status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, enabled, reportDate]);

  const toggleLock = useCallback(async () => {
    if (!user || !reportDate) return;

    try {
      setIsLoading(true);
      
      if (lockStatus.isLocked) {
        // Optimistic update - immediately show unlocked
        setLockStatus(DEFAULT_STATUS);
        
        // Unlock - delete the lock record
        const { error } = await supabase
          .from('daily_report_date_locks')
          .delete()
          .eq('report_date', reportDate);

        if (error) {
          // Revert on error
          await fetchLockStatus();
          throw error;
        }
        toast.success('قفل تثبیت تاریخ برداشته شد');
      } else {
        // Optimistic update - immediately show locked
        setLockStatus({
          isLocked: true,
          lockedBy: user.id,
          lockedByName: null,
          lockedAt: new Date().toISOString(),
          lockedByModuleKey: 'aggregated',
        });
        
        // Lock - insert a lock record
        const { error } = await supabase
          .from('daily_report_date_locks')
          .insert({
            report_date: reportDate,
            locked_by: user.id,
            locked_by_module_key: 'aggregated',
          });

        if (error) {
          // Revert on error
          setLockStatus(DEFAULT_STATUS);
          if (error.code === '23505') {
            toast.error('این تاریخ قبلاً توسط کاربر دیگری قفل شده است');
          } else {
            throw error;
          }
          return;
        }
        toast.success('تاریخ تثبیت و قفل شد. ماژول‌های منبع دیگر قادر به ویرایش نیستند');
      }

      // Fetch accurate status from DB
      await fetchLockStatus();
    } catch (error) {
      console.error('Error toggling date lock:', error);
      toast.error('خطا در تغییر وضعیت قفل');
    } finally {
      setIsLoading(false);
    }
  }, [user, reportDate, lockStatus.isLocked, fetchLockStatus]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !enabled) return;

    const channel = supabase
      .channel(`date-lock-${reportDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_report_date_locks',
          filter: `report_date=eq.${reportDate}`,
        },
        () => {
          // Immediately refetch lock status on any change
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
  }, [user, enabled, reportDate, fetchLockStatus]);

  // Initial fetch
  useEffect(() => {
    fetchLockStatus();
  }, [fetchLockStatus]);

  return {
    lockStatus,
    isLoading,
    isDateLocked: lockStatus.isLocked,
    toggleLock,
  };
}
