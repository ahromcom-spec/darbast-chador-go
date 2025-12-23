import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Plus, Trash2, Save, Loader2, User, Package, History, FileText, Eye, Check, ExternalLink, Calculator, Settings, CheckSquare, Square, Archive, ArchiveRestore } from 'lucide-react';
import { useDailyReportBulkDelete } from '@/hooks/useDailyReportBulkDelete';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrderSearchSelect } from '@/components/orders/OrderSearchSelect';
import { StaffSearchSelect } from '@/components/staff/StaffSearchSelect';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { format } from 'date-fns-jalali';
import { StaffAuditTab } from '@/components/ceo/StaffAuditTab';
import { StaffSalarySettingsTab } from '@/components/ceo/StaffSalarySettingsTab';
import { ExcelImportDialog } from '@/components/ceo/ExcelImportDialog';

interface SavedReport {
  id: string;
  report_date: string;
  created_at: string;
  notes: string | null;
  orders_count: number;
  staff_count: number;
  is_archived?: boolean;
  archived_at?: string | null;
}

interface Order {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone?: string | null;
  address: string;
  subcategory_name?: string;
}

interface StaffMember {
  user_id: string;
  full_name: string;
  phone_number: string;
}

interface OrderReportRow {
  id?: string;
  order_id: string;
  activity_description: string;
  service_details: string;
  team_name: string;
  notes: string;
  row_color: string;
}

interface StaffReportRow {
  id?: string;
  staff_user_id: string | null; // This stores the staff code for UI display
  real_user_id?: string | null; // This stores the actual UUID for wallet sync
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

const ROW_COLORS = [
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

// Extract staff code from name - support both 4-digit codes and 11-digit phone numbers
const extractStaffCode = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  // Try 11-digit phone number first (e.g., 09388231167)
  const phoneMatch = value.match(/09\d{9}/);
  if (phoneMatch) return phoneMatch[0];
  // Fallback to 4-digit code
  const codeMatch = value.match(/\b\d{4}\b/);
  return codeMatch?.[0] ?? '';
};

// DB constraint expects: 'حاضر' | 'غایب'
const toDbWorkStatus = (value: unknown): 'حاضر' | 'غایب' => {
  return value === 'کارکرده' || value === 'حاضر' ? 'حاضر' : 'غایب';
};

// UI expects: 'کارکرده' | 'غایب'
const fromDbWorkStatus = (value: unknown): 'کارکرده' | 'غایب' => {
  return value === 'حاضر' ? 'کارکرده' : 'غایب';
};
export default function DailyReportModule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [orderReports, setOrderReports] = useState<OrderReportRow[]>([]);
  const [staffReports, setStaffReports] = useState<StaffReportRow[]>([]);
  const [existingReportId, setExistingReportId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('dailyReportActiveTab') || 'new-report';
  });

  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [archivedReports, setArchivedReports] = useState<SavedReport[]>([]);
  const [loadingSavedReports, setLoadingSavedReports] = useState(false);
  const [loadingArchivedReports, setLoadingArchivedReports] = useState(false);
  const [singleDeleteDialogOpen, setSingleDeleteDialogOpen] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<SavedReport | null>(null);
  const [singleDeleting, setSingleDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [reportToArchive, setReportToArchive] = useState<SavedReport | null>(null);
  const [unarchiving, setUnarchiving] = useState(false);

  // Bulk delete hook
  const {
    selectedReportIds,
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    deleting,
    toggleReportSelection,
    toggleSelectAll,
    clearSelection,
    handleBulkDelete
  } = useDailyReportBulkDelete(() => {
    // Remove deleted reports from state
    setSavedReports(prev => prev.filter(r => !selectedReportIds.has(r.id)));
  });

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('dailyReportActiveTab', activeTab);
  }, [activeTab]);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    fetchOrders();
    fetchStaffMembers();
  }, []);

  useEffect(() => {
    if (activeTab === 'saved-reports') {
      fetchSavedReports();
    } else if (activeTab === 'archived-reports') {
      fetchArchivedReports();
    }
  }, [activeTab, user]);

  useEffect(() => {
    // وقتی کاربر هنوز لود نشده باشد، fetchExistingReport اجرا نمی‌شود
    // و بعد از login نیز دوباره اجرا نمی‌شد؛ بنابراین user را هم در dependency می‌آوریم.
    if (user && reportDate) {
      isInitialLoadRef.current = true;
      fetchExistingReport();
    }
  }, [reportDate, user]);

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!user || loading) return;

    // Check if there's any meaningful data to save
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

    // صندوق همیشه وجود دارد - فقط بررسی می‌کنیم که آیا داده‌ای قابل ذخیره هست
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
      const dateStr = reportDate.toISOString().split('T')[0];

      let reportId = existingReportId;

      if (!reportId) {
        // Create new report
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

      // Delete existing order reports and insert new ones
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

      // Delete existing staff reports and insert new ones
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
              // Use real_user_id if available, otherwise check if staff_user_id is UUID
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

      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('idle');
    }
  }, [user, loading, reportDate, existingReportId, orderReports, staffReports]);

  // Auto-save with debounce when data changes
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save (debounce 2 seconds)
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 2000);

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

  const fetchSavedReports = async () => {
    if (!user) return;

    try {
      setLoadingSavedReports(true);

      const isManager = await isManagerUser(user.id);

      // Managers: see all reports. Staff: see only reports that include them.
      // Only show non-archived reports
      let reportsQuery = supabase
        .from('daily_reports')
        .select('id, report_date, created_at, notes, is_archived')
        .or('is_archived.is.null,is_archived.eq.false')
        .order('report_date', { ascending: false });

      if (!isManager) {
        const { data: myStaffRows, error: staffRowsError } = await supabase
          .from('daily_report_staff')
          .select('daily_report_id')
          .eq('staff_user_id', user.id);

        if (staffRowsError) throw staffRowsError;

        const reportIds = Array.from(new Set((myStaffRows || []).map((r: any) => r.daily_report_id).filter(Boolean)));
        if (reportIds.length === 0) {
          setSavedReports([]);
          return;
        }

        reportsQuery = reportsQuery.in('id', reportIds);
      }

      const { data: reports, error: reportsError } = await reportsQuery;
      if (reportsError) throw reportsError;

      if (reports && reports.length > 0) {
        const reportsWithCounts = await Promise.all(
          reports.map(async (report) => {
            const [ordersCount, staffCount] = await Promise.all([
              supabase
                .from('daily_report_orders')
                .select('id', { count: 'exact', head: true })
                .eq('daily_report_id', report.id),
              supabase
                .from('daily_report_staff')
                .select('id', { count: 'exact', head: true })
                .eq('daily_report_id', report.id),
            ]);

            return {
              id: report.id,
              report_date: report.report_date,
              created_at: report.created_at,
              notes: report.notes,
              orders_count: ordersCount.count || 0,
              staff_count: staffCount.count || 0,
              is_archived: (report as any).is_archived || false,
            };
          })
        );

        setSavedReports(reportsWithCounts);
      } else {
        setSavedReports([]);
      }
    } catch (error) {
      console.error('Error fetching saved reports:', error);
      toast.error('خطا در دریافت گزارشات ذخیره شده');
    } finally {
      setLoadingSavedReports(false);
    }
  };

  const fetchArchivedReports = async () => {
    if (!user) return;

    try {
      setLoadingArchivedReports(true);

      const isManager = await isManagerUser(user.id);

      // Only show archived reports
      let reportsQuery = supabase
        .from('daily_reports')
        .select('id, report_date, created_at, notes, is_archived, archived_at')
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (!isManager) {
        const { data: myStaffRows, error: staffRowsError } = await supabase
          .from('daily_report_staff')
          .select('daily_report_id')
          .eq('staff_user_id', user.id);

        if (staffRowsError) throw staffRowsError;

        const reportIds = Array.from(new Set((myStaffRows || []).map((r: any) => r.daily_report_id).filter(Boolean)));
        if (reportIds.length === 0) {
          setArchivedReports([]);
          return;
        }

        reportsQuery = reportsQuery.in('id', reportIds);
      }

      const { data: reports, error: reportsError } = await reportsQuery;
      if (reportsError) throw reportsError;

      if (reports && reports.length > 0) {
        const reportsWithCounts = await Promise.all(
          reports.map(async (report) => {
            const [ordersCount, staffCount] = await Promise.all([
              supabase
                .from('daily_report_orders')
                .select('id', { count: 'exact', head: true })
                .eq('daily_report_id', report.id),
              supabase
                .from('daily_report_staff')
                .select('id', { count: 'exact', head: true })
                .eq('daily_report_id', report.id),
            ]);

            return {
              id: report.id,
              report_date: report.report_date,
              created_at: report.created_at,
              notes: report.notes,
              orders_count: ordersCount.count || 0,
              staff_count: staffCount.count || 0,
              is_archived: true,
              archived_at: (report as any).archived_at,
            };
          })
        );

        setArchivedReports(reportsWithCounts);
      } else {
        setArchivedReports([]);
      }
    } catch (error) {
      console.error('Error fetching archived reports:', error);
      toast.error('خطا در دریافت گزارشات بایگانی شده');
    } finally {
      setLoadingArchivedReports(false);
    }
  };

  const archiveReport = async (report: SavedReport) => {
    if (!user) return;

    try {
      setArchiving(true);

      const { error } = await supabase.rpc('archive_daily_report', { p_report_id: report.id });
      if (error) throw error;

      toast.success('گزارش با موفقیت بایگانی شد');
      setSavedReports((prev) => prev.filter((r) => r.id !== report.id));
      setArchiveDialogOpen(false);
      setReportToArchive(null);
      
      // Refresh archived reports if that tab is active
      if (activeTab === 'archived-reports') {
        fetchArchivedReports();
      }
    } catch (error) {
      console.error('Error archiving report:', error);
      toast.error('خطا در بایگانی گزارش');
    } finally {
      setArchiving(false);
    }
  };

  const unarchiveReport = async (report: SavedReport) => {
    if (!user) return;

    try {
      setUnarchiving(true);

      const { error } = await supabase.rpc('unarchive_daily_report', { p_report_id: report.id });
      if (error) throw error;

      toast.success('گزارش از بایگانی خارج شد');
      setArchivedReports((prev) => prev.filter((r) => r.id !== report.id));
      
      // Refresh saved reports
      fetchSavedReports();
    } catch (error) {
      console.error('Error unarchiving report:', error);
      toast.error('خطا در خارج کردن گزارش از بایگانی');
    } finally {
      setUnarchiving(false);
    }
  };

  const openArchiveDialog = (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    setReportToArchive(report);
    setArchiveDialogOpen(true);
  };

  const viewSavedReport = (reportDate: string) => {
    setReportDate(new Date(reportDate));
    setActiveTab('new-report');
  };

  const getDeleteErrorText = (err: unknown) => {
    const message = (err as any)?.message ? String((err as any).message) : '';

    if (
      message.toLowerCase().includes('row-level security') ||
      message.toLowerCase().includes('permission denied')
    ) {
      return 'شما دسترسی حذف این گزارش را ندارید';
    }

    if (message.toLowerCase().includes('foreign key')) {
      return 'به دلیل وجود اطلاعات مرتبط، حذف گزارش انجام نشد';
    }

    return 'خطا در حذف گزارش';
  };

  const requestDeleteSavedReport = (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    setSingleDeleteTarget(report);
    setSingleDeleteDialogOpen(true);
  };

  const confirmDeleteSavedReport = async () => {
    if (!singleDeleteTarget) return;

    const reportId = singleDeleteTarget.id;

    try {
      setSingleDeleting(true);

      const { error: ordersError } = await supabase
        .from('daily_report_orders')
        .delete()
        .eq('daily_report_id', reportId);
      if (ordersError) throw ordersError;

      const { error: staffError } = await supabase
        .from('daily_report_staff')
        .delete()
        .eq('daily_report_id', reportId);
      if (staffError) throw staffError;

      const { error: reportError } = await supabase
        .from('daily_reports')
        .delete()
        .eq('id', reportId);
      if (reportError) throw reportError;

      toast.success('گزارش با موفقیت حذف شد');
      setSavedReports((prev) => prev.filter((r) => r.id !== reportId));
      if (selectedReportIds.has(reportId)) {
        toggleReportSelection(reportId);
      }

      setSingleDeleteDialogOpen(false);
      setSingleDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error(getDeleteErrorText(error));
    } finally {
      setSingleDeleting(false);
    }
  };

  const fetchOrders = async () => {
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
          subcategories!projects_v3_subcategory_id_fkey(name)
        `)
        .in('status', ['pending_execution', 'in_progress', 'scheduled', 'approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders((data || []).map((o: any) => ({
        id: o.id,
        code: o.code,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        address: o.address,
        subcategory_name: o.subcategories?.name
      })));
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      // Fetch staff from user_roles who have executive roles
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
  };

  const fetchExistingReport = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const dateStr = reportDate.toISOString().split('T')[0];

      const isManager = await isManagerUser(user.id);

      let reportIdToLoad: string | null = null;

      // Managers: prefer their own report for that date, otherwise take latest.
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
        // Staff: load the report of that date which contains a row for them.
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

        const normalizedStaff: StaffReportRow[] = (staffData || []).map((s: any) => {
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

        const hasCashBox = normalizedStaff.some((s) => s.is_cash_box);
        if (!hasCashBox) {
          normalizedStaff.unshift({
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
        }

        const hasAnyNonCashRow = normalizedStaff.some((s) => !s.is_cash_box);
        if (!hasAnyNonCashRow) {
          normalizedStaff.push({
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
        }

        setStaffReports(normalizedStaff);
      } else {
        setExistingReportId(null);
        setOrderReports([
          {
            order_id: '',
            activity_description: '',
            service_details: '',
            team_name: '',
            notes: '',
            row_color: ROW_COLORS[0].value,
          },
        ]);
        setStaffReports([
          {
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
          },
          {
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
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const addOrderRow = () => {
    setOrderReports([...orderReports, {
      order_id: '',
      activity_description: '',
      service_details: '',
      team_name: '',
      notes: '',
      row_color: ROW_COLORS[orderReports.length % ROW_COLORS.length].value
    }]);
  };

  const removeOrderRow = (index: number) => {
    setOrderReports(orderReports.filter((_, i) => i !== index));
  };

  const updateOrderRow = (index: number, field: keyof OrderReportRow, value: string) => {
    setOrderReports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // اگر آخرین ردیف ویرایش شد و مقداری وارد شد، یک ردیف جدید اضافه کن
      const isLastRow = index === prev.length - 1;
      const hasContent = value && value.trim().length > 0;
      if (isLastRow && hasContent) {
        updated.push({
          order_id: '',
          activity_description: '',
          service_details: '',
          team_name: '',
          notes: '',
          row_color: ROW_COLORS[updated.length % ROW_COLORS.length].value
        });
      }

      return updated;
    });
  };

  const addStaffRow = () => {
    setStaffReports([...staffReports, {
      staff_user_id: null,
      staff_name: '',
      work_status: 'غایب',
      overtime_hours: 0,
      amount_received: 0,
      receiving_notes: '',
      amount_spent: 0,
      spending_notes: '',
      notes: '',
      is_cash_box: false
    }]);
  };

  const removeStaffRow = (index: number) => {
    if (staffReports[index].is_cash_box) {
      toast.error('ردیف صندوق قابل حذف نیست');
      return;
    }
    setStaffReports(staffReports.filter((_, i) => i !== index));
  };

  const updateStaffRow = (index: number, field: keyof StaffReportRow, value: any) => {
    setStaffReports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If selecting a staff member (from DB-based picker), update the name too
      if (field === 'staff_user_id' && value) {
        const staff = staffMembers.find((s) => s.user_id === value);
        if (staff) {
          updated[index].staff_name = staff.full_name;
        }
      }

      // آخرین ردیف غیر صندوق را پیدا کن
      const nonCashBoxRows = updated.filter((r) => !r.is_cash_box);
      const lastNonCashBoxIndex = updated.findIndex(
        (r, i) => !r.is_cash_box && i === updated.lastIndexOf(nonCashBoxRows[nonCashBoxRows.length - 1])
      );

      // اگر آخرین ردیف غیر صندوق ویرایش شد و مقداری وارد شد، یک ردیف جدید اضافه کن
      const isLastNonCashBoxRow = index === lastNonCashBoxIndex;
      const hasContent =
        (typeof value === 'string' && value.trim().length > 0) ||
        (typeof value === 'number' && value > 0);

      if (isLastNonCashBoxRow && hasContent && !updated[index].is_cash_box) {
        updated.push({
          staff_user_id: null,
          staff_name: '',
          work_status: 'غایب',
          overtime_hours: 0,
          amount_received: 0,
          receiving_notes: '',
          amount_spent: 0,
          spending_notes: '',
          notes: '',
          is_cash_box: false
        });
      }

      return updated;
    });
  };

  const calculateTotals = () => {
    const presentCount = staffReports.filter(s => s.work_status === 'کارکرده' && !s.is_cash_box).length;
    const totalOvertime = staffReports.reduce((sum, s) => sum + (s.overtime_hours || 0), 0);
    
    // صندوق: مبلغ خرج کرده = پرداخت به نیروها
    const cashBoxSpent = staffReports
      .filter(s => s.is_cash_box)
      .reduce((sum, s) => sum + (s.amount_spent || 0), 0);
    
    // نیروها: مبلغ دریافتی از صندوق
    const staffReceived = staffReports
      .filter(s => !s.is_cash_box)
      .reduce((sum, s) => sum + (s.amount_received || 0), 0);
    
    // کل دریافتی و خرج کرده برای نمایش
    const totalReceived = staffReports.reduce((sum, s) => sum + (s.amount_received || 0), 0);
    const totalSpent = staffReports.reduce((sum, s) => sum + (s.amount_spent || 0), 0);
    
    return { presentCount, totalOvertime, totalReceived, totalSpent, cashBoxSpent, staffReceived };
  };

  const saveReport = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const dateStr = reportDate.toISOString().split('T')[0];

      let reportId = existingReportId;

      if (!reportId) {
        // Create new report
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

      // Delete existing order reports and insert new ones
      const { error: deleteOrderError } = await supabase
        .from('daily_report_orders')
        .delete()
        .eq('daily_report_id', reportId);

      if (deleteOrderError) {
        console.error('Error deleting order reports:', deleteOrderError);
        throw deleteOrderError;
      }

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

        if (orderError) {
          console.error('Error inserting order reports:', orderError);
          throw orderError;
        }
      }

      // Delete existing staff reports and insert new ones
      const { error: deleteStaffError } = await supabase
        .from('daily_report_staff')
        .delete()
        .eq('daily_report_id', reportId);

      if (deleteStaffError) {
        console.error('Error deleting staff reports:', deleteStaffError);
        throw deleteStaffError;
      }

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
          // Use real_user_id if available, otherwise check if staff_user_id is UUID
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

        if (staffError) {
          console.error('Error inserting staff reports:', staffError);
          throw staffError;
        }
      }

      toast.success('گزارش با موفقیت ذخیره شد');
    } catch (error: any) {
      console.error('Error saving report:', error);
      const errorMessage = error?.message || error?.details || 'خطای نامشخص';
      toast.error(`خطا در ذخیره گزارش: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle import from Excel
  const handleExcelImport = async (reports: any[]) => {
    if (!user || reports.length === 0) return;

    try {
      setLoading(true);
      let importedCount = 0;

      for (const report of reports) {
        if (!report.date) continue;

        // Convert date to ISO format
        const dateStr = report.date;

        // Check if report exists for this date
        const { data: existingReport } = await supabase
          .from('daily_reports')
          .select('id')
          .eq('report_date', dateStr)
          .eq('created_by', user.id)
          .maybeSingle();

        let reportId = existingReport?.id;

        if (!reportId) {
          // Create new report
          const { data: newReport, error: createError } = await supabase
            .from('daily_reports')
            .insert({
              report_date: dateStr,
              created_by: user.id
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating report for', dateStr, ':', createError);
            continue;
          }
          reportId = newReport.id;
        }

        // Insert staff reports
        if (report.staffReports && report.staffReports.length > 0) {
          // Delete existing staff reports for this date
          await supabase
            .from('daily_report_staff')
            .delete()
            .eq('daily_report_id', reportId);

          // Match staff names from Excel to known staff members
          const staffToInsert = report.staffReports.map((s: any) => {
            const extractedName = (s.staffName || '').trim();
            
            // Try to find matching staff member by name or code
            let matchedStaff: StaffMember | undefined;
            
            if (extractedName) {
              // First try exact match
              matchedStaff = staffMembers.find(
                (m) => m.full_name.toLowerCase() === extractedName.toLowerCase()
              );
              
              // If no exact match, try partial match (name contains extracted name or vice versa)
              if (!matchedStaff) {
                matchedStaff = staffMembers.find(
                  (m) => 
                    m.full_name.toLowerCase().includes(extractedName.toLowerCase()) ||
                    extractedName.toLowerCase().includes(m.full_name.toLowerCase())
                );
              }
              
              // Try matching by code in name (e.g., "0106" or "علی 0106")
              if (!matchedStaff) {
                const codeMatch = extractedName.match(/\b(\d{3,6})\b/);
                if (codeMatch) {
                  const code = codeMatch[1];
                  matchedStaff = staffMembers.find(
                    (m) => m.full_name.includes(code) || m.phone_number?.endsWith(code)
                  );
                }
              }
              
              // Log matching result for debugging
              if (matchedStaff) {
                console.log(`[ExcelImport] Matched "${extractedName}" → "${matchedStaff.full_name}" (${matchedStaff.user_id})`);
              } else {
                console.log(`[ExcelImport] No match found for "${extractedName}"`);
              }
            }
            
            return {
              daily_report_id: reportId,
              staff_user_id: matchedStaff?.user_id || null,
              staff_name: matchedStaff?.full_name || extractedName,
              work_status: s.workStatus === 'حاضر' ? 'حاضر' : 'غایب',
              overtime_hours: s.overtimeHours || 0,
              amount_received: s.amountReceived || 0,
              receiving_notes: s.receivingNotes || '',
              amount_spent: s.amountSpent || 0,
              spending_notes: s.spendingNotes || '',
              notes: s.notes || '',
              is_cash_box: s.isCashBox || false
            };
          });

          const { error: staffError } = await supabase
            .from('daily_report_staff')
            .insert(staffToInsert);

          if (staffError) {
            console.error('Error inserting staff for', dateStr, ':', staffError);
          }
        }

        importedCount++;
      }

      toast.success(`${importedCount} گزارش با موفقیت وارد شد`);
      
      // Refresh saved reports list
      fetchSavedReports();
      
      // Switch to saved reports tab
      setActiveTab('saved-reports');

    } catch (error) {
      console.error('Error importing Excel reports:', error);
      toast.error('خطا در ذخیره گزارشات');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  // تراز مالی: کل مبلغ دریافتی باید برابر کل مبلغ خرج کرده باشد
  const balance = totals.totalReceived - totals.totalSpent;
  const balanceState: 'balanced' | 'deficit' | 'surplus' = balance === 0 ? 'balanced' : balance < 0 ? 'deficit' : 'surplus';

  const getRowColorClass = (color: string) => {
    return ROW_COLORS.find(c => c.value === color)?.class || 'bg-background';
  };

  const formatPersianDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE d MMMM yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">گزارش روزانه شرکت اهرم</h1>
              <p className="text-sm text-muted-foreground">ثبت گزارش فعالیت‌های روزانه</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Excel Import Button */}
            <ExcelImportDialog
              onImportComplete={handleExcelImport}
              knownStaffMembers={staffMembers}
            />
            {/* Auto-save status indicator */}
            {autoSaveStatus !== 'idle' && (
              <div className="flex items-center gap-2 text-sm">
                {autoSaveStatus === 'saving' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                    <span className="text-muted-foreground">در حال ذخیره...</span>
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">ذخیره شد</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="new-report" className="gap-2">
              <FileText className="h-4 w-4" />
              ثبت گزارش
            </TabsTrigger>
            <TabsTrigger value="saved-reports" className="gap-2">
              <History className="h-4 w-4" />
              گزارشات ذخیره شده
            </TabsTrigger>
            <TabsTrigger value="archived-reports" className="gap-2">
              <Archive className="h-4 w-4" />
              بایگانی
            </TabsTrigger>
            <TabsTrigger value="staff-audit" className="gap-2">
              <Calculator className="h-4 w-4" />
              حسابرسی نیروها
            </TabsTrigger>
            <TabsTrigger value="salary-settings" className="gap-2">
              <Settings className="h-4 w-4" />
              تنظیمات حقوق
            </TabsTrigger>
          </TabsList>

          {/* New Report Tab */}
          <TabsContent value="new-report" className="space-y-6 mt-6">
            {/* Date Picker */}
            <div className="flex items-center gap-3 justify-end">
              <Label className="text-sm font-medium">تاریخ گزارش:</Label>
              <PersianDatePicker
                value={reportDate.toISOString()}
                onChange={(date) => date && setReportDate(new Date(date))}
                timeMode="none"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : (
              <>
                {/* Order Reports Table */}
                <Card className="border-2 border-blue-500/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <CardTitle className="text-lg">گزارش سفارشات مشتری</CardTitle>
                      </div>
                      <Button size="sm" onClick={addOrderRow} className="gap-2">
                        <Plus className="h-4 w-4" />
                        افزودن ردیف
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="table-auto border-collapse border border-blue-300">
                        <TableHeader>
                          <TableRow className="bg-blue-100 dark:bg-blue-900/30">
                            <TableHead className="w-[50px] border border-blue-300"></TableHead>
                            <TableHead className="whitespace-nowrap px-2 border border-blue-300">رنگ</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">توضیحات</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">اکیپ</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">تعداد، ابعاد و متراژ خدمات</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">شرح فعالیت امروز</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">سفارش مشتری را انتخاب کنید</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderReports.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground border border-blue-200">
                                هنوز سفارشی اضافه نشده است
                              </TableCell>
                            </TableRow>
                          ) : (
                            orderReports.map((row, index) => (
                              <TableRow key={index} className={`${getRowColorClass(row.row_color)} even:opacity-90`}>
                                <TableCell className="border border-blue-200">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeOrderRow(index)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <div className={`w-6 h-6 rounded ${getRowColorClass(row.row_color)}`}></div>
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <AutoResizeTextarea
                                    value={row.notes}
                                    onChange={(e) => updateOrderRow(index, 'notes', e.target.value)}
                                    className="min-h-[40px] bg-white/50"
                                    placeholder="توضیحات..."
                                  />
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <Input
                                    value={row.team_name}
                                    onChange={(e) => updateOrderRow(index, 'team_name', e.target.value)}
                                    className="bg-white/50"
                                    placeholder="نام اکیپ"
                                  />
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <AutoResizeTextarea
                                    value={row.service_details}
                                    onChange={(e) => updateOrderRow(index, 'service_details', e.target.value)}
                                    className="min-h-[40px] bg-white/50"
                                    placeholder="جزئیات خدمات..."
                                  />
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <AutoResizeTextarea
                                    value={row.activity_description}
                                    onChange={(e) => updateOrderRow(index, 'activity_description', e.target.value)}
                                    className="min-h-[40px] bg-white/50"
                                    placeholder="شرح فعالیت..."
                                  />
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <div className="flex items-center gap-2">
                                    <OrderSearchSelect
                                      orders={orders}
                                      value={row.order_id}
                                      onValueChange={(value) => updateOrderRow(index, 'order_id', value)}
                                      placeholder="انتخاب سفارش"
                                    />
                                    {row.order_id && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => window.open(`/orders/${row.order_id}`, '_blank')}
                                        title="مشاهده جزئیات سفارش"
                                        className="shrink-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Staff Reports Table */}
                <Card className="border-2 border-amber-500/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <User className="h-5 w-5 text-amber-600" />
                        </div>
                        <CardTitle className="text-lg">گزارش نیروها</CardTitle>
                      </div>
                      <Button size="sm" onClick={addStaffRow} className="gap-2">
                        <Plus className="h-4 w-4" />
                        افزودن نیرو
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-visible">
                      <Table className="table-auto border-collapse border border-amber-300">
                        <TableHeader>
                          <TableRow className="bg-amber-100 dark:bg-amber-900/30">
                            <TableHead className="w-[50px] border border-amber-300"></TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات مبلغ خرج کرد</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">مبلغ خرج کرده شده در کار</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات دریافتی</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">مبلغ دریافتی</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">اضافه کاری</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">کارکرد</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">نیروها</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffReports.map((row, index) => (
                            <TableRow 
                              key={index} 
                              className={row.is_cash_box ? 'bg-amber-50 dark:bg-amber-900/20' : 'even:bg-amber-50/50'}
                            >
                              <TableCell className="border border-amber-200">
                                {!row.is_cash_box && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeStaffRow(index)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <AutoResizeTextarea
                                  value={row.notes}
                                  onChange={(e) => updateStaffRow(index, 'notes', e.target.value)}
                                  placeholder="توضیحات..."
                                  className="min-w-[100px] min-h-[36px]"
                                />
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <AutoResizeTextarea
                                  value={row.spending_notes}
                                  onChange={(e) => updateStaffRow(index, 'spending_notes', e.target.value)}
                                  placeholder="توضیحات..."
                                  className="min-w-[100px] min-h-[36px]"
                                />
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <div className="relative">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.amount_spent === 0 ? '' : row.amount_spent.toLocaleString('en-US')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
                                      updateStaffRow(index, 'amount_spent', parseInt(val) || 0);
                                    }}
                                    className="min-w-[120px] pl-12 text-left"
                                    dir="ltr"
                                    placeholder="0"
                                  />
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">تومان</span>
                                </div>
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <AutoResizeTextarea
                                  value={row.receiving_notes}
                                  onChange={(e) => updateStaffRow(index, 'receiving_notes', e.target.value)}
                                  placeholder="توضیحات..."
                                  className="min-w-[100px] min-h-[36px]"
                                />
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <div className="relative">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.amount_received === 0 ? '' : row.amount_received.toLocaleString('en-US')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
                                      updateStaffRow(index, 'amount_received', parseInt(val) || 0);
                                    }}
                                    className="min-w-[120px] pl-12 text-left"
                                    dir="ltr"
                                    placeholder="0"
                                  />
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">تومان</span>
                                </div>
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                {row.is_cash_box ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <div className="relative">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.overtime_hours === 0 ? '' : row.overtime_hours.toString()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/^0+(?=\d)/, '');
                                        updateStaffRow(index, 'overtime_hours', parseFloat(val) || 0);
                                      }}
                                      className="min-w-[80px] pl-10 text-left"
                                      dir="ltr"
                                      placeholder="0"
                                    />
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ساعت</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                {row.is_cash_box ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <Select
                                    value={row.work_status}
                                    onValueChange={(value: 'کارکرده' | 'غایب') => updateStaffRow(index, 'work_status', value)}
                                  >
                                    <SelectTrigger className="min-w-[90px] w-auto">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background">
                                      <SelectItem value="کارکرده">کارکرده</SelectItem>
                                      <SelectItem value="غایب">غایب</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                {row.is_cash_box ? (
                                  <div className="font-semibold text-amber-700">{row.staff_name}</div>
                                ) : (
                                  <StaffSearchSelect
                                    value={row.staff_user_id || ''}
                                    onValueChange={(code, name, userId) => {
                                      // Update all fields at once to avoid multiple renders
                                      setStaffReports((prev) => {
                                        const updated = [...prev];
                                        updated[index] = {
                                          ...updated[index],
                                          staff_user_id: code,
                                          staff_name: code && name ? `${code} - ${name}` : '',
                                          real_user_id: userId || null
                                        };
                                        
                                        // Add new row if this is the last non-cash-box row
                                        const nonCashBoxRows = updated.filter((r) => !r.is_cash_box);
                                        const lastNonCashBoxIndex = updated.findIndex(
                                          (r, i) => !r.is_cash_box && i === updated.lastIndexOf(nonCashBoxRows[nonCashBoxRows.length - 1])
                                        );
                                        
                                        if (index === lastNonCashBoxIndex && code) {
                                          updated.push({
                                            staff_user_id: null,
                                            staff_name: '',
                                            work_status: 'غایب',
                                            overtime_hours: 0,
                                            amount_received: 0,
                                            receiving_notes: '',
                                            amount_spent: 0,
                                            spending_notes: '',
                                            notes: '',
                                            is_cash_box: false
                                          });
                                        }
                                        
                                        return updated;
                                      });
                                    }}
                                    placeholder="انتخاب نیرو"
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}

                          {/* Summary Row */}
                          <TableRow className="bg-amber-200 dark:bg-amber-800/40 font-bold">
                            <TableCell className="border border-amber-300"></TableCell>
                            <TableCell className="border border-amber-300" colSpan={2}></TableCell>
                            <TableCell className="border border-amber-300">{totals.totalSpent.toLocaleString('fa-IR')} تومان</TableCell>
                            <TableCell className="border border-amber-300"></TableCell>
                            <TableCell className="border border-amber-300">{totals.totalReceived.toLocaleString('fa-IR')} تومان</TableCell>
                            <TableCell className="border border-amber-300">{totals.totalOvertime} ساعت</TableCell>
                            <TableCell className="border border-amber-300">{totals.presentCount} نیرو</TableCell>
                            <TableCell className="border border-amber-300 text-right">جمع:</TableCell>
                          </TableRow>

                          {/* Balance Row */}
                          <TableRow
                            className={
                              balanceState === 'balanced'
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : balanceState === 'deficit'
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : 'bg-amber-100 dark:bg-amber-900/30'
                            }
                          >
                            <TableCell colSpan={9} className="text-center">
                              <Badge
                                variant={balanceState === 'balanced' ? 'default' : balanceState === 'deficit' ? 'destructive' : 'secondary'}
                                className="text-base px-4 py-2"
                              >
                                {balanceState === 'balanced' ? 'تراز مالی صحیح است' : balanceState === 'deficit' ? 'کسری مالی' : 'مازاد مالی'}
                                {balanceState !== 'balanced' && ` (${Math.abs(balance).toLocaleString('fa-IR')} تومان)`}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-center">
                  <Button 
                    onClick={saveReport} 
                    disabled={saving}
                    size="lg"
                    className="gap-2 min-w-[200px]"
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    ذخیره گزارش
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Saved Reports Tab */}
          <TabsContent value="saved-reports" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <History className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">گزارشات ذخیره شده</CardTitle>
                  </div>
                  {savedReports.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSelectAll(savedReports.map(r => r.id))}
                        className="gap-2"
                      >
                        {selectedReportIds.size === savedReports.length ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        {selectedReportIds.size === savedReports.length ? 'لغو انتخاب' : 'انتخاب همه'}
                      </Button>
                      {selectedReportIds.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setBulkDeleteDialogOpen(true)}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          حذف {selectedReportIds.size} گزارش
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingSavedReports ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  </div>
                ) : savedReports.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>هنوز گزارشی ذخیره نشده است</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedReports.map((report) => (
                      <Card 
                        key={report.id} 
                        className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                          selectedReportIds.has(report.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={selectedReportIds.has(report.id)}
                              onCheckedChange={() => toggleReportSelection(report.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-2"
                            />
                            <div 
                              className="flex items-center gap-4 flex-1"
                              onClick={() => viewSavedReport(report.report_date)}
                            >
                              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                                <Calendar className="h-5 w-5 text-amber-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{formatPersianDate(report.report_date)}</h3>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Package className="h-4 w-4" />
                                    {report.orders_count} سفارش
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    {report.staff_count} نیرو
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => viewSavedReport(report.report_date)}
                            >
                              <Eye className="h-4 w-4" />
                              مشاهده
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                              onClick={(e) => openArchiveDialog(report, e)}
                              disabled={archiving}
                            >
                              <Archive className="h-4 w-4" />
                              بایگانی
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => requestDeleteSavedReport(report, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                              حذف
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bulk Delete Confirmation Dialog */}
            <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-right">تایید حذف گروهی</AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    آیا از حذف {selectedReportIds.size} گزارش انتخاب شده اطمینان دارید؟
                    <br />
                    این عمل قابل بازگشت نیست.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 ml-2" />
                    )}
                    حذف {selectedReportIds.size} گزارش
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Single Delete Confirmation Dialog */}
            <AlertDialog open={singleDeleteDialogOpen} onOpenChange={setSingleDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-right">تایید حذف گزارش</AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    آیا از حذف این گزارش اطمینان دارید؟
                    {singleDeleteTarget ? (
                      <>
                        <br />
                        <span className="font-medium">{formatPersianDate(singleDeleteTarget.report_date)}</span>
                      </>
                    ) : null}
                    <br />
                    این عمل قابل بازگشت نیست.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel
                    onClick={() => {
                      setSingleDeleteTarget(null);
                      setSingleDeleteDialogOpen(false);
                    }}
                    disabled={singleDeleting}
                  >
                    انصراف
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmDeleteSavedReport}
                    disabled={singleDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {singleDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 ml-2" />
                    )}
                    حذف گزارش
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          {/* Archive Confirmation Dialog */}
          <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-right">تایید بایگانی گزارش</AlertDialogTitle>
                <AlertDialogDescription className="text-right">
                  آیا از بایگانی این گزارش اطمینان دارید؟
                  {reportToArchive ? (
                    <>
                      <br />
                      <span className="font-medium">{formatPersianDate(reportToArchive.report_date)}</span>
                    </>
                  ) : null}
                  <br />
                  <span className="text-amber-600">با بایگانی گزارش، تأثیرات مالی آن در حسابرسی نیروها حذف خواهد شد.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel
                  onClick={() => {
                    setReportToArchive(null);
                    setArchiveDialogOpen(false);
                  }}
                  disabled={archiving}
                >
                  انصراف
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => reportToArchive && archiveReport(reportToArchive)}
                  disabled={archiving}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  {archiving ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Archive className="h-4 w-4 ml-2" />
                  )}
                  بایگانی گزارش
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Archived Reports Tab */}
          <TabsContent value="archived-reports" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Archive className="h-5 w-5 text-amber-600" />
                  </div>
                  <CardTitle className="text-lg">گزارشات بایگانی شده</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loadingArchivedReports ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  </div>
                ) : archivedReports.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>هنوز گزارشی بایگانی نشده است</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {archivedReports.map((report) => (
                      <Card 
                        key={report.id} 
                        className="p-4 hover:bg-muted/50 transition-colors bg-amber-50/50 dark:bg-amber-900/10"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                              <Calendar className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{formatPersianDate(report.report_date)}</h3>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Package className="h-4 w-4" />
                                  {report.orders_count} سفارش
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-4 w-4" />
                                  {report.staff_count} نیرو
                                </span>
                                {report.archived_at && (
                                  <span className="text-amber-600">
                                    بایگانی شده
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => viewSavedReport(report.report_date)}
                            >
                              <Eye className="h-4 w-4" />
                              مشاهده
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-100"
                              onClick={() => unarchiveReport(report)}
                              disabled={unarchiving}
                            >
                              {unarchiving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArchiveRestore className="h-4 w-4" />
                              )}
                              بازیابی
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Audit Tab */}
          <TabsContent value="staff-audit" className="mt-6">
            <StaffAuditTab />
          </TabsContent>

          {/* Salary Settings Tab */}
          <TabsContent value="salary-settings" className="mt-6">
            <StaffSalarySettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
