import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface OrderReportRow {
  id?: string;
  order_id: string;
  activity_description: string;
  service_details: string;
  team_name: string;
  notes: string;
  row_color: string;
}

export interface StaffReportRow {
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
  notes: string;
  is_cash_box: boolean;
}

export interface Order {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone?: string | null;
  address: string;
  subcategory_name?: string;
  activity_description?: string;
}

export interface StaffMember {
  user_id: string;
  full_name: string;
  phone_number: string;
}

export interface SavedReport {
  id: string;
  report_date: string;
  created_at: string;
  notes: string | null;
  orders_count: number;
  staff_count: number;
  is_archived?: boolean;
  archived_at?: string | null;
}

// Constants
export const ROW_COLORS = [
  { value: 'yellow', label: 'زرد', class: 'bg-yellow-400' },
  { value: 'gold', label: 'طلایی', class: 'bg-yellow-500' },
  { value: 'cyan', label: 'فیروزه‌ای', class: 'bg-cyan-400' },
  { value: 'purple', label: 'بنفش', class: 'bg-purple-500' },
  { value: 'peach', label: 'هلویی', class: 'bg-orange-300' },
  { value: 'brown', label: 'قهوه‌ای', class: 'bg-amber-700' },
  { value: 'olive', label: 'زیتونی', class: 'bg-amber-800' },
  { value: 'green', label: 'سبز', class: 'bg-green-500' },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return UUID_REGEX.test(value);
};

const MANAGER_ROLES = new Set([
  'admin',
  'ceo',
  'general_manager',
  'scaffold_executive_manager',
  'executive_manager_scaffold_execution_with_materials',
]);

const isManagerUser = async (userId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  return (data || []).some((r: any) => MANAGER_ROLES.has(r.role));
};

const extractStaffCode = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const phoneMatch = value.match(/09\d{9}/);
  if (phoneMatch) return phoneMatch[0];
  const codeMatch = value.match(/\b\d{4}\b/);
  return codeMatch?.[0] ?? '';
};

const toDbWorkStatus = (value: unknown): 'حاضر' | 'غایب' => {
  return value === 'کارکرده' || value === 'حاضر' ? 'حاضر' : 'غایب';
};

const fromDbWorkStatus = (value: unknown): 'کارکرده' | 'غایب' => {
  return value === 'حاضر' ? 'کارکرده' : 'غایب';
};

// تبدیل تاریخ به فرمت YYYY-MM-DD با استفاده از تاریخ محلی (نه UTC)
// این تابع مهم است چون toISOString() از UTC استفاده می‌کند و ممکن است تاریخ را اشتباه نشان دهد
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createEmptyOrderRow = (index: number): OrderReportRow => ({
  order_id: '',
  activity_description: '',
  service_details: '',
  team_name: '',
  notes: '',
  row_color: ROW_COLORS[index % ROW_COLORS.length].value,
});

const createEmptyStaffRow = (): StaffReportRow => ({
  staff_user_id: null,
  staff_name: '',
  work_status: 'غایب',
  overtime_hours: 0,
  amount_received: 0,
  receiving_notes: '',
  amount_spent: 0,
  spending_notes: '',
  notes: '',
  is_cash_box: false,
});

const createCashBoxRow = (): StaffReportRow => ({
  staff_user_id: null,
  staff_name: 'کارت صندوق اهرم',
  work_status: 'کارکرده',
  overtime_hours: 0,
  amount_received: 0,
  receiving_notes: '',
  amount_spent: 0,
  spending_notes: '',
  notes: '',
  is_cash_box: true,
});

export function useDailyReport() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Core state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Report date - initialized from URL if available
  const [reportDate, setReportDate] = useState<Date>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  });
  
  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [orderReports, setOrderReports] = useState<OrderReportRow[]>([]);
  const [staffReports, setStaffReports] = useState<StaffReportRow[]>([]);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  
  // Refs
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // LocalStorage key for backup
  const getLocalStorageKey = useCallback(() => {
    const dateStr = toLocalDateString(reportDate);
    return `daily_report_backup_${user?.id}_${dateStr}`;
  }, [reportDate, user]);

  // Save to localStorage as backup
  const saveToLocalStorage = useCallback(() => {
    if (!user) return;
    try {
      const backupData = {
        orderReports,
        staffReports,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(backupData));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, [orderReports, staffReports, user, getLocalStorageKey]);

  // Load from localStorage backup
  const loadFromLocalStorage = useCallback(() => {
    if (!user) return null;
    try {
      const data = localStorage.getItem(getLocalStorageKey());
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
    return null;
  }, [user, getLocalStorageKey]);

  // Clear localStorage backup
  const clearLocalStorageBackup = useCallback(() => {
    if (!user) return;
    try {
      localStorage.removeItem(getLocalStorageKey());
    } catch (e) {
      console.error('Error clearing localStorage backup:', e);
    }
  }, [user, getLocalStorageKey]);

  // Extract activity description from notes JSON
  const extractActivityDescription = (notes: any): string => {
    if (!notes) return '';
    try {
      const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
      // Try locationPurpose first (for facade scaffolding), then description (for expert pricing)
      return parsed.locationPurpose || parsed.description || '';
    } catch {
      return '';
    }
  };

  // Fetch orders from database
  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          customer_name,
          customer_phone,
          address,
          subcategory_id,
          notes,
          subcategories!projects_v3_subcategory_id_fkey(name)
        `)
        .eq('is_archived', false)
        .eq('is_deep_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders((data || []).map((o: any) => ({
        id: o.id,
        code: o.code,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        address: o.address,
        subcategory_name: o.subcategories?.name,
        activity_description: extractActivityDescription(o.notes)
      })));
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  }, []);

  // Fetch staff members
  const fetchStaffMembers = useCallback(async () => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'sales_manager', 'general_manager', 'finance_manager']);

      if (roleError) throw roleError;

      if (roleData && roleData.length > 0) {
        const userIds = roleData.map(r => r.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone_number')
          .in('user_id', userIds);

        if (profileError) throw profileError;

        setStaffMembers((profiles || []).map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name || 'بدون نام',
          phone_number: p.phone_number || ''
        })));
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  }, []);

  // Fetch existing report for current date
  const fetchExistingReport = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const dateStr = toLocalDateString(reportDate);

      const localBackup = loadFromLocalStorage();
      const hasLocalBackup = localBackup && 
        ((localBackup.orderReports && localBackup.orderReports.some((r: any) => r.order_id)) ||
         (localBackup.staffReports && localBackup.staffReports.length > 0));

      const isManager = await isManagerUser(user.id);

      let reportIdToLoad: string | null = null;

      if (isManager) {
        const { data: myReport, error: myReportError } = await supabase
          .from('daily_reports')
          .select('id')
          .eq('report_date', dateStr)
          .eq('created_by', user.id)
          .maybeSingle();

        if (myReportError) throw myReportError;

        if (myReport?.id) {
          reportIdToLoad = myReport.id;
        } else {
          const { data: anyReport, error: anyReportError } = await supabase
            .from('daily_reports')
            .select('id')
            .eq('report_date', dateStr)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (anyReportError) throw anyReportError;
          reportIdToLoad = anyReport?.id ?? null;
        }
      } else {
        const { data: candidateReports, error: candidatesError } = await supabase
          .from('daily_reports')
          .select('id')
          .eq('report_date', dateStr)
          .order('created_at', { ascending: false });

        if (candidatesError) throw candidatesError;

        const candidateIds = (candidateReports || []).map((r: any) => r.id);

        if (candidateIds.length > 0) {
          const { data: staffRow, error: staffRowError } = await supabase
            .from('daily_report_staff')
            .select('daily_report_id')
            .eq('staff_user_id', user.id)
            .in('daily_report_id', candidateIds)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (staffRowError) throw staffRowError;
          reportIdToLoad = staffRow?.daily_report_id ?? null;
        }
      }

      if (reportIdToLoad) {
        setExistingReportId(reportIdToLoad);

        const { data: orderData } = await supabase
          .from('daily_report_orders')
          .select('*')
          .eq('daily_report_id', reportIdToLoad);

        setOrderReports((orderData || []).map((o: any) => ({
          id: o.id,
          order_id: o.order_id,
          activity_description: o.activity_description || '',
          service_details: o.service_details || '',
          team_name: o.team_name || '',
          notes: o.notes || '',
          row_color: o.row_color || 'yellow',
        })));

        const { data: staffData } = await supabase
          .from('daily_report_staff')
          .select('*')
          .eq('daily_report_id', reportIdToLoad);

        const allStaff: StaffReportRow[] = (staffData || []).map((s: any) => {
          const staffCode = extractStaffCode(s.staff_name || '');

          return {
            id: s.id,
            staff_user_id: staffCode || null,
            staff_name: s.staff_name || '',
            real_user_id: s.staff_user_id || null,
            work_status: fromDbWorkStatus(s.work_status),
            overtime_hours: s.overtime_hours || 0,
            amount_received: s.amount_received || 0,
            receiving_notes: s.receiving_notes || '',
            amount_spent: s.amount_spent || 0,
            spending_notes: s.spending_notes || '',
            notes: s.notes || '',
            is_cash_box: s.is_cash_box || false,
          };
        });

        const cashBoxRows = allStaff.filter((s) => s.is_cash_box);
        const nonCashBoxRows = allStaff.filter((s) => !s.is_cash_box);
        
        const normalizedStaff: StaffReportRow[] = [];
        
        if (cashBoxRows.length > 0) {
          normalizedStaff.push(cashBoxRows[0]);
        } else {
          normalizedStaff.push(createCashBoxRow());
        }
        
        normalizedStaff.push(...nonCashBoxRows);

        const hasAnyNonCashRow = normalizedStaff.some((s) => !s.is_cash_box);
        if (!hasAnyNonCashRow) {
          normalizedStaff.push(createEmptyStaffRow());
        }

        setStaffReports(normalizedStaff);
        
        if (hasLocalBackup && localBackup.savedAt) {
          const backupTime = new Date(localBackup.savedAt).getTime();
          const oneMinuteAgo = Date.now() - 60000;
          
          if (backupTime > oneMinuteAgo) {
            const backupOrdersWithData = (localBackup.orderReports || []).filter((r: any) => r.order_id);
            const dbOrdersCount = orderData?.length || 0;
            
            if (backupOrdersWithData.length > dbOrdersCount) {
              setOrderReports(localBackup.orderReports);
              setStaffReports(localBackup.staffReports);
              toast.success('داده‌های ذخیره نشده بازیابی شدند');
            }
          }
        }
      } else {
        setExistingReportId(null);
        
        if (hasLocalBackup) {
          setOrderReports(localBackup.orderReports);
          setStaffReports(localBackup.staffReports);
          toast.success('داده‌های ذخیره نشده قبلی بازیابی شدند');
        } else {
          setOrderReports([createEmptyOrderRow(0)]);
          setStaffReports([createCashBoxRow(), createEmptyStaffRow()]);
        }
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      
      const localBackup = loadFromLocalStorage();
      if (localBackup) {
        setOrderReports(localBackup.orderReports || []);
        setStaffReports(localBackup.staffReports || []);
        toast.info('داده‌ها از حافظه محلی بازیابی شدند');
      }
    } finally {
      setLoading(false);
    }
  }, [user, reportDate, loadFromLocalStorage]);

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!user || loading || isInitialLoadRef.current) return;
    
    if (orderReports.length === 0 && staffReports.length === 0) return;

    const hasOrderData = orderReports.some((r) => r.order_id);

    const hasStaffData = staffReports.some(
      (s) =>
        !s.is_cash_box &&
        (Boolean(s.staff_user_id) ||
          Boolean(s.staff_name?.trim()) ||
          (s.overtime_hours ?? 0) > 0 ||
          (s.amount_received ?? 0) > 0 ||
          (s.amount_spent ?? 0) > 0 ||
          Boolean(s.receiving_notes?.trim()) ||
          Boolean(s.spending_notes?.trim()) ||
          Boolean(s.notes?.trim()))
    );

    const hasCashBox = staffReports.some((s) => s.is_cash_box);

    if (!hasOrderData && !hasStaffData && !hasCashBox) return;

    const staffToSave = staffReports.filter(
      (s) =>
        s.is_cash_box ||
        Boolean(s.staff_user_id) ||
        Boolean(s.staff_name?.trim()) ||
        (s.overtime_hours ?? 0) > 0 ||
        (s.amount_received ?? 0) > 0 ||
        (s.amount_spent ?? 0) > 0 ||
        Boolean(s.receiving_notes?.trim()) ||
        Boolean(s.spending_notes?.trim()) ||
        Boolean(s.notes?.trim())
    );

    try {
      setAutoSaveStatus('saving');
      const dateStr = toLocalDateString(reportDate);

      let reportId = existingReportId;

      if (!reportId) {
        const { data: newReport, error: createError } = await supabase
          .from('daily_reports')
          .insert({
            report_date: dateStr,
            created_by: user.id
          })
          .select('id')
          .single();

        if (createError) throw createError;
        reportId = newReport.id;
        setExistingReportId(reportId);
      }

      const { error: deleteOrdersError } = await supabase
        .from('daily_report_orders')
        .delete()
        .eq('daily_report_id', reportId);

      if (deleteOrdersError) throw deleteOrdersError;

      if (orderReports.filter((r) => r.order_id).length > 0) {
        const { error: insertOrdersError } = await supabase
          .from('daily_report_orders')
          .insert(
            orderReports.filter((r) => r.order_id).map((r) => ({
              daily_report_id: reportId,
              order_id: r.order_id,
              activity_description: r.activity_description,
              service_details: r.service_details,
              team_name: r.team_name,
              notes: r.notes,
              row_color: r.row_color
            }))
          );

        if (insertOrdersError) throw insertOrdersError;
      }

      const { error: deleteStaffError } = await supabase
        .from('daily_report_staff')
        .delete()
        .eq('daily_report_id', reportId);

      if (deleteStaffError) throw deleteStaffError;

      if (staffToSave.length > 0) {
        const { error: insertStaffError } = await supabase
          .from('daily_report_staff')
          .insert(
            staffToSave.map((s) => ({
              daily_report_id: reportId,
              staff_user_id: s.real_user_id || (isUuid(s.staff_user_id) ? s.staff_user_id : null),
              staff_name: s.staff_name || '',
              work_status: toDbWorkStatus(s.work_status),
              overtime_hours: s.overtime_hours,
              amount_received: s.amount_received,
              receiving_notes: s.receiving_notes,
              amount_spent: s.amount_spent,
              spending_notes: s.spending_notes,
              notes: s.notes,
              is_cash_box: s.is_cash_box
            }))
          );

        if (insertStaffError) throw insertStaffError;
      }

      clearLocalStorageBackup();
      
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('idle');
    }
  }, [user, loading, reportDate, existingReportId, orderReports, staffReports, clearLocalStorageBackup]);

  // Add order row
  const addOrderRow = useCallback(() => {
    setOrderReports(prev => [...prev, createEmptyOrderRow(prev.length)]);
  }, []);

  // Remove order row
  const removeOrderRow = useCallback((index: number) => {
    setOrderReports(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update order row
  const updateOrderRow = useCallback((index: number, field: keyof OrderReportRow, value: string) => {
    setOrderReports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      const isRowEmpty = (row: OrderReportRow) => 
        !row.order_id && 
        !row.activity_description?.trim() && 
        !row.service_details?.trim() && 
        !row.team_name?.trim() && 
        !row.notes?.trim();

      let emptyRowsAtEnd = 0;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (isRowEmpty(updated[i])) {
          emptyRowsAtEnd++;
        } else {
          break;
        }
      }

      if (emptyRowsAtEnd === 0) {
        updated.push(createEmptyOrderRow(updated.length));
      } else if (emptyRowsAtEnd > 1) {
        const rowsToRemove = emptyRowsAtEnd - 1;
        updated.splice(updated.length - rowsToRemove, rowsToRemove);
      }

      return updated;
    });
  }, []);

  // Add staff row
  const addStaffRow = useCallback(() => {
    setStaffReports(prev => [...prev, createEmptyStaffRow()]);
  }, []);

  // Remove staff row
  const removeStaffRow = useCallback((index: number) => {
    if (staffReports[index]?.is_cash_box) {
      toast.error('ردیف صندوق قابل حذف نیست');
      return;
    }
    setStaffReports(prev => prev.filter((_, i) => i !== index));
  }, [staffReports]);

  // Update staff row
  const updateStaffRow = useCallback((index: number, field: keyof StaffReportRow, value: any) => {
    setStaffReports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'staff_user_id' && value) {
        const staff = staffMembers.find((s) => s.user_id === value);
        if (staff) {
          updated[index].staff_name = staff.full_name;
        }
      }

      const isRowEmpty = (row: StaffReportRow) => 
        !row.is_cash_box &&
        !row.staff_user_id &&
        !row.staff_name?.trim() &&
        !row.receiving_notes?.trim() &&
        !row.spending_notes?.trim() &&
        !row.notes?.trim() &&
        (row.overtime_hours ?? 0) === 0 &&
        (row.amount_received ?? 0) === 0 &&
        (row.amount_spent ?? 0) === 0;

      const nonCashBoxRows = updated.filter((r) => !r.is_cash_box);
      
      let emptyRowsAtEnd = 0;
      for (let i = nonCashBoxRows.length - 1; i >= 0; i--) {
        if (isRowEmpty(nonCashBoxRows[i])) {
          emptyRowsAtEnd++;
        } else {
          break;
        }
      }

      if (emptyRowsAtEnd === 0) {
        updated.push(createEmptyStaffRow());
      } else if (emptyRowsAtEnd > 1) {
        const rowsToRemove = emptyRowsAtEnd - 1;
        let removed = 0;
        for (let i = updated.length - 1; i >= 0 && removed < rowsToRemove; i--) {
          if (isRowEmpty(updated[i])) {
            updated.splice(i, 1);
            removed++;
          }
        }
      }

      return updated;
    });
  }, [staffMembers]);

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const presentCount = staffReports.filter(s => s.work_status === 'کارکرده' && !s.is_cash_box).length;
    const totalOvertime = staffReports.reduce((sum, s) => sum + (s.overtime_hours || 0), 0);
    
    const cashBoxSpent = staffReports
      .filter(s => s.is_cash_box)
      .reduce((sum, s) => sum + (s.amount_spent || 0), 0);
    
    const staffReceived = staffReports
      .filter(s => !s.is_cash_box)
      .reduce((sum, s) => sum + (s.amount_received || 0), 0);
    
    const totalReceived = staffReports.reduce((sum, s) => sum + (s.amount_received || 0), 0);
    const totalSpent = staffReports.reduce((sum, s) => sum + (s.amount_spent || 0), 0);
    
    return { presentCount, totalOvertime, totalReceived, totalSpent, cashBoxSpent, staffReceived };
  }, [staffReports]);

  // Save report
  const saveReport = useCallback(async () => {
    if (!user) return false;

    try {
      setSaving(true);
      const dateStr = toLocalDateString(reportDate);

      let reportId = existingReportId;

      if (!reportId) {
        const { data: newReport, error: createError } = await supabase
          .from('daily_reports')
          .insert({
            report_date: dateStr,
            created_by: user.id
          })
          .select('id')
          .single();

        if (createError) throw createError;
        reportId = newReport.id;
        setExistingReportId(reportId);
      }

      const { error: deleteOrderError } = await supabase
        .from('daily_report_orders')
        .delete()
        .eq('daily_report_id', reportId);

      if (deleteOrderError) throw deleteOrderError;

      const ordersToInsert = orderReports.filter(r => r.order_id);
      if (ordersToInsert.length > 0) {
        const { error: orderError } = await supabase
          .from('daily_report_orders')
          .insert(ordersToInsert.map(r => ({
            daily_report_id: reportId,
            order_id: r.order_id,
            activity_description: r.activity_description || '',
            service_details: r.service_details || '',
            team_name: r.team_name || '',
            notes: r.notes || '',
            row_color: r.row_color || 'yellow'
          })));

        if (orderError) throw orderError;
      }

      const { error: deleteStaffError } = await supabase
        .from('daily_report_staff')
        .delete()
        .eq('daily_report_id', reportId);

      if (deleteStaffError) throw deleteStaffError;

      const staffToSave = staffReports.filter(
        (s) =>
          s.is_cash_box ||
          Boolean(s.staff_user_id) ||
          Boolean(s.staff_name?.trim()) ||
          (s.overtime_hours ?? 0) > 0 ||
          (s.amount_received ?? 0) > 0 ||
          (s.amount_spent ?? 0) > 0 ||
          Boolean(s.receiving_notes?.trim()) ||
          Boolean(s.spending_notes?.trim()) ||
          Boolean(s.notes?.trim())
      );

      if (staffToSave.length > 0) {
        const staffPayload = staffToSave.map((s) => ({
          daily_report_id: reportId,
          staff_user_id: s.real_user_id || (isUuid(s.staff_user_id) ? s.staff_user_id : null),
          staff_name: s.staff_name || '',
          work_status: toDbWorkStatus(s.work_status),
          overtime_hours: s.overtime_hours || 0,
          amount_received: s.amount_received || 0,
          receiving_notes: s.receiving_notes || '',
          amount_spent: s.amount_spent || 0,
          spending_notes: s.spending_notes || '',
          notes: s.notes || '',
          is_cash_box: s.is_cash_box || false
        }));

        const { error: staffError } = await supabase
          .from('daily_report_staff')
          .insert(staffPayload);

        if (staffError) throw staffError;
      }

      toast.success('گزارش با موفقیت ذخیره شد');
      clearLocalStorageBackup();
      
      // Reset form
      setExistingReportId(null);
      setOrderReports([createEmptyOrderRow(0)]);
      setStaffReports([createCashBoxRow(), createEmptyStaffRow()]);
      setReportDate(new Date());
      
      return true;
    } catch (error: any) {
      console.error('Error saving report:', error);
      const errorMessage = error?.message || error?.details || 'خطای نامشخص';
      toast.error(`خطا در ذخیره گزارش: ${errorMessage}`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, reportDate, existingReportId, orderReports, staffReports, clearLocalStorageBackup]);

  // Effects
  useEffect(() => {
    fetchOrders();
    fetchStaffMembers();
  }, [fetchOrders, fetchStaffMembers]);

  useEffect(() => {
    if (user && reportDate) {
      setOrderReports([]);
      setStaffReports([]);
      setExistingReportId(null);
      isInitialLoadRef.current = true;
      fetchExistingReport();
    }
  }, [reportDate, user, fetchExistingReport]);

  // Save to localStorage on every change
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (orderReports.length === 0 && staffReports.length === 0) return;
    saveToLocalStorage();
  }, [orderReports, staffReports, saveToLocalStorage]);

  // Auto-save with debounce
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    
    if (orderReports.length === 0 && staffReports.length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [orderReports, staffReports, performAutoSave]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      performAutoSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [performAutoSave]);

  return {
    // State
    loading,
    saving,
    autoSaveStatus,
    reportDate,
    orders,
    staffMembers,
    orderReports,
    staffReports,
    existingReportId,
    
    // Setters
    setReportDate,
    setOrderReports,
    setStaffReports,
    
    // Actions
    addOrderRow,
    removeOrderRow,
    updateOrderRow,
    addStaffRow,
    removeStaffRow,
    updateStaffRow,
    saveReport,
    calculateTotals,
    
    // Utilities
    fetchOrders,
    fetchStaffMembers,
  };
}

// Export helper functions for use in components
export { isUuid, isManagerUser, toDbWorkStatus, fromDbWorkStatus };
