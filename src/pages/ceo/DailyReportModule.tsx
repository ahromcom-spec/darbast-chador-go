import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Trash2, Save, Loader2, User, Package, History, FileText, Eye, Check, ExternalLink, Calculator, Settings, CheckSquare, Square, Archive, ArchiveRestore, Upload, Image as ImageIcon, Film, X, Play, Building, MapPin, Hash, CreditCard } from 'lucide-react';
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
import { WorkStatusSelect } from '@/components/daily-report/WorkStatusSelect';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { format } from 'date-fns-jalali';
import { StaffAuditTab } from '@/components/ceo/StaffAuditTab';
import { StaffSalarySettingsTab } from '@/components/ceo/StaffSalarySettingsTab';
import { ExcelImportDialog } from '@/components/ceo/ExcelImportDialog';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { MediaGallery, MediaItem } from '@/components/media/MediaGallery';
import StaticLocationMap from '@/components/locations/StaticLocationMap';
import { parseOrderNotes } from '@/components/orders/OrderDetailsView';

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
  activity_description?: string;
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
  bank_card_id?: string | null;
  notes: string;
  is_cash_box: boolean;
  is_company_expense?: boolean;
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

// محافظت در برابر داده‌های قدیمی/ناپاک (مثلاً مقدار "" یا "true" در local state)
// که باعث خطای Postgres مثل: invalid input syntax for type boolean: "" می‌شود.
const toDbBoolean = (value: unknown): boolean => {
  return value === true || value === 'true' || value === 1 || value === '1';
};

// تبدیل تاریخ به فرمت YYYY-MM-DD با استفاده از تاریخ محلی (نه UTC)
// این تابع مهم است چون toISOString() از UTC استفاده می‌کند و ممکن است تاریخ را اشتباه نشان دهد
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// همگام‌سازی موجودی کارت‌ها به‌صورت «بازتولید مطلق» (بدون Drift)
// فرمول: current_balance = initial_balance + (manual transactions net) + (sum all daily_report_staff cash-box net)
async function syncBankCardBalancesFromLedger(params: {
  reportId: string;
  reportDate: Date;
  userId: string;
  staffToSave: StaffReportRow[];
}) {
  const { reportId, reportDate, userId, staffToSave } = params;

  // فقط ردیف‌های «کارت/صندوق» روی موجودی کارت اثر دارند
  const cashBoxTotalsByCard = new Map<
    string,
    { received: number; spent: number; receiveDesc?: string; spendDesc?: string }
  >();

  for (const s of staffToSave) {
    if (!s.is_cash_box || !s.bank_card_id) continue;
    const cardId = s.bank_card_id;
    const prev = cashBoxTotalsByCard.get(cardId) ?? { received: 0, spent: 0 };
    cashBoxTotalsByCard.set(cardId, {
      received: prev.received + (Number(s.amount_received ?? 0) || 0),
      spent: prev.spent + (Number(s.amount_spent ?? 0) || 0),
      receiveDesc: prev.receiveDesc ?? (s.receiving_notes?.trim() || undefined),
      spendDesc: prev.spendDesc ?? (s.spending_notes?.trim() || undefined),
    });
  }

  const affectedBankCardIds = Array.from(cashBoxTotalsByCard.keys());
  if (affectedBankCardIds.length === 0) return;

  // Best-effort: حذف لاگ‌های قبلی همین گزارش برای جلوگیری از تکرار
  let canReplaceTxLogs = true;
  const { error: deleteTxError } = await supabase
    .from('bank_card_transactions')
    .delete()
    .eq('reference_type', 'daily_report_staff')
    .eq('reference_id', reportId);

  if (deleteTxError) {
    canReplaceTxLogs = false;
    console.warn('Could not delete previous bank card transactions for report:', deleteTxError);
  }

  const dateStr = toLocalDateString(reportDate);

  for (const cardId of affectedBankCardIds) {
    // 1) initial balance
    const { data: cardRow, error: cardError } = await supabase
      .from('bank_cards')
      .select('initial_balance')
      .eq('id', cardId)
      .single();

    if (cardError) {
      console.error('Error fetching bank card initial balance:', cardError);
      continue;
    }

    const initial = Number((cardRow as any)?.initial_balance ?? 0) || 0;

    // 2) manual transactions net (exclude daily report logs)
    const { data: manualTx, error: manualTxError } = await supabase
      .from('bank_card_transactions')
      .select('transaction_type, amount, reference_type')
      .eq('bank_card_id', cardId)
      .or('reference_type.is.null,reference_type.neq.daily_report_staff');

    if (manualTxError) {
      console.error('Error fetching manual bank card transactions:', manualTxError);
    }

    const manualNet = (manualTx || []).reduce((sum: number, t: any) => {
      const amt = Number(t.amount ?? 0) || 0;
      return sum + (t.transaction_type === 'deposit' ? amt : -amt);
    }, 0);

    // 3) daily report cash-box net (authoritative across all reports)
    const { data: drRows, error: drError } = await supabase
      .from('daily_report_staff')
      .select('amount_received, amount_spent')
      .eq('bank_card_id', cardId)
      .eq('is_cash_box', true);

    if (drError) {
      console.error('Error fetching daily report staff rows for bank card:', drError);
    }

    const dailyNet = (drRows || []).reduce((sum: number, r: any) => {
      const received = Number(r.amount_received ?? 0) || 0;
      const spent = Number(r.amount_spent ?? 0) || 0;
      return sum + received - spent;
    }, 0);

    const newBalance = initial + manualNet + dailyNet;

    // لاگ‌های تراکنش همین گزارش (تجمیعی) - اختیاری
    if (canReplaceTxLogs) {
      const t = cashBoxTotalsByCard.get(cardId);
      if (t && (t.received > 0 || t.spent > 0)) {
        const baseOther = newBalance - (t.received - t.spent);
        const txRows: any[] = [];

        if (t.received > 0) {
          txRows.push({
            bank_card_id: cardId,
            transaction_type: 'deposit',
            amount: t.received,
            balance_after: baseOther + t.received,
            description: t.receiveDesc || `واریز از گزارش روزانه ${dateStr}`,
            reference_type: 'daily_report_staff',
            reference_id: reportId,
            created_by: userId,
          });
        }

        if (t.spent > 0) {
          txRows.push({
            bank_card_id: cardId,
            transaction_type: 'withdrawal',
            amount: t.spent,
            balance_after: newBalance,
            description: t.spendDesc || `برداشت از گزارش روزانه ${dateStr}`,
            reference_type: 'daily_report_staff',
            reference_id: reportId,
            created_by: userId,
          });
        }

        if (txRows.length > 0) {
          const { error: txError } = await supabase
            .from('bank_card_transactions')
            .insert(txRows);

          if (txError) {
            console.error('Error recording bank card transactions:', txError);
          }
        }
      }
    }

    const { error: updateError } = await supabase
      .from('bank_cards')
      .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', cardId);

    if (updateError) {
      console.error('Error updating bank card balance (recalc):', updateError);
    }
  }
}

const DEFAULT_TITLE = 'گزارش روزانه شرکت اهرم';
const DEFAULT_DESCRIPTION = 'ثبت گزارش فعالیت‌های روزانه';

// کلیدهای ماژول‌های گزارش روزانه مختلف
// هر ماژول کپی شده باید کلید یکتای خود را داشته باشد
const AGGREGATED_MODULE_KEYS = ['daily_report_full', 'daily_report_all', 'daily_report_total'];

// تشخیص ماژول کلی/تجمیعی
const isAggregatedModule = (moduleKey: string): boolean => {
  return AGGREGATED_MODULE_KEYS.includes(moduleKey) || 
         moduleKey.includes('کلی') || 
         moduleKey.includes('total') ||
         moduleKey.includes('full');
};

export default function DailyReportModule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeModuleKey = searchParams.get('moduleKey') || 'daily_report';
  
  // آیا این ماژول تجمیعی است؟ (نمایش همه گزارشات از همه ماژول‌ها)
  const isAggregated = isAggregatedModule(activeModuleKey);
  
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Initialize reportDate from URL parameter if available
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [orderReports, setOrderReports] = useState<OrderReportRow[]>([]);
  const [staffReports, setStaffReports] = useState<StaffReportRow[]>([]);
  const [dailyNotes, setDailyNotes] = useState<string>('');
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

  // Order details dialog state
  const [orderDetailsDialogOpen, setOrderDetailsDialogOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [selectedDailyOrderRow, setSelectedDailyOrderRow] = useState<OrderReportRow | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

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
  const orderTableScrollRef = useRef<HTMLDivElement>(null);
  const staffTableScrollRef = useRef<HTMLDivElement>(null);

  // Ensure tables start from the right side in RTL by scrolling to the rightmost (selection) column
  useEffect(() => {
    if (loading) return;

    const scrollToAnchor = (container: HTMLDivElement | null, anchor: 'order' | 'staff') => {
      if (!container) return;
      const el = container.querySelector<HTMLElement>(`[data-scroll-anchor="${anchor}"]`);
      el?.scrollIntoView({ block: 'nearest', inline: 'start' });
    };

    scrollToAnchor(orderTableScrollRef.current, 'order');
    scrollToAnchor(staffTableScrollRef.current, 'staff');
  }, [loading, orderReports.length, staffReports.length]);

  // LocalStorage key for backup - includes module key for isolation
  const getLocalStorageKey = useCallback(() => {
    const dateStr = toLocalDateString(reportDate);
    return `daily_report_backup_${user?.id}_${dateStr}_${activeModuleKey}`;
  }, [reportDate, user, activeModuleKey]);

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

  // Clear localStorage backup after successful database save
  const clearLocalStorageBackup = useCallback(() => {
    if (!user) return;
    try {
      localStorage.removeItem(getLocalStorageKey());
    } catch (e) {
      console.error('Error clearing localStorage backup:', e);
    }
  }, [user, getLocalStorageKey]);

  // Save to localStorage on every change (immediate)
  // جلوگیری از ذخیره‌سازی وقتی فرم خالی است یا در حال لود هستیم
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    // اگر فرم کاملا خالی است، ذخیره نکن (هنگام تغییر تاریخ)
    if (orderReports.length === 0 && staffReports.length === 0) return;
    saveToLocalStorage();
  }, [orderReports, staffReports, saveToLocalStorage]);

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
      // ابتدا فرم را پاک کن تا داده‌های تاریخ قبلی نمایش داده نشود
      setOrderReports([]);
      setStaffReports([]);
      setDailyNotes('');
      setExistingReportId(null);
      isInitialLoadRef.current = true;
      fetchExistingReport();
    }
  }, [reportDate, user]);

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    // جلوگیری از auto-save در حین لود یا وقتی فرم خالی است (هنگام تغییر تاریخ)
    if (!user || loading || saving || isInitialLoadRef.current) return;
    
    // اگر فرم کاملا خالی است، auto-save انجام نده
    if (orderReports.length === 0 && staffReports.length === 0) return;

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

     // وجود صرفِ «سطر صندوق/کارت بانکی» نباید باعث auto-save شود.
     // چون در فرآیند لود/رفرش ممکن است state هنوز کامل hydrate نشده باشد و
     // auto-save با snapshot ناقص، داده‌های قبلی را delete/replace کند.
     const hasCashBoxData = staffReports.some(
       (s) =>
         s.is_cash_box &&
         (Boolean(s.bank_card_id) ||
           (s.amount_received ?? 0) > 0 ||
           (s.amount_spent ?? 0) > 0 ||
           Boolean(s.receiving_notes?.trim()) ||
           Boolean(s.spending_notes?.trim()) ||
           Boolean(s.notes?.trim()))
     );

     if (!hasOrderData && !hasStaffData && !hasCashBoxData) return;

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
        // First check if a report already exists for this date AND module_key
        const { data: existingReport } = await supabase
          .from('daily_reports')
          .select('id')
          .eq('report_date', dateStr)
          .eq('module_key', activeModuleKey)
          .maybeSingle();

        if (existingReport?.id) {
          // Use existing report for this date
          reportId = existingReport.id;
          setExistingReportId(reportId);
        } else {
          // Create new report with module_key for isolation
          const { data: newReport, error: createError } = await supabase
            .from('daily_reports')
            .insert({
              report_date: dateStr,
              created_by: user.id,
              module_key: activeModuleKey
            })
            .select('id')
            .single();

          if (createError) {
            // If unique constraint violation, try fetching again
            if (createError.code === '23505') {
              const { data: retry } = await supabase
                .from('daily_reports')
                .select('id')
                .eq('report_date', dateStr)
                .eq('module_key', activeModuleKey)
                .single();
              if (retry?.id) {
                reportId = retry.id;
                setExistingReportId(reportId);
              } else {
                throw createError;
              }
            } else {
              throw createError;
            }
          } else {
            reportId = newReport.id;
            setExistingReportId(reportId);
          }
        }
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
              bank_card_id: s.bank_card_id ?? null,
              notes: s.notes,
              is_cash_box: toDbBoolean(s.is_cash_box),
              is_company_expense:
                toDbBoolean(s.is_company_expense) ||
                Boolean(s.staff_name && s.staff_name.includes('ماهیت شرکت اهرم'))
            }))
          );

        if (insertStaffError) throw insertStaffError;

        // همگام‌سازی موجودی کارت‌ها (Auto-save هم باید اعمال کند)
        await syncBankCardBalancesFromLedger({
          reportId,
          reportDate,
          userId: user.id,
          staffToSave,
        });
      }

      // Clear localStorage backup after successful database save
      clearLocalStorageBackup();
      
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save error:', error);
      // Data is still safe in localStorage
      setAutoSaveStatus('idle');
    }
  }, [user, loading, saving, reportDate, existingReportId, orderReports, staffReports, clearLocalStorageBackup]);

  // Auto-save with debounce when data changes
  useEffect(() => {
    // Skip auto-save on initial load or when form is empty (during date change)
    if (isInitialLoadRef.current) return;
    
    // اگر فرم کاملا خالی است، auto-save انجام نده (هنگام تغییر تاریخ)
    if (orderReports.length === 0 && staffReports.length === 0) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save (debounce 1 second for faster saving)
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

  const fetchSavedReports = async () => {
    if (!user) return;

    try {
      setLoadingSavedReports(true);

      const isManager = await isManagerUser(user.id);

      // Managers: see all reports for this module. Staff: see only reports that include them.
      // Only show non-archived reports
      // ماژول تجمیعی: همه گزارشات را نشان بده / ماژول مجزا: فقط گزارشات همین ماژول
      let reportsQuery = supabase
        .from('daily_reports')
        .select('id, report_date, created_at, notes, is_archived, module_key')
        .or('is_archived.is.null,is_archived.eq.false')
        .order('report_date', { ascending: false });

      // فیلتر بر اساس module_key (مگر ماژول تجمیعی باشد)
      if (!isAggregated) {
        reportsQuery = reportsQuery.eq('module_key', activeModuleKey);
      }

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

      // Only show archived reports for this module (or all modules if aggregated)
      let reportsQuery = supabase
        .from('daily_reports')
        .select('id, report_date, created_at, notes, is_archived, archived_at, module_key')
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      // فیلتر بر اساس module_key (مگر ماژول تجمیعی باشد)
      if (!isAggregated) {
        reportsQuery = reportsQuery.eq('module_key', activeModuleKey);
      }

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
          notes,
          subcategory_id,
          subcategories!projects_v3_subcategory_id_fkey(name)
        `)
        // همه سفارشات غیر بایگانی (بدون توجه به وضعیت مرحله‌ای)
        .not('is_archived', 'is', true)
        .not('is_deep_archived', 'is', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Extract activity description from notes JSON
      const extractActivityDescription = (notes: any): string => {
        if (!notes) return '';
        try {
          const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
          // Try locationPurpose first (for facade scaffolding), then description
          return parsed.locationPurpose || parsed.description || '';
        } catch {
          return '';
        }
      };

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
      const dateStr = toLocalDateString(reportDate);

      // مهم: وقتی تاریخ عوض می‌شود، نباید داده‌های localStorage تاریخ قبل را بخوانیم
      // فقط داده‌های دیتابیس برای این تاریخ خاص و ماژول فعلی لود شود
      // localStorage فقط برای بازیابی داده‌های ذخیره‌نشده همین تاریخ استفاده می‌شود

      // ماژول تجمیعی: همه گزارشات این تاریخ را می‌بیند (برای نمایش، نه ویرایش)
      // ماژول‌های مجزا: فقط گزارش خود را می‌بینند
      let reportQuery = supabase
        .from('daily_reports')
        .select('id, notes, module_key')
        .eq('report_date', dateStr);

      if (!isAggregated) {
        // ماژول مجزا: فقط گزارش همین ماژول
        reportQuery = reportQuery.eq('module_key', activeModuleKey);
      }

      const { data: existingReports, error: existingError } = await reportQuery;

      if (existingError) throw existingError;

      // برای ماژول‌های مجزا، اولین گزارش را لود کن
      // برای ماژول تجمیعی، اولین گزارش را برای ویرایش لود کن (یا null اگر هیچی نیست)
      const existingReport = existingReports?.[0] ?? null;

      let reportIdToLoad: string | null = existingReport?.id ?? null;

      // For non-managers, also verify they have access (their staff record in the report)
      const isManager = await isManagerUser(user.id);
      if (!isManager && reportIdToLoad) {
        const { data: staffRow } = await supabase
          .from('daily_report_staff')
          .select('id')
          .eq('daily_report_id', reportIdToLoad)
          .eq('staff_user_id', user.id)
          .maybeSingle();

        if (!staffRow) {
          // Non-manager has no staff record in this report - don't load it
          reportIdToLoad = null;
        }
      }

      if (reportIdToLoad) {
        setExistingReportId(reportIdToLoad);
        setDailyNotes(existingReport?.notes || '');
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
          // تشخیص سطر ماهیت شرکت اهرم از روی نام یا is_company_expense
          const isCompanyExpense = s.is_company_expense === true || 
            (s.staff_name && s.staff_name.includes('ماهیت شرکت اهرم'));

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
            bank_card_id: s.bank_card_id ?? null,
            notes: s.notes || '',
            is_cash_box: s.is_cash_box || false,
            is_company_expense: isCompanyExpense,
          };
        });

        // تفکیک سطرها بر اساس نوع
        const companyExpenseRows = allStaff.filter((s) => s.is_company_expense);
        const cashBoxRows = allStaff.filter((s) => s.is_cash_box && !s.is_company_expense);
        const regularStaffRows = allStaff.filter((s) => !s.is_cash_box && !s.is_company_expense);
        
        const normalizedStaff: StaffReportRow[] = [];
        
        // اول: سطر ماهیت شرکت اهرم (همیشه ردیف اول)
        if (companyExpenseRows.length > 0) {
          normalizedStaff.push(companyExpenseRows[0]);
        } else {
          normalizedStaff.push({
            staff_user_id: null,
            staff_name: 'ماهیت شرکت اهرم',
            work_status: 'کارکرده',
            overtime_hours: 0,
            amount_received: 0,
            receiving_notes: '',
            amount_spent: 0,
            spending_notes: '',
            bank_card_id: null,
            notes: '',
            is_cash_box: false,
            is_company_expense: true,
          });
        }
        
        // دوم: سطرهای کارت بانکی/صندوق
        if (cashBoxRows.length > 0) {
          normalizedStaff.push(...cashBoxRows);
        }
        
        // سوم: سطرهای نیروی کار عادی
        normalizedStaff.push(...regularStaffRows);

        // اطمینان از وجود حداقل یک سطر خالی برای ورود داده
        const hasAnyRegularRow = normalizedStaff.some((s) => !s.is_cash_box && !s.is_company_expense);
        if (!hasAnyRegularRow) {
          normalizedStaff.push({
            staff_user_id: null,
            staff_name: '',
            work_status: 'غایب',
            overtime_hours: 0,
            amount_received: 0,
            receiving_notes: '',
            amount_spent: 0,
            spending_notes: '',
            bank_card_id: null,
            notes: '',
            is_cash_box: false,
            is_company_expense: false,
          });
        }

        setStaffReports(normalizedStaff);
        
        // پس از لود از دیتابیس، localStorage این تاریخ را پاک کن
        // تا داده‌های قدیمی با داده‌های جدید دیتابیس قاطی نشوند
        clearLocalStorageBackup();
        
        // بعد از لود موفق، اجازه auto-save بده
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
      } else {
        // گزارشی برای این تاریخ در دیتابیس وجود ندارد
        // یک فرم خالی ایجاد کن (localStorage استفاده نشود چون تاریخ جدید است)
        setExistingReportId(null);
        setDailyNotes('');
        clearLocalStorageBackup(); // پاک کردن localStorage این تاریخ
        
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
            staff_name: 'ماهیت شرکت اهرم',
            work_status: 'کارکرده',
            overtime_hours: 0,
            amount_received: 0,
            receiving_notes: '',
            amount_spent: 0,
            spending_notes: '',
            bank_card_id: null,
            notes: '',
            is_cash_box: false,
            is_company_expense: true,
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
            bank_card_id: null,
            notes: '',
            is_cash_box: false,
            is_company_expense: false,
          },
        ]);
        
        // بعد از لود موفق، اجازه auto-save بده
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      // در صورت خطا، فرم خالی نشان بده (نه localStorage)
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
          staff_name: 'ماهیت شرکت اهرم',
          work_status: 'کارکرده',
          overtime_hours: 0,
          amount_received: 0,
          receiving_notes: '',
          amount_spent: 0,
          spending_notes: '',
          bank_card_id: null,
          notes: '',
          is_cash_box: false,
          is_company_expense: true,
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
          bank_card_id: null,
          notes: '',
          is_cash_box: false,
          is_company_expense: false,
        },
      ]);
      toast.error('خطا در دریافت گزارش');
    } finally {
      setLoading(false);
      // بعد از اتمام لود، اجازه auto-save بده
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 500);
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
    setIsSaved(false);
    setOrderReports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // بررسی آیا یک ردیف خالی در انتها وجود دارد
      const isRowEmpty = (row: OrderReportRow) => 
        !row.order_id && 
        !row.activity_description?.trim() && 
        !row.service_details?.trim() && 
        !row.team_name?.trim() && 
        !row.notes?.trim();

      // تعداد ردیف‌های خالی در انتها را شمارش کن
      let emptyRowsAtEnd = 0;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (isRowEmpty(updated[i])) {
          emptyRowsAtEnd++;
        } else {
          break;
        }
      }

      // اگر هیچ ردیف خالی در انتها نیست، یک ردیف خالی اضافه کن
      if (emptyRowsAtEnd === 0) {
        updated.push({
          order_id: '',
          activity_description: '',
          service_details: '',
          team_name: '',
          notes: '',
          row_color: ROW_COLORS[updated.length % ROW_COLORS.length].value
        });
      }
      // اگر بیش از یک ردیف خالی در انتها هست، اضافی‌ها را حذف کن
      else if (emptyRowsAtEnd > 1) {
        // فقط یک ردیف خالی در انتها نگه دار
        const rowsToRemove = emptyRowsAtEnd - 1;
        updated.splice(updated.length - rowsToRemove, rowsToRemove);
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
      bank_card_id: null,
      notes: '',
      is_cash_box: false
    }]);
  };

  const addBankCardRow = () => {
    setIsSaved(false);
    setStaffReports((prev) => [
      {
        staff_user_id: null,
        staff_name: '',
        work_status: 'کارکرده',
        overtime_hours: 0,
        amount_received: 0,
        receiving_notes: '',
        amount_spent: 0,
        spending_notes: '',
        bank_card_id: null,
        notes: '',
        is_cash_box: true,
      },
      ...prev,
    ]);
  };

  const removeStaffRow = (index: number) => {
    if (staffReports[index].is_cash_box) {
      const cashBoxCount = staffReports.filter((r) => r.is_cash_box).length;
      if (cashBoxCount <= 1) {
        toast.error('حداقل یک ردیف کارت بانکی باید باقی بماند');
        return;
      }
    }
    setStaffReports(staffReports.filter((_, i) => i !== index));
  };

  const updateStaffRow = (index: number, field: keyof StaffReportRow, value: any) => {
    setIsSaved(false);
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

      // بررسی آیا یک ردیف خالی (غیر صندوق) وجود دارد
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

      // ردیف‌های غیر صندوق را بررسی کن
      const nonCashBoxRows = updated.filter((r) => !r.is_cash_box);
      
      // تعداد ردیف‌های خالی غیر صندوق در انتها را شمارش کن
      let emptyRowsAtEnd = 0;
      for (let i = nonCashBoxRows.length - 1; i >= 0; i--) {
        if (isRowEmpty(nonCashBoxRows[i])) {
          emptyRowsAtEnd++;
        } else {
          break;
        }
      }

      // اگر هیچ ردیف خالی غیر صندوق در انتها نیست، یک ردیف خالی اضافه کن
      if (emptyRowsAtEnd === 0) {
        updated.push({
          staff_user_id: null,
          staff_name: '',
          work_status: 'غایب',
          overtime_hours: 0,
          amount_received: 0,
          receiving_notes: '',
          amount_spent: 0,
          spending_notes: '',
          bank_card_id: null,
          notes: '',
          is_cash_box: false
        });
      }
      // اگر بیش از یک ردیف خالی غیر صندوق در انتها هست، اضافی‌ها را حذف کن
      else if (emptyRowsAtEnd > 1) {
        const rowsToRemove = emptyRowsAtEnd - 1;
        // ردیف‌های خالی اضافی را از آرایه اصلی حذف کن
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
  };

  const calculateTotals = () => {
    // شمارش نیروهای کارکرده (بدون صندوق و بدون ماهیت شرکت)
    const presentCount = staffReports.filter(s => s.work_status === 'کارکرده' && !s.is_cash_box && !s.is_company_expense).length;
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
      const dateStr = toLocalDateString(reportDate);

      let reportId = existingReportId;

      if (!reportId) {
        // Create new report with module_key for isolation
        const { data: newReport, error: createError } = await supabase
          .from('daily_reports')
          .insert({
            report_date: dateStr,
            created_by: user.id,
            notes: dailyNotes || null,
            module_key: activeModuleKey
          })
          .select('id')
          .single();

        if (createError) throw createError;
        reportId = newReport.id;
        setExistingReportId(reportId);
      } else {
        // Update existing report notes
        await supabase
          .from('daily_reports')
          .update({ notes: dailyNotes || null })
          .eq('id', reportId);
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

        // همچنین گزارش‌ها را در جدول order_daily_logs ذخیره کنید
        for (const r of ordersToInsert) {
          if (r.order_id && user?.id) {
            const logData = {
              order_id: r.order_id,
              report_date: reportDate.toISOString().split('T')[0],
              activity_description: r.activity_description || null,
              team_name: r.team_name || null,
              notes: r.notes || null,
              created_by: user.id
            };
            
            // استفاده از upsert برای جلوگیری از تکرار
            const { error: logError } = await supabase
              .from('order_daily_logs')
              .upsert(logData, { onConflict: 'order_id,report_date' });
            
            if (logError) {
              console.error('Error saving order daily log:', logError);
              // ادامه بده حتی اگر خطا داشت
            }
          }
        }
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

      // Collect affected bank cards from cash-box rows only (these rows represent the bank card itself)
      const cashBoxTotalsByCard = new Map<
        string,
        { received: number; spent: number; receiveDesc?: string; spendDesc?: string }
      >();

      for (const s of staffToSave) {
        if (!s.is_cash_box || !s.bank_card_id) continue;
        const cardId = s.bank_card_id as string;
        const prev = cashBoxTotalsByCard.get(cardId) ?? { received: 0, spent: 0 };
        cashBoxTotalsByCard.set(cardId, {
          received: prev.received + (Number(s.amount_received ?? 0) || 0),
          spent: prev.spent + (Number(s.amount_spent ?? 0) || 0),
          receiveDesc: prev.receiveDesc ?? (s.receiving_notes?.trim() || undefined),
          spendDesc: prev.spendDesc ?? (s.spending_notes?.trim() || undefined),
        });
      }

      const affectedBankCardIds = Array.from(cashBoxTotalsByCard.keys());

      // Best-effort cleanup of previous transaction logs for this report.
      // Note: balance correctness is computed from daily_report_staff + manual transactions,
      // so even if this fails, balances will still be corrected.
      let canReplaceTxLogs = true;
      const { error: deleteTxError } = await supabase
        .from('bank_card_transactions')
        .delete()
        .eq('reference_type', 'daily_report_staff')
        .eq('reference_id', reportId);

      if (deleteTxError) {
        canReplaceTxLogs = false;
        console.warn('Could not delete previous bank card transactions for report:', deleteTxError);
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
          bank_card_id: s.bank_card_id ?? null,
          notes: s.notes || '',
          is_cash_box: toDbBoolean(s.is_cash_box),
          is_company_expense:
            toDbBoolean(s.is_company_expense) ||
            Boolean(s.staff_name && s.staff_name.includes('ماهیت شرکت اهرم'))
        }));

        const { error: staffError } = await supabase
          .from('daily_report_staff')
          .insert(staffPayload);

        if (staffError) {
          console.error('Error inserting staff reports:', staffError);
          throw staffError;
        }

        // همگام‌سازی موجودی کارت‌ها (ذخیره دستی)
        await syncBankCardBalancesFromLedger({
          reportId,
          reportDate,
          userId: user.id,
          staffToSave,
        });
      }

      toast.success('گزارش با موفقیت ذخیره شد');
      
      // Show saved state on button - stay on same page
      setIsSaved(true);
      
      // Refresh saved reports list
      fetchSavedReports();
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
              is_cash_box: s.isCashBox || false,
              is_company_expense: s.isCompanyExpense ?? false
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

  // Fetch full order details for dialog
  const [orderMedia, setOrderMedia] = useState<Array<{id: string; file_path: string; file_type: string; url: string; mime_type?: string}>>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  const fetchOrderDetails = async (orderId: string, dailyRow?: OrderReportRow | null) => {
    setLoadingOrderDetails(true);
    setOrderDetailsDialogOpen(true);
    setSelectedOrderDetails(null);
    setSelectedDailyOrderRow(dailyRow ?? null);
    setOrderMedia([]);
    try {
      // First get the order with all related data
      const { data: orderData, error: orderError } = await supabase
        .from('projects_v3')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) {
        toast.error('سفارش یافت نشد');
        setOrderDetailsDialogOpen(false);
        return;
      }

      // Get subcategory info with full service type info
      let subcategoryInfo = null;
      if (orderData.subcategory_id) {
        const { data: subData } = await supabase
          .from('subcategories')
          .select(`
            name, 
            code,
            service_types:service_type_id(
              name, 
              code,
              service_categories:category_id(name)
            )
          `)
          .eq('id', orderData.subcategory_id)
          .maybeSingle();
        subcategoryInfo = subData;
      }

      // Get province and district info
      let provinceInfo = null;
      let districtInfo = null;
      if (orderData.province_id) {
        const { data: provData } = await supabase
          .from('provinces')
          .select('name')
          .eq('id', orderData.province_id)
          .maybeSingle();
        provinceInfo = provData;
      }
      if (orderData.district_id) {
        const { data: distData } = await supabase
          .from('districts')
          .select('name')
          .eq('id', orderData.district_id)
          .maybeSingle();
        districtInfo = distData;
      }

      // Get customer profile info
      let profileInfo = null;
      if (orderData.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id, customer_code')
          .eq('id', orderData.customer_id)
          .maybeSingle();
        
        if (customerData?.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, phone_number, avatar_url')
            .eq('user_id', customerData.user_id)
            .maybeSingle();
          profileInfo = { ...profileData, customer_code: customerData.customer_code };
        }
      }

      // Get location info from hierarchy project if exists
      let locationInfo = null;
      if (orderData.hierarchy_project_id) {
        const { data: hierarchyData } = await supabase
          .from('projects_hierarchy')
          .select('location_id, title, locations:location_id(title, address_line, lat, lng)')
          .eq('id', orderData.hierarchy_project_id)
          .maybeSingle();
        locationInfo = hierarchyData?.locations;
      }

      // Get order approvals
      let approvalsInfo: any[] = [];
      const { data: approvalsData } = await supabase
        .from('order_approvals')
        .select('approver_role, approved_at, approver_user_id')
        .eq('order_id', orderId);
      if (approvalsData) {
        approvalsInfo = approvalsData;
      }

      // Get order payments
      let paymentsInfo: any[] = [];
      const { data: paymentsData } = await supabase
        .from('order_payments')
        .select('amount, payment_method, created_at, notes')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      if (paymentsData) {
        paymentsInfo = paymentsData;
      }

      // Fetch order media (images and videos) with mime_type for proper video handling
      const { data: mediaData } = await supabase
        .from('project_media')
        .select('id, file_path, file_type, mime_type, created_at')
        .eq('project_id', orderId)
        .order('created_at', { ascending: true });

      if (mediaData && mediaData.length > 0) {
        const mediaWithUrls = await Promise.all(
          mediaData.map(async (media) => {
            const { data: signedData } = await supabase.storage
              .from('project-media')
              .createSignedUrl(media.file_path, 3600);
            return {
              ...media,
              url: signedData?.signedUrl || ''
            };
          })
        );
        setOrderMedia(mediaWithUrls.filter(m => m.url));
      } else {
        setOrderMedia([]);
      }

      setSelectedOrderDetails({
        ...orderData,
        subcategories: subcategoryInfo,
        provinces: provinceInfo,
        districts: districtInfo,
        profiles: profileInfo,
        locations: locationInfo,
        approvals: approvalsInfo,
        payments: paymentsInfo
      });
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error('خطا در دریافت جزئیات سفارش');
      setOrderDetailsDialogOpen(false);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Handle media upload for order
  const handleOrderMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    if (!selectedOrderDetails || !event.target.files?.length) return;
    
    setUploadingMedia(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        toast.error('لطفاً دوباره وارد شوید');
        return;
      }

      const file = event.target.files[0];
      const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
      
      if (file.size > maxSize) {
        toast.error(`حجم فایل بیشتر از ${type === 'image' ? '10' : '50'} مگابایت است`);
        return;
      }

      const ext = file.name.split('.').pop() || '';
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const storagePath = `${auth.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-media')
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      // Save to database
      const { error: dbError } = await supabase
        .from('project_media')
        .insert({
          project_id: selectedOrderDetails.id,
          user_id: auth.user.id,
          file_path: storagePath,
          file_type: type,
          file_size: file.size,
          mime_type: file.type,
        });

      if (dbError) throw dbError;

      // Refresh media list
      const { data: signedData } = await supabase.storage
        .from('project-media')
        .createSignedUrl(storagePath, 3600);

      if (signedData?.signedUrl) {
        setOrderMedia(prev => [...prev, {
          id: Date.now().toString(),
          file_path: storagePath,
          file_type: type,
          url: signedData.signedUrl
        }]);
      }

      toast.success('فایل با موفقیت آپلود شد');
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('خطا در آپلود فایل');
    } finally {
      setUploadingMedia(false);
      event.target.value = '';
    }
  };

  return (
    <ModuleLayout
      defaultModuleKey={activeModuleKey}
      defaultTitle={DEFAULT_TITLE}
      defaultDescription={DEFAULT_DESCRIPTION}
      icon={<FileText className="h-5 w-5 text-primary" />}
      action={
        <div className="flex items-center gap-3">
          <ExcelImportDialog
            onImportComplete={handleExcelImport}
            knownStaffMembers={staffMembers}
          />
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
      }
    >
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-full">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="inline-flex w-max min-w-full sm:grid sm:w-full sm:max-w-3xl sm:grid-cols-5 gap-1">
              <TabsTrigger value="new-report" className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>ثبت گزارش</span>
              </TabsTrigger>
              <TabsTrigger value="saved-reports" className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <History className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>گزارشات ذخیره شده</span>
              </TabsTrigger>
              <TabsTrigger value="archived-reports" className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <Archive className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>بایگانی</span>
              </TabsTrigger>
              <TabsTrigger value="staff-audit" className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <Calculator className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>حسابرسی نیروها</span>
              </TabsTrigger>
              <TabsTrigger value="salary-settings" className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>تنظیمات حقوق</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* New Report Tab */}
          <TabsContent value="new-report" className="space-y-6 mt-6">
            {/* Date Picker with Navigation */}
            <div className="flex flex-col items-end gap-3">
              {/* ردیف اول - تاریخ و لیبل */}
              <div className="flex items-center gap-2 sm:gap-3">
                <PersianDatePicker
                  value={reportDate.toISOString()}
                  onChange={(date) => date && setReportDate(new Date(date))}
                  timeMode="none"
                />
                <Label className="text-sm sm:text-base font-medium">تاریخ گزارش:</Label>
              </div>

              {/* ردیف دوم - دکمه‌ها */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* دکمه روز قبل */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const prevDay = new Date(reportDate);
                    prevDay.setDate(prevDay.getDate() - 1);
                    setReportDate(prevDay);
                  }}
                  className="gap-2 px-4 sm:px-6 py-3 text-base sm:text-lg font-bold border-2 shadow-md hover:shadow-lg transition-all"
                >
                  روز قبل
                  <span className="text-2xl sm:text-3xl font-bold">←</span>
                </Button>

                {/* دکمه روز بعد */}
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                    const nextDay = new Date(reportDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setReportDate(nextDay);
                  }}
                  className="gap-2 px-4 sm:px-6 py-3 text-base sm:text-lg font-bold shadow-md hover:shadow-lg transition-all"
                >
                  <span className="text-2xl sm:text-3xl font-bold">→</span>
                  روز بعد
                </Button>
              </div>
            </div>

            {/* Daily Notes */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-muted/30 p-3 rounded-lg">
              <Label className="text-sm font-medium whitespace-nowrap">توضیحات روز:</Label>
              <AutoResizeTextarea
                placeholder="توضیحات روزانه"
                value={dailyNotes}
                onChange={(e) => {
                  setDailyNotes(e.target.value);
                  setIsSaved(false);
                }}
                className="flex-1 min-h-[40px] text-sm resize-none"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              </div>
            ) : (
              <>
                {/* Order Reports Table */}
                <Card className="border-2 border-blue-500/30 -mx-2 sm:mx-0 rounded-none sm:rounded-lg">
                  <CardHeader className="pb-3 px-2 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
                          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        </div>
                        <CardTitle className="text-base sm:text-lg">گزارش سفارشات مشتری</CardTitle>
                      </div>
                      <Button size="sm" onClick={addOrderRow} className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden xs:inline">افزودن ردیف</span>
                        <span className="xs:hidden">ردیف</span>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 sm:px-6">
                    <div ref={orderTableScrollRef} className="overflow-x-auto" dir="rtl">
                      <Table className="table-auto border-collapse border border-blue-300">
                        <TableHeader>
                          <TableRow className="bg-blue-100 dark:bg-blue-900/30">
                            <TableHead
                              data-scroll-anchor="order"
                              className="text-right whitespace-nowrap px-2 border border-blue-300"
                            >
                              سفارش مشتری را انتخاب کنید
                            </TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">مشخصات سفارش</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">شرح فعالیت امروز و ابعاد</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">اکیپ</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-blue-300">توضیحات</TableHead>
                            <TableHead className="w-[50px] border border-blue-300"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(orderReports.length === 0 ? [{
                            order_id: '',
                            activity_description: '',
                            service_details: '',
                            team_name: '',
                            notes: '',
                            row_color: ROW_COLORS[0].value,
                          }] : orderReports).map((row, index) => (
                              <TableRow key={index} className={`${getRowColorClass(row.row_color)} even:opacity-90`}>
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
                                        onClick={() => fetchOrderDetails(row.order_id, row)}
                                        title="مشاهده جزئیات سفارش"
                                        className="shrink-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  {(() => {
                                    const selectedOrder = orders.find(o => o.id === row.order_id);
                                    if (!selectedOrder) return <span className="text-muted-foreground text-sm">ابتدا سفارش انتخاب کنید</span>;
                                    return (
                                      <div className="text-xs space-y-1 min-w-[25ch] p-2 bg-background/50 rounded border border-blue-100">
                                        {selectedOrder.subcategory_name && (
                                          <div className="flex items-start gap-1">
                                            <span className="font-medium text-blue-700">نوع خدمات:</span>
                                            <span>{selectedOrder.subcategory_name}</span>
                                          </div>
                                        )}
                                        {selectedOrder.address && (
                                          <div className="flex items-start gap-1">
                                            <span className="font-medium text-blue-700">آدرس:</span>
                                            <span className="line-clamp-2">{selectedOrder.address}</span>
                                          </div>
                                        )}
                                        {selectedOrder.activity_description && (
                                          <div className="flex items-start gap-1">
                                            <span className="font-medium text-blue-700">شرح محل:</span>
                                            <span className="line-clamp-2">{selectedOrder.activity_description}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <AutoResizeTextarea
                                    value={`${row.activity_description || ''}${row.activity_description && row.service_details ? '\n' : ''}${row.service_details || ''}`}
                                    onChange={(e) => {
                                      updateOrderRow(index, 'activity_description', e.target.value);
                                      updateOrderRow(index, 'service_details', '');
                                    }}
                                    className="min-h-[50px] min-w-[50ch] bg-background/50"
                                    placeholder="شرح فعالیت و ابعاد..."
                                  />
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <Input
                                    value={row.team_name}
                                    onChange={(e) => updateOrderRow(index, 'team_name', e.target.value)}
                                    className="bg-background/50 min-w-[40ch]"
                                    placeholder="نام اکیپ"
                                  />
                                </TableCell>
                                <TableCell className="border border-blue-200">
                                  <AutoResizeTextarea
                                    value={row.notes}
                                    onChange={(e) => updateOrderRow(index, 'notes', e.target.value)}
                                    className="min-h-[50px] min-w-[40ch] bg-background/50"
                                    placeholder="توضیحات..."
                                  />
                                </TableCell>
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
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Staff Reports Table */}
                <Card data-dropdown-boundary className="relative border-2 border-amber-500/30 -mx-2 sm:mx-0 rounded-none sm:rounded-lg">
                  <CardHeader className="pb-3 px-2 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10">
                          <User className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                        </div>
                        <CardTitle className="text-base sm:text-lg">گزارش نیروها</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={addBankCardRow}
                          className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
                        >
                          <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden xs:inline">افزودن کارت بانکی</span>
                          <span className="xs:hidden">کارت</span>
                        </Button>
                        <Button size="sm" onClick={addStaffRow} className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden xs:inline">افزودن نیرو</span>
                          <span className="xs:hidden">نیرو</span>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 sm:px-6">
                    <div ref={staffTableScrollRef} className="overflow-x-auto" dir="rtl">
                      <Table className="table-auto border-collapse border border-amber-300">
                        <TableHeader>
                          <TableRow className="bg-amber-100 dark:bg-amber-900/30">
                            <TableHead
                              data-scroll-anchor="staff"
                              className="text-right whitespace-nowrap px-2 border border-amber-300"
                            >
                              نیروها
                            </TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">کارکرد</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">اضافه کاری</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">مبلغ دریافتی</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات دریافتی</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">مبلغ خرج کرده شده در کار</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات مبلغ خرج کرد</TableHead>
                            <TableHead className="text-right whitespace-nowrap px-2 border border-amber-300">توضیحات</TableHead>
                            <TableHead className="w-[50px] border border-amber-300"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffReports.map((row, index) => {
                            const isCompanyExpense =
                              row.is_company_expense === true ||
                              (typeof row.staff_name === 'string' && row.staff_name.includes('ماهیت شرکت اهرم'));

                            return (
                              <TableRow
                                key={index}
                                className={
                                  isCompanyExpense
                                    ? 'bg-primary/5'
                                    : row.is_cash_box
                                      ? 'bg-amber-50 dark:bg-amber-900/20'
                                      : 'even:bg-amber-50/50'
                                }
                              >
                              <TableCell className="border border-amber-200">
                                 {isCompanyExpense ? (
                                   <div className="min-w-[220px] font-semibold flex items-center gap-2 text-foreground">
                                     <Building className="h-5 w-5 text-primary" />
                                     ماهیت شرکت اهرم
                                   </div>
                                 ) : row.is_cash_box ? (
                                  <div className="min-w-[220px]">
                                    <BankCardSelect
                                      value={row.bank_card_id ?? null}
                                      onValueChange={(value) => updateStaffRow(index, 'bank_card_id', value)}
                                      placeholder="انتخاب کارت بانکی"
                                      showBalance={true}
                                    />
                                  </div>
                                ) : (
                                  <StaffSearchSelect
                                    value={row.staff_user_id || ''}
                                    onValueChange={(code, name, userId) => {
                                      // Check if this staff is already selected
                                      const alreadySelected = staffReports.some(
                                        (r, i) => i !== index && r.staff_user_id === code && code
                                      );
                                      if (alreadySelected) {
                                        toast.error('این نیرو قبلاً انتخاب شده است');
                                        return;
                                      }

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
                                            bank_card_id: null,
                                            notes: '',
                                            is_cash_box: false
                                          });
                                        }

                                        return updated;
                                      });
                                    }}
                                    placeholder="انتخاب نیرو"
                                    excludeCodes={staffReports
                                      .filter((r, i) => i !== index && r.staff_user_id)
                                      .map(r => r.staff_user_id as string)}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                 {row.is_cash_box || isCompanyExpense ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <WorkStatusSelect
                                    value={row.work_status}
                                    onValueChange={(value) => updateStaffRow(index, 'work_status', value)}
                                    className="min-w-[90px] w-auto"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                 {row.is_cash_box || isCompanyExpense ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <div className="relative">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.overtime_hours === 0 ? '' : row.overtime_hours.toString()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/^0+(?=\d)/, '');
                                        const numVal = parseFloat(val) || 0;
                                        if (numVal <= 15) {
                                          updateStaffRow(index, 'overtime_hours', numVal);
                                        } else {
                                          toast.error('اضافه‌کاری نمی‌تواند بیشتر از ۱۵ ساعت باشد');
                                        }
                                      }}
                                      className="min-w-[90px] pl-10 text-left"
                                      dir="ltr"
                                      placeholder="0"
                                    />
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ساعت</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <div className="relative">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={((row.amount_received ?? 0) === 0)
                                      ? ''
                                      : (row.amount_received ?? 0).toLocaleString('en-US')}
                                    onChange={(e) => {
                                      const val = e.target.value
                                        .replace(/[^0-9۰-۹]/g, '')
                                        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
                                      const numVal = parseInt(val) || 0;
                                      if (numVal <= 300000000) {
                                        updateStaffRow(index, 'amount_received', numVal);
                                      } else {
                                        toast.error('مبلغ نمی‌تواند بیشتر از ۳۰۰ میلیون تومان باشد');
                                      }
                                    }}
                                    className="min-w-[220px] pl-12 text-left tabular-nums"
                                    dir="ltr"
                                    placeholder="0"
                                  />
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">تومان</span>
                                </div>
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <AutoResizeTextarea
                                  value={row.receiving_notes ?? ''}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 300) {
                                      updateStaffRow(index, 'receiving_notes', e.target.value);
                                    }
                                  }}
                                  placeholder={isCompanyExpense ? 'توضیحات دریافتی شرکت...' : 'توضیحات...'}
                                  className="min-w-[30ch] min-h-[50px]"
                                  maxLength={300}
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
                                      const numVal = parseInt(val) || 0;
                                      if (numVal <= 300000000) {
                                        updateStaffRow(index, 'amount_spent', numVal);
                                      } else {
                                        toast.error('مبلغ نمی‌تواند بیشتر از ۳۰۰ میلیون تومان باشد');
                                      }
                                    }}
                                    className="min-w-[220px] pl-12 text-left tabular-nums"
                                    dir="ltr"
                                    placeholder="0"
                                  />
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">تومان</span>
                                </div>
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <AutoResizeTextarea
                                  value={row.spending_notes}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 300) {
                                      updateStaffRow(index, 'spending_notes', e.target.value);
                                    }
                                  }}
                                  placeholder="توضیحات..."
                                  className="min-w-[30ch] min-h-[50px]"
                                  maxLength={300}
                                />
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                <AutoResizeTextarea
                                  value={row.notes}
                                  onChange={(e) => {
                                    if (e.target.value.length <= 300) {
                                      updateStaffRow(index, 'notes', e.target.value);
                                    }
                                  }}
                                   placeholder={isCompanyExpense ? 'هزینه‌های شرکت (نهار، ایاب‌وذهاب و...)' : 'توضیحات...'}
                                  className="min-w-[30ch] min-h-[50px]"
                                  maxLength={300}
                                />
                              </TableCell>
                              <TableCell className="border border-amber-200">
                                 {!isCompanyExpense && (!row.is_cash_box || staffReports.filter((r) => r.is_cash_box).length > 1) && (
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
                            </TableRow>
                            );
                          })}

                          {/* Summary Row */}
                          <TableRow className="bg-amber-200 dark:bg-amber-800/40 font-bold">
                            <TableCell className="border border-amber-300 text-right">جمع:</TableCell>
                            <TableCell className="border border-amber-300">{totals.presentCount} نیرو</TableCell>
                            <TableCell className="border border-amber-300">{totals.totalOvertime} ساعت</TableCell>
                            <TableCell className="border border-amber-300">{totals.totalReceived.toLocaleString('fa-IR')} تومان</TableCell>
                            <TableCell className="border border-amber-300"></TableCell>
                            <TableCell className="border border-amber-300">{totals.totalSpent.toLocaleString('fa-IR')} تومان</TableCell>
                            <TableCell className="border border-amber-300"></TableCell>
                            <TableCell className="border border-amber-300"></TableCell>
                            <TableCell className="border border-amber-300"></TableCell>
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
                    onClick={() => {
                      setIsSaved(false);
                      saveReport();
                    }} 
                    disabled={saving}
                    size="lg"
                    className={`gap-2 min-w-[200px] ${isSaved ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isSaved ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {isSaved ? 'ذخیره شده' : 'ذخیره گزارش'}
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

        {/* Order Details Dialog */}
        <AlertDialog open={orderDetailsDialogOpen} onOpenChange={setOrderDetailsDialogOpen}>
          <AlertDialogContent className="!max-w-2xl !w-[95vw] !max-h-[90vh] !p-0 !flex !flex-col overflow-hidden"  style={{ maxHeight: '90vh' }}>
            {/* Close button at top - Fixed header */}
            <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-lg">مشخصات کامل سفارش</h2>
              </div>
              <div className="flex items-center gap-2">
                {selectedOrderDetails && (
                  <Button 
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setOrderDetailsDialogOpen(false);
                      // Navigate to order detail with properly encoded return path including report date
                      const returnPath = encodeURIComponent(`/daily-report?date=${reportDate}`);
                      navigate(`/orders/${selectedOrderDetails.id}?returnTo=${returnPath}`);
                    }}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    مشاهده و ویرایش کامل
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="default"
                  onClick={() => setOrderDetailsDialogOpen(false)}
                  className="gap-2 px-4"
                >
                  <X className="h-5 w-5" />
                  بستن
                </Button>
              </div>
            </div>
            
            {/* Scrollable content area - vertical scroll only */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4" style={{ scrollbarWidth: 'auto', scrollbarColor: 'hsl(var(--primary)) transparent' }}>
              <style>{`
                .order-details-scroll::-webkit-scrollbar {
                  width: 10px;
                }
                .order-details-scroll::-webkit-scrollbar-track {
                  background: hsl(var(--muted));
                  border-radius: 5px;
                }
                .order-details-scroll::-webkit-scrollbar-thumb {
                  background: hsl(var(--primary) / 0.5);
                  border-radius: 5px;
                }
                .order-details-scroll::-webkit-scrollbar-thumb:hover {
                  background: hsl(var(--primary) / 0.7);
                }
              `}</style>
              <div className="order-details-scroll">
            
            <AlertDialogHeader className="sr-only">
              <AlertDialogTitle>مشخصات کامل سفارش</AlertDialogTitle>
            </AlertDialogHeader>
            
            {loadingOrderDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : selectedOrderDetails ? (
              (() => {
                // Parse notes JSON using shared parseOrderNotes function (handles double-stringified JSON)
                const parsedNotes = parseOrderNotes(selectedOrderDetails.notes);

                const getStatusLabel = (status: string, executionStage?: string) => {
                  if (status === 'in_progress' && executionStage) {
                    const stageLabels: Record<string, string> = {
                      'awaiting_payment': 'در انتظار پرداخت',
                      'awaiting_collection': 'در انتظار جمع‌آوری',
                      'collected': 'جمع‌آوری شده',
                      'order_executed': 'اجرا شده'
                    };
                    return stageLabels[executionStage] || executionStage;
                  }
                  const statusLabels: Record<string, string> = {
                    'closed': 'بسته شده',
                    'in_progress': 'در حال اجرا',
                    'pending': 'در انتظار تایید',
                    'pending_execution': 'در انتظار اجرا',
                    'completed': 'اجرا شده - در انتظار پرداخت',
                    'paid': 'پرداخت شده',
                    'approved': 'تایید شده',
                    'rejected': 'رد شده'
                  };
                  return statusLabels[status] || status;
                };

                const getStatusColor = (status: string) => {
                  const colors: Record<string, string> = {
                    'closed': 'bg-gray-100 text-gray-800 border-gray-300',
                    'in_progress': 'bg-blue-100 text-blue-800 border-blue-300',
                    'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
                    'pending_execution': 'bg-orange-100 text-orange-800 border-orange-300',
                    'completed': 'bg-green-100 text-green-800 border-green-300',
                    'paid': 'bg-purple-100 text-purple-800 border-purple-300',
                    'approved': 'bg-emerald-100 text-emerald-800 border-emerald-300',
                    'rejected': 'bg-red-100 text-red-800 border-red-300'
                  };
                  return colors[status] || 'bg-gray-100 text-gray-800';
                };

                // Note: Price info removed from Daily Report module per requirements

                return (
                  <div className="space-y-4 text-right">
                    {/* Order Code & Status */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-l from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(selectedOrderDetails.status)}`}>
                        {getStatusLabel(selectedOrderDetails.status, selectedOrderDetails.execution_stage)}
                      </div>
                      <div className="text-left">
                        <span className="text-sm text-muted-foreground">کد سفارش</span>
                        <p className="font-bold text-blue-600 text-xl">{selectedOrderDetails.code}</p>
                      </div>
                    </div>

                    {/* Service Type */}
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <div className="flex items-center gap-2 mb-3">
                        <Building className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">نوع خدمات</h4>
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-lg font-medium">
                          {selectedOrderDetails.subcategories?.name || parsedNotes?.subcategory_name || 'نامشخص'}
                        </p>
                        {selectedOrderDetails.subcategories?.service_types?.name && (
                          <p className="text-sm text-muted-foreground">
                            {selectedOrderDetails.subcategories.service_types.name}
                          </p>
                        )}
                        {parsedNotes?.service_type && (
                          <Badge variant="outline" className="w-fit mt-2">
                            {parsedNotes.service_type === 'facade' && 'داربست سطحی نما'}
                            {parsedNotes.service_type === 'formwork' && 'داربست حجمی کفراژ'}
                            {parsedNotes.service_type === 'ceiling-tiered' && 'داربست زیر بتن - تیرچه'}
                            {parsedNotes.service_type === 'ceiling-slab' && 'داربست زیر بتن - دال بتنی'}
                            {parsedNotes.service_type === 'column' && 'داربست ستونی'}
                            {!['facade', 'formwork', 'ceiling-tiered', 'ceiling-slab', 'column'].includes(parsedNotes.service_type) && parsedNotes.service_type}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="p-4 border rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">اطلاعات مشتری</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/40 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">نام مشتری</span>
                          <p className="font-medium">{selectedOrderDetails.customer_name || selectedOrderDetails.profiles?.full_name || parsedNotes?.customerName || 'نامشخص'}</p>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg" dir="ltr">
                          <span className="text-xs text-muted-foreground block mb-1 text-right" dir="rtl">شماره تماس</span>
                          <p className="font-medium text-left">{selectedOrderDetails.customer_phone || selectedOrderDetails.profiles?.phone_number || parsedNotes?.phoneNumber || 'نامشخص'}</p>
                        </div>
                      </div>
                      {selectedOrderDetails.profiles?.customer_code && (
                        <div className="p-2 bg-primary/10 rounded-lg text-center">
                          <span className="text-xs text-muted-foreground">کد مشتری: </span>
                          <span className="font-bold text-primary">{selectedOrderDetails.profiles.customer_code}</span>
                        </div>
                      )}
                    </div>

                    {/* Location Info with Province & District + Map */}
                    <div className="p-4 border rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">آدرس محل</h4>
                      </div>
                      <div className="space-y-2">
                        {/* Province & District */}
                        {(selectedOrderDetails.provinces?.name || selectedOrderDetails.districts?.name) && (
                          <div className="flex gap-2 flex-wrap">
                            {selectedOrderDetails.provinces?.name && (
                              <Badge variant="secondary" className="text-xs">{selectedOrderDetails.provinces.name}</Badge>
                            )}
                            {selectedOrderDetails.districts?.name && (
                              <Badge variant="outline" className="text-xs">{selectedOrderDetails.districts.name}</Badge>
                            )}
                          </div>
                        )}
                        {selectedOrderDetails.locations?.title && (
                          <p className="text-sm font-semibold text-primary">{selectedOrderDetails.locations.title}</p>
                        )}
                        <p className="text-sm">{selectedOrderDetails.address || selectedOrderDetails.locations?.address_line || 'نامشخص'}</p>
                        {selectedOrderDetails.detailed_address && (
                          <p className="text-sm text-muted-foreground">{selectedOrderDetails.detailed_address}</p>
                        )}
                        
                        {/* Location Map with Navigation */}
                        {(() => {
                          const lat = selectedOrderDetails.location_lat || selectedOrderDetails.locations?.lat;
                          const lng = selectedOrderDetails.location_lng || selectedOrderDetails.locations?.lng;
                          if (lat && lng) {
                            return (
                              <div className="mt-3 h-56 sm:h-64 rounded-lg overflow-hidden border border-primary/20">
                                <StaticLocationMap
                                  lat={lat}
                                  lng={lng}
                                  address={selectedOrderDetails.address || selectedOrderDetails.locations?.address_line}
                                  detailedAddress={selectedOrderDetails.detailed_address}
                                  showNavigationButton={true}
                                />
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Order Timeline / Stages */}
                    <OrderTimeline
                      orderStatus={selectedOrderDetails.status}
                      createdAt={selectedOrderDetails.created_at}
                      approvedAt={selectedOrderDetails.approved_at}
                      executionStartDate={selectedOrderDetails.execution_start_date}
                      executionEndDate={selectedOrderDetails.execution_end_date}
                      customerCompletionDate={selectedOrderDetails.customer_completion_date}
                      rejectionReason={selectedOrderDetails.rejection_reason}
                      executionStage={selectedOrderDetails.execution_stage}
                      executionStageUpdatedAt={selectedOrderDetails.execution_stage_updated_at}
                      paymentConfirmedAt={selectedOrderDetails.payment_confirmed_at}
                      approvedCollectionDate={selectedOrderDetails.approved_collection_date}
                    />

                    {/* Execution Schedule */}
                    {(selectedOrderDetails.execution_start_date || parsedNotes?.requested_date) && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-amber-600" />
                          <h4 className="font-semibold text-amber-800 dark:text-amber-200">تاریخ اجرا</h4>
                        </div>
                        {selectedOrderDetails.execution_start_date && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">شروع اجرا: </span>
                            <span className="font-medium">{formatPersianDate(selectedOrderDetails.execution_start_date)}</span>
                          </p>
                        )}
                        {parsedNotes?.requested_date && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">تاریخ درخواست: </span>
                            <span className="font-medium">{new Date(parsedNotes.requested_date).toLocaleDateString('fa-IR')}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Dimensions - Enhanced */}
                    {parsedNotes?.dimensions && parsedNotes.dimensions.length > 0 && (
                      <div className="p-4 border rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">ابعاد درخواستی (متر)</h4>
                        </div>
                        <div className="space-y-2">
                          {parsedNotes.dimensions.map((dim: any, index: number) => (
                            <div key={index} className="flex flex-wrap gap-4 text-sm p-3 bg-muted/30 rounded-lg">
                              {dim.length && <span className="flex items-center gap-1">طول: <strong className="text-primary">{dim.length}</strong> متر</span>}
                              {dim.width && <span className="flex items-center gap-1">عرض: <strong className="text-primary">{dim.width}</strong> متر</span>}
                              {dim.height && <span className="flex items-center gap-1">ارتفاع: <strong className="text-primary">{dim.height}</strong> متر</span>}
                            </div>
                          ))}
                        </div>
                        {parsedNotes.totalArea && (
                          <div className="p-3 bg-primary/10 rounded-lg flex items-center justify-between mt-2">
                            <span className="text-sm text-muted-foreground">متراژ کل</span>
                            <span className="font-bold text-lg text-primary">
                              {parsedNotes.totalArea % 1 === 0 ? parsedNotes.totalArea : parsedNotes.totalArea.toFixed(2)} متر{parsedNotes.service_type === 'facade' ? ' مربع' : ' مکعب'}
                            </span>
                          </div>
                        )}
                        {/* Column specific info */}
                        {parsedNotes.columnHeight && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <span className="text-sm text-muted-foreground">ارتفاع ستون: </span>
                            <strong className="text-primary">{parsedNotes.columnHeight}</strong> متر
                          </div>
                        )}
                      </div>
                    )}

                    {/* Single Dimensions (if not array) */}
                    {(!parsedNotes?.dimensions || parsedNotes.dimensions.length === 0) && (parsedNotes?.length || parsedNotes?.width || parsedNotes?.height) && (
                      <div className="p-4 border rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">ابعاد درخواستی (متر)</h4>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm p-3 bg-muted/30 rounded-lg">
                          {parsedNotes?.length && <span className="flex items-center gap-1">طول: <strong className="text-primary">{parsedNotes.length}</strong> متر</span>}
                          {parsedNotes?.width && <span className="flex items-center gap-1">عرض: <strong className="text-primary">{parsedNotes.width}</strong> متر</span>}
                          {parsedNotes?.height && <span className="flex items-center gap-1">ارتفاع: <strong className="text-primary">{parsedNotes.height}</strong> متر</span>}
                        </div>
                      </div>
                    )}

                    {/* شرح محل و فعالیت - از فرم ثبت شده مشتری */}
                    <div className="p-4 border rounded-xl space-y-3 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-600" />
                        <h4 className="font-semibold text-amber-800 dark:text-amber-200">شرح محل نصب و نوع فعالیت (از فرم مشتری)</h4>
                      </div>
                      <div className="space-y-3">
                        {/* شرح محل نصب و نوع فعالیت - این فیلد اصلی است که مشتری پر می‌کند */}
                        <div className="p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                          <span className="text-xs text-amber-700 dark:text-amber-300 block mb-1 font-medium">شرح محل نصب و نوع فعالیت</span>
                          <p className="text-sm whitespace-pre-wrap text-amber-900 dark:text-amber-100">
                            {parsedNotes?.locationPurpose || parsedNotes?.location_purpose || parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || 'ثبت نشده'}
                          </p>
                        </div>
                        {/* تاریخ و زمان نصب درخواستی */}
                        {(parsedNotes?.installationDateTime || parsedNotes?.installation_date) && (
                          <div className="p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                            <span className="text-xs text-amber-700 dark:text-amber-300 block mb-1 font-medium">تاریخ و زمان نصب درخواستی</span>
                            <p className="text-sm whitespace-pre-wrap text-amber-900 dark:text-amber-100">
                              {(() => {
                                const dateStr = parsedNotes?.installationDateTime || parsedNotes?.installation_date;
                                if (!dateStr) return 'ثبت نشده';
                                try {
                                  return new Date(dateStr).toLocaleDateString('fa-IR', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                } catch {
                                  return dateStr;
                                }
                              })()}
                            </p>
                          </div>
                        )}
                        {/* نام و تلفن مشتری از فرم */}
                        {(parsedNotes?.customerName || parsedNotes?.phoneNumber) && (
                          <div className="grid grid-cols-2 gap-2">
                            {parsedNotes?.customerName && (
                              <div className="p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                                <span className="text-xs text-amber-700 dark:text-amber-300 block mb-1">نام مشتری (فرم)</span>
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{parsedNotes.customerName}</p>
                              </div>
                            )}
                            {parsedNotes?.phoneNumber && (
                              <div className="p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700" dir="ltr">
                                <span className="text-xs text-amber-700 dark:text-amber-300 block mb-1 text-right" dir="rtl">تلفن (فرم)</span>
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 text-left">{parsedNotes.phoneNumber}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scaffold Conditions */}
                    {parsedNotes?.scaffold_conditions && Object.keys(parsedNotes.scaffold_conditions).length > 0 && (() => {
                      const conditionLabels: Record<string, string> = {
                        'platformHeight': 'روی سکو',
                        'vehicleDistance': 'فاصله خودرو از پای کار',
                        'hasPlatform': 'دارای سکو',
                        'hasLadder': 'دارای نردبان',
                        'hasSafetyNet': 'دارای تور ایمنی',
                        'hasWheels': 'دارای چرخ',
                        'hasRailing': 'دارای نرده',
                        'needsAnchor': 'نیاز به لنگر',
                        'needsProtection': 'نیاز به حفاظ',
                        'hasConsole': 'دارای کنسول',
                        'hasBracket': 'دارای براکت',
                        'hasGuardRail': 'دارای گاردریل',
                        'platformOnBase': 'سکوی پای داربست',
                        'onPlatform': 'روی سکو'
                      };
                      return (
                        <div className="p-4 border rounded-xl space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <h4 className="font-semibold">شرایط داربست</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(parsedNotes.scaffold_conditions).map(([key, value]: [string, any]) => (
                              <div key={key} className="p-2 bg-background/50 rounded-lg flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{conditionLabels[key] || key}</span>
                                <Badge variant={value === true ? 'default' : 'secondary'} className="text-xs">
                                  {value === true ? 'بله' : value === false ? 'خیر' : typeof value === 'number' ? `${value} متر` : String(value)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Platform Height & Vehicle Distance - Separate fields */}
                    {(parsedNotes?.platformHeight || parsedNotes?.vehicleDistance || parsedNotes?.platform_height || parsedNotes?.vehicle_distance) && (
                      <div className="p-4 border rounded-xl space-y-3 bg-indigo-50/50 dark:bg-indigo-900/10">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-indigo-600" />
                          <h4 className="font-semibold">شرایط محل پروژه</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(parsedNotes?.platformHeight || parsedNotes?.platform_height) && (
                            <div className="p-3 bg-background/50 rounded-lg flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">ارتفاع سکو</span>
                              <Badge variant="outline" className="text-xs font-bold">
                                {parsedNotes.platformHeight || parsedNotes.platform_height} متر
                              </Badge>
                            </div>
                          )}
                          {(parsedNotes?.vehicleDistance || parsedNotes?.vehicle_distance) && (
                            <div className="p-3 bg-background/50 rounded-lg flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">فاصله خودرو از پای کار</span>
                              <Badge variant="outline" className="text-xs font-bold">
                                {parsedNotes.vehicleDistance || parsedNotes.vehicle_distance} متر
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* On Platform (boolean) */}
                    {(parsedNotes?.onPlatform !== undefined || parsedNotes?.on_platform !== undefined) && (
                      <div className="p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg flex items-center justify-between text-sm border border-purple-200 dark:border-purple-800">
                        <span className="text-purple-700 dark:text-purple-300 font-medium">روی سکو</span>
                        <Badge variant={parsedNotes.onPlatform === true || parsedNotes.on_platform === true ? 'default' : 'secondary'} className="text-xs">
                          {parsedNotes.onPlatform === true || parsedNotes.on_platform === true ? 'بله' : 'خیر'}
                        </Badge>
                      </div>
                    )}

                    {/* Scaffold Type */}
                    {parsedNotes?.scaffold_type && (
                      <div className="p-4 border rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Building className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">نوع داربست</h4>
                        </div>
                        <Badge variant="outline" className="text-sm">
                          {parsedNotes.scaffold_type}
                        </Badge>
                      </div>
                    )}

                    {/* شرایط اجرا و محل پروژه - onGround, vehicleReachesSite, conditions */}
                    {(parsedNotes?.conditions || parsedNotes?.onGround !== undefined || parsedNotes?.vehicleReachesSite !== undefined || parsedNotes?.isFacadeWidth2m !== undefined) && (
                      <div className="p-4 border rounded-xl space-y-3 bg-green-50/50 dark:bg-green-900/10">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-green-600" />
                          <h4 className="font-semibold text-green-800 dark:text-green-200">شرایط اجرا و محل پروژه</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {/* پلان اجاره */}
                          {parsedNotes?.conditions?.rentalMonthsPlan && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">پلان اجاره</span>
                              <span className="font-medium text-sm">
                                {parsedNotes.conditions.rentalMonthsPlan === '1' && 'به شرط یک ماه'}
                                {parsedNotes.conditions.rentalMonthsPlan === '2' && 'به شرط دو ماه'}
                                {parsedNotes.conditions.rentalMonthsPlan === '3+' && 'به شرط سه ماه و بیشتر'}
                              </span>
                            </div>
                          )}
                          {/* مدت قرارداد */}
                          {parsedNotes?.conditions?.totalMonths && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">مدت قرارداد</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.totalMonths} ماه</span>
                            </div>
                          )}
                          {/* فاصله از قم */}
                          {parsedNotes?.conditions?.distanceRange && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">فاصله از قم</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.distanceRange} کیلومتر</span>
                            </div>
                          )}
                          {/* محل نصب داربست - onGround */}
                          {parsedNotes?.onGround !== undefined && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">محل نصب داربست</span>
                              <Badge variant={parsedNotes.onGround ? 'default' : 'secondary'} className="text-xs">
                                {parsedNotes.onGround ? 'روی زمین' : 'روی سکو / پشت‌بام / بالکن'}
                              </Badge>
                            </div>
                          )}
                          {/* ارتفاع پای کار */}
                          {!parsedNotes?.onGround && parsedNotes?.conditions?.platformHeight && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">ارتفاع پای کار</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.platformHeight} متر</span>
                            </div>
                          )}
                          {/* ارتفاع داربست از پای کار */}
                          {!parsedNotes?.onGround && parsedNotes?.conditions?.scaffoldHeightFromPlatform && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">ارتفاع داربست از پای کار</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.scaffoldHeightFromPlatform} متر</span>
                            </div>
                          )}
                          {/* دسترسی خودرو - vehicleReachesSite */}
                          {parsedNotes?.vehicleReachesSite !== undefined && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">دسترسی خودرو</span>
                              <Badge variant={parsedNotes.vehicleReachesSite ? 'default' : 'secondary'} className="text-xs">
                                {parsedNotes.vehicleReachesSite ? 'خودرو به محل می‌رسد' : 'خودرو به محل نمی‌رسد'}
                              </Badge>
                            </div>
                          )}
                          {/* فاصله خودرو تا محل */}
                          {!parsedNotes?.vehicleReachesSite && parsedNotes?.conditions?.vehicleDistance && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">فاصله خودرو تا محل</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.vehicleDistance} متر</span>
                            </div>
                          )}
                          {/* عرض داربست نما - isFacadeWidth2m */}
                          {parsedNotes?.isFacadeWidth2m !== undefined && (
                            <div className="p-3 bg-background/50 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">عرض داربست نما</span>
                              <Badge variant="outline" className="text-xs">
                                {parsedNotes.isFacadeWidth2m ? '2 متر' : '1 متر'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Daily report row details (what you entered in this module) */}
                    <div className="p-4 border rounded-xl space-y-3 bg-muted/10">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">گزارش امروز (از گزارش روزانه)</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">اکیپ</span>
                          <p className="text-sm font-medium whitespace-pre-wrap">
                            {selectedDailyOrderRow?.team_name?.trim() || 'ثبت نشده'}
                          </p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">توضیحات</span>
                          <p className="text-sm font-medium whitespace-pre-wrap">
                            {selectedDailyOrderRow?.notes?.trim() || 'ثبت نشده'}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-muted/30 rounded-lg">
                        <span className="text-xs text-muted-foreground block mb-1">شرح فعالیت امروز</span>
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedDailyOrderRow?.activity_description?.trim() || 'ثبت نشده'}
                        </p>
                      </div>

                      {selectedDailyOrderRow?.service_details?.trim() && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">ابعاد / جزئیات خدمات</span>
                          <p className="text-sm whitespace-pre-wrap">{selectedDailyOrderRow.service_details}</p>
                        </div>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="p-4 border rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">تاریخ‌ها</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-2 bg-muted/30 rounded-lg">
                          <span className="text-xs text-muted-foreground block">تاریخ ثبت</span>
                          <p className="font-medium">{formatPersianDate(selectedOrderDetails.created_at)}</p>
                        </div>
                        {selectedOrderDetails.approved_at && (
                          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <span className="text-xs text-muted-foreground block">تاریخ تایید</span>
                            <p className="font-medium text-green-700 dark:text-green-300">{formatPersianDate(selectedOrderDetails.approved_at)}</p>
                          </div>
                        )}
                        {selectedOrderDetails.execution_start_date && (
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <span className="text-xs text-muted-foreground block">شروع اجرا</span>
                            <p className="font-medium text-blue-700 dark:text-blue-300">{formatPersianDate(selectedOrderDetails.execution_start_date)}</p>
                          </div>
                        )}
                        {selectedOrderDetails.execution_stage_updated_at && (
                          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <span className="text-xs text-muted-foreground block">آخرین تغییر مرحله</span>
                            <p className="font-medium text-amber-700 dark:text-amber-300">{formatPersianDate(selectedOrderDetails.execution_stage_updated_at)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Approvals */}
                    {selectedOrderDetails.approvals && selectedOrderDetails.approvals.length > 0 && (
                      <div className="p-4 border rounded-xl space-y-3 bg-emerald-50/50 dark:bg-emerald-900/10">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <h4 className="font-semibold">تاییدیه‌های مدیران</h4>
                        </div>
                        <div className="space-y-2">
                          {selectedOrderDetails.approvals.map((approval: any, idx: number) => {
                            const roleNames: Record<string, string> = {
                              'ceo': 'مدیرعامل',
                              'sales_manager': 'مدیر فروش',
                              'scaffold_executive_manager': 'مدیر اجرایی',
                              'general_manager': 'مدیر کل',
                              'executive_manager_scaffold_execution_with_materials': 'مدیر اجرایی داربست با اجناس',
                              'rental_executive_manager': 'مدیر کرایه داربست'
                            };
                            return (
                              <div key={idx} className="flex items-center justify-between p-2 bg-background/50 rounded-lg text-sm">
                                <span>{roleNames[approval.approver_role] || approval.approver_role}</span>
                                {approval.approved_at ? (
                                  <Badge variant="default" className="bg-emerald-500 text-white text-xs">
                                    تایید شده - {formatPersianDate(approval.approved_at)}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">در انتظار</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Payment History - Hidden in Daily Report Module */}

                    {/* Media Section */}
                    <div className="p-4 border rounded-xl space-y-4 bg-purple-50/50 dark:bg-purple-900/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-purple-600" />
                          <h4 className="font-semibold">تصاویر و ویدیوها</h4>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="file"
                            id="order-image-upload"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => handleOrderMediaUpload(e, 'image')}
                            disabled={uploadingMedia}
                          />
                          <input
                            type="file"
                            id="order-video-upload"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => handleOrderMediaUpload(e, 'video')}
                            disabled={uploadingMedia}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('order-image-upload')?.click()}
                            disabled={uploadingMedia}
                            className="gap-1"
                          >
                            {uploadingMedia ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            افزودن عکس
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('order-video-upload')?.click()}
                            disabled={uploadingMedia}
                            className="gap-1"
                          >
                            {uploadingMedia ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />}
                            افزودن ویدیو
                          </Button>
                        </div>
                      </div>

                      {/* Use centralized MediaGallery component */}
                      <MediaGallery
                        media={orderMedia.map(m => ({
                          id: m.id,
                          file_path: m.file_path,
                          file_type: m.file_type,
                          mime_type: m.mime_type,
                          url: m.url
                        } as MediaItem))}
                        layout="grid"
                        emptyMessage="هنوز تصویر یا ویدیویی برای این سفارش ثبت نشده است"
                      />
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                اطلاعاتی یافت نشد
              </div>
            )}
            
              </div>
            </div>

            <AlertDialogFooter className="sr-only">
              <AlertDialogCancel>بستن</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ModuleLayout>
  );
}
