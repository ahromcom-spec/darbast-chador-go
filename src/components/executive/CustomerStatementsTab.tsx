import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronUp, FileText, Lock, Unlock, Search, User, Phone, Banknote, History, ArrowRightLeft, FileCheck, Eye, Archive, ArchiveRestore, BadgePercent, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ManagerOrderInvoice from '@/components/orders/ManagerOrderInvoice';
import { StatementInvoiceDialog } from '@/components/executive/StatementInvoiceDialog';
import { StatementManualPaymentDialog } from '@/components/executive/StatementManualPaymentDialog';
import { StatementPaymentsHistoryDialog } from '@/components/executive/StatementPaymentsHistoryDialog';
import PaymentSubmissionsReviewDialog from '@/components/payments/PaymentSubmissionsReviewDialog';
import { StatementChequesDialog } from '@/components/executive/StatementChequesDialog';
import { StatementDiscountDialog } from '@/components/executive/StatementDiscountDialog';
import { AllStatementsInvoiceDialog } from '@/components/executive/AllStatementsInvoiceDialog';
import { TransferOrderStatementDialog } from '@/components/executive/TransferOrderStatementDialog';
import { SeparateOrderChargesDialog } from '@/components/orders/SeparateOrderChargesDialog';
import { extractOrderDescription } from '@/lib/orderDescription';
import { canDeleteStatement } from '@/lib/statementDeletion';
import { calculateStatementTotals } from '@/lib/statementTotals';

interface OrderRow {
  id: string;
  code: string;
  status: string;
  total: number;
  paid: number;
  remaining: number;
  created_at: string;
  subcategory_name: string | null;
  description: string | null;
  raw: any;
}


interface Statement {
  id: string;
  statement_number: number;
  status: 'open' | 'closed';
  closed_at: string | null;
  total_amount: number;
  total_paid: number;
  total_paid_actual: number;
  overpaid: number;
  total_remaining: number;
  /** مجموع چک‌های ثبت‌شده روی این صورتحساب */
  cheque_total: number;
  /** چک‌های وصول‌شده */
  cheque_cleared: number;
  /** چک‌های در جریان (وصول‌نشده) */
  cheque_pending: number;
  /** چک‌های برگشتی */
  cheque_bounced: number;
  /** تخفیف ثبت‌شده روی این صورتحساب */
  discount_amount: number;
  discount_note: string | null;
  /** بایگانی صورتحساب */
  is_archived: boolean;
  /** بایگانی عمیق صورتحساب */
  is_deep_archived: boolean;
  archived_at: string | null;


  subcategory_name: string | null;
  address: string | null;
  detailed_address: string | null;
  addresses: string[];
  serviceTypes: string[];
  orders: OrderRow[];
  linked_order_count: number;
}

interface CustomerGroup {
  customer_id: string;
  full_name: string | null;
  phone_number: string | null;
  customer_code: string | null;
  statements: Statement[];
  total_remaining: number;
  total_amount: number;
  total_paid_actual: number;
  overpaid: number;
  cheque_total: number;
  cheque_cleared: number;
  cheque_pending: number;
  cheque_bounced: number;
  /** جمع تخفیف‌های صورتحساب‌ها */
  discount_statements: number;
  /** تخفیف کلی مشتری */
  global_discount: number;
  global_discount_note: string | null;
  /** جمع تخفیف (صورتحساب‌ها + کلی) */
  discount_total: number;
}



const formatPrice = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';

const statusLabels: Record<string, string> = {
  pending: 'در انتظار',
  pending_execution: 'در انتظار اجرا',
  approved: 'تایید شده',
  scheduled: 'زمان‌بندی',
  in_progress: 'در حال اجرا',
  pending_collection: 'در انتظار جمع‌آوری',
  in_collection: 'در حال جمع‌آوری',
  collected: 'جمع‌آوری شد',
  completed: 'تکمیل شده',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
};

interface CustomerStatementsTabProps {
  filter?: 'open' | 'closed' | 'all';
}

export function CustomerStatementsTab({ filter = 'all' }: CustomerStatementsTabProps = {}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [search, setSearch] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedStatements, setExpandedStatements] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState<Statement | null>(null);
  const [reopening, setReopening] = useState<Statement | null>(null);
  const [deleting, setDeleting] = useState<Statement | null>(null);
  const [busy, setBusy] = useState(false);
  const [payingStmt, setPayingStmt] = useState<{ statement: Statement; customer: CustomerGroup } | null>(null);
  const [historyStmt, setHistoryStmt] = useState<{ statement: Statement; customer: CustomerGroup } | null>(null);
  const [transferOrder, setTransferOrder] = useState<{ order: OrderRow; customer: CustomerGroup; currentStatementId: string } | null>(null);
  const [chequesStmt, setChequesStmt] = useState<{ statement: Statement; customer: CustomerGroup } | null>(null);
  const [globalPay, setGlobalPay] = useState<CustomerGroup | null>(null);
  const [globalHistory, setGlobalHistory] = useState<CustomerGroup | null>(null);
  const [allCheques, setAllCheques] = useState<CustomerGroup | null>(null);
  const [discountTarget, setDiscountTarget] = useState<
    { scope: 'statement'; statement: Statement; customer: CustomerGroup } | { scope: 'global'; customer: CustomerGroup } | null
  >(null);
  const [archiveView, setArchiveView] = useState<'active' | 'archived' | 'deep'>('active');
  const loadingRef = useRef(false);
  const reloadRef = useRef(false);
  const loadedRef = useRef(false);
  const mountedRef = useRef(true);


  /**
   * All invoices of a customer across every statement, ordered by statement number
   * then invoice date, so a global payment waterfalls from the lowest statement up.
   */
  const buildAllOrders = (g: CustomerGroup) => {
    const orders = g.statements
      .flatMap(s => s.orders.map(o => ({
        id: o.id,
        code: o.code,
        total: o.total,
        paid: o.paid,
        remaining: o.remaining,
        created_at: o.created_at,
        sortKey: `${String(s.statement_number).padStart(8, '0')}-${o.created_at}`,
      })))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const anchor = g.statements.find(s => s.status === 'open') || g.statements[g.statements.length - 1];
    return { orders, anchor };
  };


  const load = async () => {
    if (loadingRef.current) {
      reloadRef.current = true;
      return;
    }
    loadingRef.current = true;
    try {
      if (!loadedRef.current) setLoading(true);

      const { data: stmts, error: e1 } = await supabase
        .from('customer_statements' as any)
        .select('*')
        .order('customer_id', { ascending: true })
        .order('statement_number', { ascending: true });
      if (e1) throw e1;

      const customerIds = Array.from(new Set((stmts || []).map((s: any) => s.customer_id)));
      if (customerIds.length === 0) {
        setGroups([]);
        return;
      }

      // چک‌های ثبت‌شده روی صورتحساب‌ها (برای نمایش سهم چک از پرداختی‌ها)
      const statementIds = (stmts || []).map((s: any) => s.id);
      const { data: chequeRows } = await supabase
        .from('cheques')
        .select('statement_id, amount, status')
        .in('statement_id', statementIds);
      const chequeByStatement = new Map<string, { total: number; cleared: number; pending: number; bounced: number }>();
      for (const ch of (chequeRows || []) as any[]) {
        if (!ch.statement_id) continue;
        const cur = chequeByStatement.get(ch.statement_id) || { total: 0, cleared: 0, pending: 0, bounced: 0 };
        const amt = Number(ch.amount) || 0;
        cur.total += amt;
        if (ch.status === 'cleared') cur.cleared += amt;
        else if (ch.status === 'bounced') cur.bounced += amt;
        else cur.pending += amt;
        chequeByStatement.set(ch.statement_id, cur);
      }



      // تخفیف کلی هر مشتری
      const { data: globalDiscountRows } = await supabase
        .from('customer_global_discounts' as any)
        .select('customer_id, discount_amount, discount_note')
        .in('customer_id', customerIds);
      const globalDiscountByCustomer = new Map<string, { amount: number; note: string | null }>(
        ((globalDiscountRows || []) as any[]).map(r => [r.customer_id, { amount: Number(r.discount_amount) || 0, note: r.discount_note || null }])
      );

      const { data: customers } = await supabase
        .from('customers')
        .select('id, user_id')
        .in('id', customerIds);

      const userIds = (customers || []).map(c => c.user_id).filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number, customer_code')
        .in('user_id', userIds);

      const profileByUser = new Map((profiles || []).map(p => [p.user_id, p]));
      const customerMeta = new Map(
        (customers || []).map(c => [
          c.id,
          {
            full_name: profileByUser.get(c.user_id)?.full_name || null,
            phone_number: profileByUser.get(c.user_id)?.phone_number || null,
            customer_code: (profileByUser.get(c.user_id) as any)?.customer_code || null,
          },
        ])
      );

      const { data: orders, error: e2 } = await supabase
        .from('projects_v3')
        .select('*, subcategories(name)')
        .in('customer_id', customerIds)
        // سفارشات بایگانی شده/بایگانی عمیق هم در صورتحساب مشتری نمایش داده می‌شوند
        ;
      if (e2) throw e2;

      // group statements by customer
      const byCustomer = new Map<string, CustomerGroup>();
      for (const s of (stmts || []) as any[]) {
        const meta = customerMeta.get(s.customer_id) || { full_name: null, phone_number: null, customer_code: null };
        if (!byCustomer.has(s.customer_id)) {
          byCustomer.set(s.customer_id, {
            customer_id: s.customer_id,
            full_name: meta.full_name,
            phone_number: meta.phone_number,
            customer_code: meta.customer_code,
            statements: [],
            total_remaining: 0,
            total_amount: 0,
            total_paid_actual: 0,
            overpaid: 0,
            cheque_total: 0,
            cheque_cleared: 0,
            cheque_pending: 0,
            cheque_bounced: 0,
            discount_statements: 0,
            global_discount: globalDiscountByCustomer.get(s.customer_id)?.amount || 0,
            global_discount_note: globalDiscountByCustomer.get(s.customer_id)?.note || null,
            discount_total: 0,


          });

        }
        const myOrders: OrderRow[] = (orders || [])
          .filter((o: any) => o.statement_id === s.id && o.status !== 'rejected')
          .map((o: any) => {
            const total = Number(o.total_price ?? o.payment_amount ?? 0);
            const paid = Number(o.total_paid ?? 0);
            return {
              id: o.id,
              code: o.code,
              status: o.status || 'pending',
              total,
              paid,
              remaining: Math.max(total - paid, 0),
              created_at: o.created_at,
              subcategory_name: o.subcategories?.name || null,
              description: extractOrderDescription(o.notes),
              raw: { ...o, customer_name: meta.full_name || o.customer_name, customer_phone: meta.phone_number || o.customer_phone, customer_code: meta.customer_code },
            };
          })
          .sort((a, b) => a.created_at.localeCompare(b.created_at));

        // Rejected rows do not add costs, but existing receipts must remain visible.
        const financialOrders = (orders || [])
          .filter((o: any) => o.statement_id === s.id)
          .map((o: any) => ({ total: o.status === 'rejected' ? 0 : Number(o.total_price ?? o.payment_amount ?? 0), paid: Number(o.total_paid ?? 0) }));
        const totals = calculateStatementTotals(financialOrders, Number(s.discount_amount) || 0);
        const total_amount = totals.total;
        const total_paid = totals.paid;
        const total_paid_actual = totals.paid;


        // Helper: join address + detailed_address without duplicating when one contains the other
        const joinAddr = (a?: string | null, d?: string | null) => {
          const A = (a || '').trim();
          const D = (d || '').trim();
          if (!A && !D) return '';
          if (!A) return D;
          if (!D) return A;
          if (A === D) return A;
          if (D.includes(A)) return D;
          if (A.includes(D)) return A;
          return `${A} - ${D}`;
        };
        // Aggregate unique addresses and service types across all orders in this statement
        const addrSet = new Set<string>();
        const svcSet = new Set<string>();
        for (const o of myOrders) {
          const addr = joinAddr(o.raw?.address, o.raw?.detailed_address);
          if (addr) addrSet.add(addr);
          if (o.subcategory_name) svcSet.add(o.subcategory_name);
        }
        // Fallback to statement's stored address if no orders provide one
        if (addrSet.size === 0) {
          const stmtAddr = joinAddr(s.address, s.detailed_address);
          if (stmtAddr) addrSet.add(stmtAddr);
        }
        const addresses = Array.from(addrSet);

        const serviceTypes = Array.from(svcSet);

        const customerGroup = byCustomer.get(s.customer_id);
        if (!customerGroup) continue;
        customerGroup.statements.push({
          id: s.id,
          statement_number: s.statement_number,
          status: s.status,
          closed_at: s.closed_at,
          total_amount,
          total_paid,
          total_paid_actual,
          overpaid: totals.credit,
          total_remaining: totals.remaining,
          cheque_total: chequeByStatement.get(s.id)?.total || 0,
          cheque_cleared: chequeByStatement.get(s.id)?.cleared || 0,
          cheque_pending: chequeByStatement.get(s.id)?.pending || 0,
          cheque_bounced: chequeByStatement.get(s.id)?.bounced || 0,
          discount_amount: Number(s.discount_amount) || 0,
          discount_note: s.discount_note || null,
          is_archived: !!s.is_archived,
          is_deep_archived: !!s.is_deep_archived,
          archived_at: s.archived_at || null,



          subcategory_name: serviceTypes[0] || null,
          address: s.address || myOrders[0]?.raw?.address || null,
          detailed_address: s.detailed_address || myOrders[0]?.raw?.detailed_address || null,
          addresses,
          serviceTypes,
          orders: myOrders,
          linked_order_count: (orders || []).filter(o => o.statement_id === s.id).length,
          is_manual: !!s.is_manual,
        } as Statement & { is_manual: boolean });
      }

      const result: CustomerGroup[] = Array.from(byCustomer.values()).map(g => {
        // Hide empty auto-created statements; keep only statements with orders or those manually created by a manager.
        const visible = g.statements.filter(s => s.orders.length > 0 || s.total_paid_actual > 0 || s.cheque_total > 0 || (s as any).is_manual === true);
        const total_amount = visible.reduce((a, s) => a + s.total_amount, 0);
        const total_paid_actual = visible.reduce((a, s) => a + (s.total_paid_actual || 0), 0);
        const cheque_total = visible.reduce((a, s) => a + (s.cheque_total || 0), 0);
        const cheque_cleared = visible.reduce((a, s) => a + (s.cheque_cleared || 0), 0);
        const cheque_pending = visible.reduce((a, s) => a + (s.cheque_pending || 0), 0);
        const cheque_bounced = visible.reduce((a, s) => a + (s.cheque_bounced || 0), 0);
        const discount_statements = visible.reduce((a, s) => a + (s.discount_amount || 0), 0);
        const discount_total = discount_statements + (g.global_discount || 0);
        // مانده کل: جمع مانده صورتحساب‌ها (تخفیف هر صورتحساب لحاظ شده) منهای تخفیف کلی مشتری
        const total_remaining = Math.max(total_amount - total_paid_actual - discount_total, 0);
        return { ...g, statements: visible, total_amount, total_remaining, total_paid_actual, cheque_total, cheque_cleared, cheque_pending, cheque_bounced, discount_statements, discount_total, overpaid: Math.max(total_paid_actual + discount_total - total_amount, 0) };


      }).filter(g => g.statements.length > 0);

      result.sort((a, b) => b.total_remaining - a.total_remaining);
      if (mountedRef.current) setGroups(result);
      loadedRef.current = true;
    } catch (err) {
      console.error(err);
      toast({ title: 'خطا', description: 'بارگذاری صورتحساب‌ها با خطا مواجه شد', variant: 'destructive' });
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
      if (reloadRef.current && mountedRef.current) {
        reloadRef.current = false;
        void load();
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 400);
    };
    const channel = supabase.channel(`statement-financials-${crypto.randomUUID()}`);
    for (const table of ['projects_v3', 'customer_statements', 'order_payments', 'payment_submissions', 'cheques', 'customer_global_discounts']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    // Reconcile after reconnects and while realtime is temporarily unavailable.
    const interval = setInterval(onVisible, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mountedRef.current = false;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const matchArchive = (s: Statement) => {
      if (archiveView === 'deep') return s.is_deep_archived;
      if (archiveView === 'archived') return s.is_archived && !s.is_deep_archived;
      return !s.is_archived && !s.is_deep_archived;
    };
    let list = groups
      .map(g => ({
        ...g,
        statements: g.statements.filter(s => matchArchive(s) && (filter === 'all' || s.status === filter)),
      }))
      .filter(g => g.statements.length > 0)
      .map(g => {
        const total_amount = g.statements.reduce((a, s) => a + s.total_amount, 0);
        // تخفیف هر صورتحساب داخل total_remaining همان صورتحساب لحاظ شده؛ تخفیف کلی مشتری هم کسر می‌شود
        const discount_statements = g.statements.reduce((a, s) => a + (s.discount_amount || 0), 0);
        const discount_total = discount_statements + (g.global_discount || 0);
        const total_paid_actual = g.statements.reduce((a, s) => a + (s.total_paid_actual || 0), 0);
        const total_remaining = Math.max(total_amount - total_paid_actual - discount_total, 0);
        const cheque_total = g.statements.reduce((a, s) => a + (s.cheque_total || 0), 0);
        const cheque_cleared = g.statements.reduce((a, s) => a + (s.cheque_cleared || 0), 0);
        const cheque_pending = g.statements.reduce((a, s) => a + (s.cheque_pending || 0), 0);
        const cheque_bounced = g.statements.reduce((a, s) => a + (s.cheque_bounced || 0), 0);
        return { ...g, total_amount, total_remaining, discount_statements, discount_total, total_paid_actual, cheque_total, cheque_cleared, cheque_pending, cheque_bounced, overpaid: Math.max(total_paid_actual + discount_total - total_amount, 0) };
      });

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(g =>
      (g.full_name || '').toLowerCase().includes(q) ||
      (g.phone_number || '').includes(q)
    );
  }, [groups, search, filter, archiveView]);

  const archiveCounts = useMemo(() => {
    const all = groups.flatMap(g => g.statements);
    return {
      active: all.filter(s => !s.is_archived && !s.is_deep_archived).length,
      archived: all.filter(s => s.is_archived && !s.is_deep_archived).length,
      deep: all.filter(s => s.is_deep_archived).length,
    };
  }, [groups]);


  const toggleCustomer = (id: string) => {
    setExpandedCustomers(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleStatement = (id: string) => {
    setExpandedStatements(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleClose = async () => {
    if (!closing) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('close_customer_statement' as any, { _statement_id: closing.id });
      if (error) throw error;
      toast({ title: 'انجام شد', description: `صورتحساب شماره ${closing.statement_number} بسته شد` });
      setClosing(null);
      await load();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'خطا', description: err.message || 'بستن صورتحساب با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    if (!reopening) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('reopen_customer_statement' as any, { _statement_id: reopening.id });
      if (error) throw error;
      toast({ title: 'انجام شد', description: `صورتحساب شماره ${reopening.statement_number} مجدداً باز شد` });
      setReopening(null);
      await load();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'خطا', description: err.message || 'بازگشایی صورتحساب با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting || !canDeleteStatement(deleting.status, deleting.linked_order_count)) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('delete_empty_closed_statement', { _statement_id: deleting.id });
      if (error) throw error;
      toast({ title: 'انجام شد', description: `صورتحساب شماره ${deleting.statement_number} حذف شد` });
      setDeleting(null);
      await load();
    } catch (err: any) {
      toast({ title: 'حذف انجام نشد', description: err.message || 'حذف صورتحساب با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const setArchiveState = async (
    s: Statement,
    patch: { is_archived: boolean; is_deep_archived: boolean },
    successMessage: string,
  ) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('customer_statements' as any)
        .update({
          ...patch,
          archived_at: patch.is_archived || patch.is_deep_archived ? new Date().toISOString() : null,
        } as any)
        .eq('id', s.id);
      if (error) throw error;
      toast({ title: 'انجام شد', description: successMessage });
      await load();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'خطا', description: err.message || 'عملیات بایگانی با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };


  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجوی نام یا شماره موبایل مشتری..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {([
              { key: 'active', label: 'صورتحساب‌های فعال', count: archiveCounts.active },
              { key: 'archived', label: 'بایگانی', count: archiveCounts.archived },
              { key: 'deep', label: 'بایگانی عمیق', count: archiveCounts.deep },
            ] as const).map(t => (
              <Button
                key={t.key}
                size="sm"
                variant={archiveView === t.key ? 'default' : 'outline'}
                className="gap-1"
                onClick={() => setArchiveView(t.key)}
              >
                {t.key === 'active' ? <FileText className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {t.label}
                <span className="text-[11px] opacity-80">({new Intl.NumberFormat('fa-IR').format(t.count)})</span>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {filtered.length} مشتری دارای صورتحساب
          </p>

        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            صورتحسابی یافت نشد
          </CardContent>
        </Card>
      ) : (
        filtered.map(g => {
          const isOpen = expandedCustomers.has(g.customer_id);
          const openStmt = g.statements.find(s => s.status === 'open');
          return (
            <Collapsible key={g.customer_id} open={isOpen} onOpenChange={() => toggleCustomer(g.customer_id)}>
              <Card>
                <CollapsibleTrigger className="w-full text-right">
                  <CardHeader className="p-4 cursor-pointer hover:bg-muted/40">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {g.full_name || 'بدون نام'}
                            {g.customer_code && (
                              <span className="text-[11px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">کد: {g.customer_code}</span>
                            )}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {g.phone_number || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline">{g.statements.length} صورتحساب</Badge>
                        {openStmt && (
                          <Badge className="bg-blue-500/20 text-blue-700 border border-blue-500/40">
                            باز: شماره {new Intl.NumberFormat('fa-IR').format(openStmt.statement_number)}
                          </Badge>
                        )}
                        <span className="text-sm">کل: <b>{formatPrice(g.total_amount)}</b></span>
                        <span className="text-sm text-emerald-700">واریز کامل کارفرما: <b>{formatPrice(g.total_paid_actual)}</b></span>
                        {g.cheque_total > 0 && (
                          <span className="text-sm text-indigo-700">
                            چک: <b>{formatPrice(g.cheque_total)}</b>
                            {' '}(وصول‌شده: {formatPrice(g.cheque_cleared)} — در جریان: {formatPrice(g.cheque_pending)}
                            {g.cheque_bounced > 0 ? ` — برگشتی: ${formatPrice(g.cheque_bounced)}` : ''})
                          </span>
                        )}

                        {g.overpaid > 0 && (
                          <Badge className="bg-amber-500/20 text-amber-700 border border-amber-500/40">
                            اضافه‌پرداخت: {formatPrice(g.overpaid)}
                          </Badge>
                        )}
                        {g.discount_total > 0 && (
                          <Badge className="bg-emerald-500/20 text-emerald-800 border border-emerald-500/40">
                            تخفیف: {formatPrice(g.discount_total)}
                            {g.global_discount > 0 ? ` (کلی: ${formatPrice(g.global_discount)})` : ''}
                          </Badge>
                        )}
                        <span className="text-sm text-red-600">مانده: <b>{formatPrice(g.total_remaining)}</b></span>

                        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                            onClick={() => setGlobalPay(g)}
                            disabled={buildAllOrders(g).orders.length === 0}
                            title="ثبت پرداخت روی کل صورتحساب‌ها (از کوچک‌ترین شماره)"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            پرداخت کل صورتحساب‌ها
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setGlobalHistory(g)}
                            disabled={buildAllOrders(g).orders.length === 0}
                            title="تاریخچه و ویرایش پرداخت‌های کل صورتحساب‌ها"
                          >
                            <History className="h-3.5 w-3.5" />
                            تاریخچه پرداخت کل
                          </Button>
                          <AllStatementsInvoiceDialog
                            customerName={g.full_name}
                            customerPhone={g.phone_number}
                            customerCode={g.customer_code}
                            globalDiscount={g.global_discount}
                            globalDiscountNote={g.global_discount_note}
                            statements={g.statements.map(s => ({
                              statement_number: s.statement_number,
                              total_paid: s.total_paid_actual,
                              status: s.status,
                              addresses: s.addresses,
                              serviceTypes: s.serviceTypes,
                              discount_amount: s.discount_amount,
                              discount_note: s.discount_note,
                              cheque_total: s.cheque_total,
                              cheque_cleared: s.cheque_cleared,
                              cheque_pending: s.cheque_pending,
                              cheque_bounced: s.cheque_bounced,
                              orders: s.orders.map(o => ({
                                id: o.id,
                                code: o.code,
                                status: o.status,
                                total: o.total,
                                paid: o.paid,
                                remaining: o.remaining,
                                created_at: o.created_at,
                                subcategory_name: o.subcategory_name,
                                description: o.description,
                              })),
                            }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-50"
                            onClick={() => setAllCheques(g)}
                            title="مدیریت چک‌های همه صورتحساب‌های این مشتری"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            مدیریت چک‌های کل
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setDiscountTarget({ scope: 'global', customer: g })}
                            title="ثبت تخفیف کلی روی همه صورتحساب‌های مشتری"
                          >
                            <BadgePercent className="h-3.5 w-3.5" />
                            تخفیف کلی
                          </Button>
                        </div>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}

                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    {g.statements.map(s => {
                      const sOpen = expandedStatements.has(s.id);
                      return (
                        <Collapsible key={s.id} open={sOpen} onOpenChange={() => toggleStatement(s.id)}>
                          <Card className={s.status === 'open' ? 'border-primary/40' : ''}>
                            <CollapsibleTrigger className="w-full text-right">
                              <CardHeader className="p-3 cursor-pointer hover:bg-muted/30">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="font-semibold text-sm">
                                      صورتحساب شماره {new Intl.NumberFormat('fa-IR').format(s.statement_number)}
                                    </span>
                                    {s.status === 'open' ? (
                                      <Badge className="bg-blue-500/20 text-blue-700 border border-blue-500/40">باز</Badge>
                                    ) : (
                                      <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />بسته</Badge>
                                    )}
                                    {s.is_deep_archived ? (
                                      <Badge variant="outline" className="gap-1 border-red-400 text-red-700"><Archive className="h-3 w-3" />بایگانی عمیق</Badge>
                                    ) : s.is_archived ? (
                                      <Badge variant="outline" className="gap-1 border-slate-400 text-slate-700"><Archive className="h-3 w-3" />بایگانی</Badge>
                                    ) : null}

                                    <span className="text-xs text-muted-foreground">{s.orders.length} سفارش</span>
                                    {(s.serviceTypes.length > 0 ? s.serviceTypes : (s.subcategory_name ? [s.subcategory_name] : [])).map((svc, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">{svc}</Badge>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-3 flex-wrap text-xs">
                                    <span>کل: <b>{formatPrice(s.total_amount)}</b></span>
                                    <span className="text-green-600">پرداختی (شامل چک): {formatPrice(s.total_paid)}</span>
                                    {s.cheque_total > 0 && (
                                      <>
                                        <span className="text-indigo-700">
                                          چک: {formatPrice(s.cheque_total)}
                                          {' '}(وصول‌شده: {formatPrice(s.cheque_cleared)} — در جریان: {formatPrice(s.cheque_pending)}
                                          {s.cheque_bounced > 0 ? ` — برگشتی: ${formatPrice(s.cheque_bounced)}` : ''})
                                        </span>
                                        <span className="text-orange-700">
                                          مانده بدون احتساب چک‌های وصول‌نشده: {formatPrice(s.total_remaining + s.cheque_pending)}
                                        </span>
                                      </>
                                    )}
                                    {s.overpaid > 0 && (
                                      <span className="text-amber-700">اضافه‌پرداخت: {formatPrice(s.overpaid)}</span>
                                    )}

                                    {s.discount_amount > 0 && (
                                      <span className="text-emerald-700">تخفیف: {formatPrice(s.discount_amount)}{s.discount_note ? ` (${s.discount_note})` : ''}</span>
                                    )}

                                    <span className="text-red-600">مانده: {formatPrice(s.total_remaining)}</span>

                                    <div onClick={(e) => e.stopPropagation()} className="inline-block">
                                      <StatementInvoiceDialog
                                        statementNumber={s.statement_number}
                                        statementStatus={s.status}
                                        closedAt={s.closed_at}
                                        customerName={g.full_name}
                                        customerPhone={g.phone_number}
                                        customerCode={g.customer_code}
                                        serviceType={s.subcategory_name}
                                        serviceTypes={s.serviceTypes}
                                        address={s.address}
                                        detailedAddress={s.detailed_address}
                                        addresses={s.addresses}
                                        orders={s.orders}
                                        totalPaid={s.total_paid_actual}
                                        discountAmount={s.discount_amount}
                                        discountNote={s.discount_note}
                                      />
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()} className="inline-block">
                                      <PaymentSubmissionsReviewDialog
                                        statementId={s.id}
                                        customerName={g.full_name}
                                        onChanged={() => load()}
                                      />
                                    </div>
                                    {s.orders.length > 0 && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1"
                                        onClick={(e) => { e.stopPropagation(); setHistoryStmt({ statement: s, customer: g }); }}
                                      >
                                        <History className="h-3.5 w-3.5" />
                                        تاریخچه پرداخت‌ها
                                      </Button>
                                    )}
                                    {s.status === 'open' && s.orders.length > 0 && (
                                      <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                        onClick={(e) => { e.stopPropagation(); setPayingStmt({ statement: s, customer: g }); }}
                                      >
                                        <Banknote className="h-3.5 w-3.5" />
                                        ثبت پرداخت
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-50"
                                      onClick={(e) => { e.stopPropagation(); setChequesStmt({ statement: s, customer: g }); }}
                                    >
                                      <FileCheck className="h-3.5 w-3.5" />
                                      مدیریت چک‌ها
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                                      onClick={(e) => { e.stopPropagation(); setDiscountTarget({ scope: 'statement', statement: s, customer: g }); }}
                                    >
                                      <BadgePercent className="h-3.5 w-3.5" />
                                      {s.discount_amount > 0 ? 'ویرایش تخفیف' : 'تخفیف'}
                                    </Button>
                                    {s.status === 'open' && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={(e) => { e.stopPropagation(); setClosing(s); }}
                                      >
                                        بستن صورتحساب
                                      </Button>
                                    )}
                                    {s.status === 'closed' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 border-blue-400 text-blue-700 hover:bg-blue-50"
                                        onClick={(e) => { e.stopPropagation(); setReopening(s); }}
                                      >
                                        <Unlock className="h-3.5 w-3.5" />
                                        بازگشایی صورتحساب
                                      </Button>
                                    )}
                                    {canDeleteStatement(s.status, s.linked_order_count) && (
                                      <Button
                                        size="icon"
                                        variant="destructive"
                                        className="h-8 w-8"
                                        title="حذف صورتحساب خالی"
                                        aria-label={`حذف صورتحساب خالی شماره ${s.statement_number}`}
                                        disabled={busy}
                                        onClick={(e) => { e.stopPropagation(); setDeleting(s); }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {!s.is_archived && !s.is_deep_archived && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 border-slate-400 text-slate-700 hover:bg-slate-50"
                                        disabled={busy}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setArchiveState(s, { is_archived: true, is_deep_archived: false }, `صورتحساب شماره ${s.statement_number} بایگانی شد`);
                                        }}
                                      >
                                        <Archive className="h-3.5 w-3.5" />
                                        بایگانی
                                      </Button>
                                    )}
                                    {s.is_archived && !s.is_deep_archived && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                                          disabled={busy}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setArchiveState(s, { is_archived: false, is_deep_archived: false }, `صورتحساب شماره ${s.statement_number} از بایگانی خارج شد`);
                                          }}
                                        >
                                          <ArchiveRestore className="h-3.5 w-3.5" />
                                          خروج از بایگانی
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1 border-red-400 text-red-700 hover:bg-red-50"
                                          disabled={busy}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setArchiveState(s, { is_archived: true, is_deep_archived: true }, `صورتحساب شماره ${s.statement_number} به بایگانی عمیق منتقل شد`);
                                          }}
                                        >
                                          <Archive className="h-3.5 w-3.5" />
                                          بایگانی عمیق
                                        </Button>
                                      </>
                                    )}
                                    {s.is_deep_archived && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                                        disabled={busy}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setArchiveState(s, { is_archived: true, is_deep_archived: false }, `صورتحساب شماره ${s.statement_number} از بایگانی عمیق بازگردانده شد`);
                                        }}
                                      >
                                        <ArchiveRestore className="h-3.5 w-3.5" />
                                        بازگردانی از بایگانی عمیق
                                      </Button>
                                    )}

                                    {sOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </div>
                                </div>
                                {s.addresses.length > 0 && (
                                  <div className="mt-1 text-right space-y-0.5">
                                    {s.addresses.map((addr, idx) => (
                                      <p key={idx} className="text-xs text-muted-foreground">
                                        📍 {addr}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <CardContent className="p-0">
                                {s.orders.length === 0 ? (
                                  <div className="p-4 text-center text-sm text-muted-foreground">
                                    هنوز سفارشی ثبت نشده است
                                  </div>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-right">ردیف</TableHead>
                                        <TableHead className="text-right">کد</TableHead>
                                        <TableHead className="text-right">شرح خدمات</TableHead>
                                        <TableHead className="text-right">تاریخ</TableHead>
                                        <TableHead className="text-right">مبلغ</TableHead>
                                        <TableHead className="text-right">پرداختی</TableHead>
                                        <TableHead className="text-right">مانده</TableHead>
                                        <TableHead className="text-right">وضعیت</TableHead>
                                        <TableHead className="text-right"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {s.orders.map((o, i) => (
                                        <TableRow key={o.id}>
                                          <TableCell>{new Intl.NumberFormat('fa-IR').format(i + 1)}</TableCell>
                                          <TableCell className="font-mono text-xs">
                                            <button
                                              type="button"
                                              onClick={() => navigate(`/executive/orders?orderId=${o.id}`)}
                                              className="text-primary hover:underline cursor-pointer"
                                              title="مشاهده سفارش"
                                            >
                                              {o.code}
                                            </button>
                                          </TableCell>
                                          <TableCell className="text-xs max-w-[320px] whitespace-pre-wrap leading-6 break-words">{o.description || o.subcategory_name || '—'}</TableCell>
                                          <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString('fa-IR')}</TableCell>
                                          <TableCell>{formatPrice(o.total)}</TableCell>
                                          <TableCell className="text-green-600">{formatPrice(o.paid)}</TableCell>
                                          <TableCell className="text-red-600">{formatPrice(o.remaining)}</TableCell>
                                          <TableCell><Badge variant="outline" className="text-xs">{statusLabels[o.status] || o.status}</Badge></TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1 h-7 px-2 text-xs"
                                                title="مشاهده سفارش"
                                                onClick={() => navigate(`/executive/orders?orderId=${o.id}`)}
                                              >
                                                <Eye className="h-3.5 w-3.5" />
                                                مشاهده
                                              </Button>
                                              <ManagerOrderInvoice order={o.raw} />
                                              <SeparateOrderChargesDialog orderId={o.id} orderCode={o.code} onSuccess={load} />
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1 h-7 px-2 text-xs"
                                                title="انتقال به صورتحساب دیگر"
                                                onClick={() => setTransferOrder({ order: o, customer: g, currentStatementId: s.id })}
                                              >
                                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                                انتقال
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                    <TableFooter>
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-right font-bold">جمع صورتحساب</TableCell>
                                        <TableCell className="font-bold">{formatPrice(s.total_amount)}</TableCell>
                                        <TableCell className="font-bold text-green-600">{formatPrice(s.total_paid)}</TableCell>
                                        <TableCell className="font-bold text-red-600">{formatPrice(Math.max(s.total_amount - s.total_paid, 0))}</TableCell>
                                        <TableCell colSpan={2} />
                                      </TableRow>
                                      {s.discount_amount > 0 && (
                                        <TableRow>
                                          <TableCell colSpan={6} className="text-right font-bold text-emerald-700">
                                            تخفیف صورتحساب{s.discount_note ? ` (${s.discount_note})` : ''}
                                          </TableCell>
                                          <TableCell className="font-bold text-emerald-700">− {formatPrice(s.discount_amount)}</TableCell>
                                          <TableCell colSpan={2} />
                                        </TableRow>
                                      )}
                                      {s.discount_amount > 0 && (
                                        <TableRow>
                                          <TableCell colSpan={6} className="text-right font-bold">مانده قابل پرداخت پس از تخفیف</TableCell>
                                          <TableCell className="font-bold text-red-600">{formatPrice(s.total_remaining)}</TableCell>
                                          <TableCell colSpan={2} />
                                        </TableRow>
                                      )}
                                    </TableFooter>
                                  </Table>
                                )}
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })
      )}

      <AlertDialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بستن صورتحساب</AlertDialogTitle>
            <AlertDialogDescription>
              صورتحساب شماره {closing && new Intl.NumberFormat('fa-IR').format(closing.statement_number)} بسته خواهد شد و
              سفارشات بعدی این مشتری به‌طور خودکار وارد صورتحساب جدید (شماره بعدی) می‌شوند. در صورت نیاز می‌توانید بعداً همین صورتحساب را مجدداً باز کنید.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={busy}>
              {busy ? 'در حال بستن...' : 'تایید و بستن'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reopening} onOpenChange={(o) => !o && setReopening(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بازگشایی صورتحساب</AlertDialogTitle>
            <AlertDialogDescription>
              صورتحساب شماره {reopening && new Intl.NumberFormat('fa-IR').format(reopening.statement_number)} مجدداً باز می‌شود
              و سفارش‌های جدید این مشتری می‌توانند داخل همین صورتحساب ثبت شوند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopen} disabled={busy}>
              {busy ? 'در حال بازگشایی...' : 'تایید و بازگشایی'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف صورتحساب خالی</AlertDialogTitle>
            <AlertDialogDescription>
              صورتحساب بسته شماره {deleting && new Intl.NumberFormat('fa-IR').format(deleting.statement_number)} که هیچ سفارشی ندارد حذف شود؟ این اقدام قابل بازگردانی نیست. صورتحساب دارای چک یا سابقه درخواست پرداخت حذف نمی‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? 'در حال حذف...' : 'تایید و حذف'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {payingStmt && (
        <StatementManualPaymentDialog
          open={!!payingStmt}
          onOpenChange={(o) => !o && setPayingStmt(null)}
          statementId={payingStmt.statement.id}
          statementNumber={payingStmt.statement.statement_number}
          customerId={payingStmt.customer.customer_id}
          customerName={payingStmt.customer.full_name}
          orders={payingStmt.statement.orders.map(o => ({
            id: o.id,
            code: o.code,
            total: o.total,
            paid: o.paid,
            remaining: o.remaining,
            created_at: o.created_at,
          }))}
          discount={payingStmt.statement.discount_amount}
          onSuccess={load}
        />
      )}
      {historyStmt && (
        <StatementPaymentsHistoryDialog
          open={!!historyStmt}
          onOpenChange={(o) => !o && setHistoryStmt(null)}
          statementId={historyStmt.statement.id}
          statementNumber={historyStmt.statement.statement_number}
          customerName={historyStmt.customer.full_name}
          orders={historyStmt.statement.orders.map(o => ({
            id: o.id,
            code: o.code,
            total: o.total,
            paid: o.paid,
            remaining: o.remaining,
            created_at: o.created_at,
          }))}
          onChanged={load}
        />
      )}
      {transferOrder && (
        <TransferOrderStatementDialog
          open={!!transferOrder}
          onOpenChange={(o) => !o && setTransferOrder(null)}
          orderId={transferOrder.order.id}
          orderCode={transferOrder.order.code}
          currentStatementId={transferOrder.currentStatementId}
          customerId={transferOrder.customer.customer_id}
          customerName={transferOrder.customer.full_name}
          statements={transferOrder.customer.statements.map(s => ({
            id: s.id,
            statement_number: s.statement_number,
            status: s.status,
          }))}
          onSuccess={load}
        />
      )}
      {chequesStmt && (
        <StatementChequesDialog
          open={!!chequesStmt}
          onOpenChange={(o) => !o && setChequesStmt(null)}
          statementId={chequesStmt.statement.id}
          statementNumber={chequesStmt.statement.statement_number}
          customerName={chequesStmt.customer.full_name}
          onSuccess={load}
        />
      )}
      {allCheques && (
        <StatementChequesDialog
          open={!!allCheques}
          onOpenChange={(o) => !o && setAllCheques(null)}
          statementId={allCheques.statements[0]?.id || ''}
          statementIds={allCheques.statements.map(s => s.id)}
          statementNumber={0}
          scopeLabel="همه صورتحساب‌ها"
          customerName={allCheques.customer_id ? allCheques.full_name : null}
          onSuccess={load}
        />
      )}
      {discountTarget && (
        <StatementDiscountDialog
          open={!!discountTarget}
          onOpenChange={(o) => !o && setDiscountTarget(null)}
          scope={discountTarget.scope}
          statementId={discountTarget.scope === 'statement' ? discountTarget.statement.id : undefined}
          statementNumber={discountTarget.scope === 'statement' ? discountTarget.statement.statement_number : undefined}
          customerId={discountTarget.customer.customer_id}
          customerName={discountTarget.customer.full_name}
          currentAmount={discountTarget.scope === 'statement' ? discountTarget.statement.discount_amount : discountTarget.customer.global_discount}
          currentNote={discountTarget.scope === 'statement' ? discountTarget.statement.discount_note : discountTarget.customer.global_discount_note}
          remaining={discountTarget.scope === 'statement'
            ? discountTarget.statement.total_remaining + discountTarget.statement.discount_amount
            : discountTarget.customer.total_remaining + discountTarget.customer.global_discount}
          onSuccess={load}
        />
      )}
      {globalPay && (() => {
        const { orders, anchor } = buildAllOrders(globalPay);
        if (!anchor) return null;
        return (
          <StatementManualPaymentDialog
            open={!!globalPay}
            onOpenChange={(o) => !o && setGlobalPay(null)}
            statementId={anchor.id}
            statementNumber={anchor.statement_number}
            customerId={globalPay.customer_id}
            customerName={globalPay.full_name}
            orders={orders}
            scopeLabel={`کل صورتحساب‌ها (${new Intl.NumberFormat('fa-IR').format(globalPay.statements.length)} صورتحساب)`}
            discount={globalPay.discount_total}
            onSuccess={load}
          />
        );
      })()}
      {globalHistory && (() => {
        const { orders, anchor } = buildAllOrders(globalHistory);
        if (!anchor) return null;
        return (
          <StatementPaymentsHistoryDialog
            open={!!globalHistory}
            onOpenChange={(o) => !o && setGlobalHistory(null)}
            statementId={anchor.id}
            statementNumber={anchor.statement_number}
            customerName={globalHistory.full_name}
            orders={orders}
            scopeLabel="کل صورتحساب‌ها"
            onChanged={load}
          />
        );
      })()}

    </div>
  );
}
