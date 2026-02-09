import { useRef, useCallback } from 'react';

interface OrderReportRow {
  id?: string;
  order_id: string;
  activity_description: string;
  service_details: string;
  team_name: string;
  notes: string;
  row_color: string;
  source_module_key?: string;
  source_module_name?: string;
  source_daily_report_id?: string;
  source_created_by?: string;
}

interface StaffReportRow {
  id?: string;
  staff_user_id: string | null;
  real_user_id?: string | null;
  staff_name: string;
  work_status: 'کارکرده' | 'غایب';
  overtime_hours: number;
  amount_received: number;
  receiving_notes: string;
  amount_spent: number;
  spending_notes: string;
  bank_card_id?: string | null;
  notes: string;
  is_cash_box: boolean;
  is_company_expense?: boolean;
  source_module_key?: string;
  source_module_name?: string;
  source_daily_report_id?: string;
  source_created_by?: string;
}

interface DateCacheEntry {
  orderReports: OrderReportRow[];
  staffReports: StaffReportRow[];
  dailyNotes: string;
  existingReportId: string | null;
  isDirty: boolean; // Has unsaved changes
  loadedFromDb: boolean; // Was initially loaded from database
}

interface UseDailyReportDateCacheReturn {
  /** Save current state for a specific date */
  cacheDate: (
    dateStr: string,
    data: {
      orderReports: OrderReportRow[];
      staffReports: StaffReportRow[];
      dailyNotes: string;
      existingReportId: string | null;
    },
    isDirty?: boolean
  ) => void;
  /** Get cached data for a date (returns undefined if not cached) */
  getCachedDate: (dateStr: string) => DateCacheEntry | undefined;
  /** Mark a date as saved (not dirty anymore) */
  markDateAsSaved: (dateStr: string) => void;
  /** Check if a date has unsaved changes */
  hasUnsavedChanges: (dateStr: string) => boolean;
  /** Get all dates with unsaved changes */
  getDirtyDates: () => string[];
  /** Clear cache for a specific date */
  clearDateCache: (dateStr: string) => void;
  /** Clear all cached data */
  clearAllCache: () => void;
  /** Get all cached entries for bulk save */
  getAllCachedData: () => Map<string, DateCacheEntry>;
  /** Update cache for current date when data changes */
  updateCurrentCache: (
    dateStr: string,
    data: Partial<{
      orderReports: OrderReportRow[];
      staffReports: StaffReportRow[];
      dailyNotes: string;
    }>
  ) => void;
}

/**
 * Hook to manage in-memory cache for daily report data across multiple dates.
 * This allows users to navigate between dates without losing unsaved changes.
 * All cached dates can be saved together when the user clicks save.
 */
export function useDailyReportDateCache(): UseDailyReportDateCacheReturn {
  // In-memory cache using a Map for O(1) lookups
  const cacheRef = useRef<Map<string, DateCacheEntry>>(new Map());

  const cacheDate = useCallback(
    (
      dateStr: string,
      data: {
        orderReports: OrderReportRow[];
        staffReports: StaffReportRow[];
        dailyNotes: string;
        existingReportId: string | null;
      },
      isDirty = false
    ) => {
      const existing = cacheRef.current.get(dateStr);
      cacheRef.current.set(dateStr, {
        ...data,
        isDirty: isDirty || existing?.isDirty || false,
        loadedFromDb: existing?.loadedFromDb ?? true,
      });
    },
    []
  );

  const getCachedDate = useCallback((dateStr: string): DateCacheEntry | undefined => {
    return cacheRef.current.get(dateStr);
  }, []);

  const markDateAsSaved = useCallback((dateStr: string) => {
    const entry = cacheRef.current.get(dateStr);
    if (entry) {
      cacheRef.current.set(dateStr, { ...entry, isDirty: false });
    }
  }, []);

  const hasUnsavedChanges = useCallback((dateStr: string): boolean => {
    const entry = cacheRef.current.get(dateStr);
    return entry?.isDirty ?? false;
  }, []);

  const getDirtyDates = useCallback((): string[] => {
    const dirtyDates: string[] = [];
    cacheRef.current.forEach((entry, dateStr) => {
      if (entry.isDirty) {
        dirtyDates.push(dateStr);
      }
    });
    return dirtyDates.sort();
  }, []);

  const clearDateCache = useCallback((dateStr: string) => {
    cacheRef.current.delete(dateStr);
  }, []);

  const clearAllCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const getAllCachedData = useCallback((): Map<string, DateCacheEntry> => {
    return new Map(cacheRef.current);
  }, []);

  const updateCurrentCache = useCallback(
    (
      dateStr: string,
      data: Partial<{
        orderReports: OrderReportRow[];
        staffReports: StaffReportRow[];
        dailyNotes: string;
      }>
    ) => {
      const existing = cacheRef.current.get(dateStr);
      if (existing) {
        cacheRef.current.set(dateStr, {
          ...existing,
          ...data,
          isDirty: true, // Mark as dirty when data changes
        });
      } else {
        // If no existing cache, create one with empty defaults
        cacheRef.current.set(dateStr, {
          orderReports: data.orderReports || [],
          staffReports: data.staffReports || [],
          dailyNotes: data.dailyNotes || '',
          existingReportId: null,
          isDirty: true,
          loadedFromDb: false,
        });
      }
    },
    []
  );

  return {
    cacheDate,
    getCachedDate,
    markDateAsSaved,
    hasUnsavedChanges,
    getDirtyDates,
    clearDateCache,
    clearAllCache,
    getAllCachedData,
    updateCurrentCache,
  };
}
