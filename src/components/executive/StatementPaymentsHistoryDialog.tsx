import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Banknote, CreditCard, History, Pencil, Trash2, Check, X, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { formatPersianDate } from '@/lib/dateUtils';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';

interface OrderLite {
  id: string;
  code: string;
  total: number;
  paid: number;
  remaining: number;
  created_at: string;
  /** Optional explicit waterfall ordering key (e.g. statement number + date) */
  sortKey?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  statementId: string;
  statementNumber: number;
  customerName: string | null;
  orders: OrderLite[];
  onChanged?: () => void;
  /** Label shown instead of "صورتحساب شماره X" (used for the all-statements history) */
  scopeLabel?: string;
}


interface PaymentRow {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  bank_card_id: string | null;
  payment_date: string | null;
  created_at: string;
}

interface ChequeInfo {
  id: string;
  serial_number: string;
  received_date: string | null;
  due_date: string | null;
  status: 'pending' | 'cleared' | 'bounced';
}

interface PaymentGroup {
  groupId: string;
  rows: PaymentRow[];
  totalAmount: number;
  paymentDate: string | null;
  bankCardId: string | null;
  receiptNumber: string | null;
  baseNote: string;
  cardTxId: string | null;
  isLegacy: boolean;
  cheque: ChequeInfo | null;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';
const GRP_RE = /\[STMT-GRP:([0-9a-fA-F-]{8,})\]/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function stripTag(s: string | null): string {
  if (!s) return '';
  return s
    .replace(/\s*\[STMT-GRP:[^\]]+\]\s*/g, '')
    .replace(/\s*\[CHEQUE:[^\]]+\]\s*/g, '')
    .replace(/\s*—\s*صورتحساب\s+\d+\s*$/g, '')
    .trim();
}

export function StatementPaymentsHistoryDialog({
  open, onOpenChange, statementId, statementNumber, customerName, orders, onChanged, scopeLabel,
}: Props) {

  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<PaymentGroup[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>(new Date().toISOString());
  const [editReceipt, setEditReceipt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<PaymentGroup | null>(null);
  const [editChequeSerial, setEditChequeSerial] = useState('');
  const [editChequeReceived, setEditChequeReceived] = useState<string>(new Date().toISOString());
  const [editChequeDue, setEditChequeDue] = useState<string>(new Date().toISOString());

  const orderById = useMemo(() => {
    const m = new Map<string, OrderLite>();
    orders.forEach(o => m.set(o.id, o));
    return m;
  }, [orders]);

  const load = async () => {
    if (orders.length === 0) { setGroups([]); return; }
    setLoading(true);
    try {
      const orderIds = orders.map(o => o.id);
      const { data: pays, error } = await supabase
        .from('order_payments')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const byGrp = new Map<string, PaymentRow[]>();
      const legacyCandidates: PaymentRow[] = [];
      const stmtNoteRe = new RegExp(`صورتحساب\\s+${statementNumber}(?!\\d)`);
      for (const p of (pays || []) as any[]) {
        const m = String(p.notes || '').match(GRP_RE);
        if (m) {
          const gid = m[1];
          if (!byGrp.has(gid)) byGrp.set(gid, []);
          byGrp.get(gid)!.push(p as PaymentRow);
        } else if (stmtNoteRe.test(String(p.notes || ''))) {
          // Legacy statement payment (pre-grouping era)
          legacyCandidates.push(p as PaymentRow);
        }
      }

      // Group legacy payments by created_at minute + payment_date + bank_card_id
      const legacyGroups = new Map<string, PaymentRow[]>();
      for (const p of legacyCandidates) {
        const minute = (p.created_at || '').slice(0, 16); // YYYY-MM-DDTHH:MM
        const key = `legacy::${minute}::${p.payment_date || ''}::${p.bank_card_id || 'none'}`;
        if (!legacyGroups.has(key)) legacyGroups.set(key, []);
        legacyGroups.get(key)!.push(p);
      }
      for (const [key, rows] of legacyGroups.entries()) {
        byGrp.set(key, rows);
      }

      // Fetch related card transactions in one go
      const taggedGroupIds = Array.from(byGrp.keys()).filter(k => !k.startsWith('legacy::'));
      let cardTxByGroup = new Map<string, string>();
      if (taggedGroupIds.length > 0) {
        const { data: txs } = await supabase
          .from('bank_card_transactions')
          .select('id, reference_id, reference_type')
          .in('reference_type', ['statement_payment', 'cheque_pending', 'cheque_cleared'])
          .in('reference_id', taggedGroupIds);
        (txs || []).forEach((t: any) => cardTxByGroup.set(t.reference_id, t.id));
      }

      // Fetch cheques for this statement and index by any matching order_payment id
      const { data: chequeRows } = await supabase
        .from('cheques')
        .select('id, serial_number, received_date, due_date, status, order_payment_ids')
        .eq('statement_id', statementId);
      const chequeByPayId = new Map<string, ChequeInfo>();
      (chequeRows || []).forEach((c: any) => {
        const info: ChequeInfo = {
          id: c.id,
          serial_number: c.serial_number,
          received_date: c.received_date,
          due_date: c.due_date,
          status: c.status,
        };
        (c.order_payment_ids || []).forEach((pid: string) => chequeByPayId.set(pid, info));
      });

      const arr: PaymentGroup[] = [];
      for (const [gid, rows] of byGrp.entries()) {
        rows.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        const first = rows[0];
        const totalAmount = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
        const isLegacy = gid.startsWith('legacy::');
        // Match cheque via any order_payment row id in the group
        let cheque: ChequeInfo | null = null;
        for (const r of rows) {
          const c = chequeByPayId.get(r.id);
          if (c) { cheque = c; break; }
        }
        arr.push({
          groupId: gid,
          rows,
          totalAmount,
          paymentDate: first.payment_date,
          bankCardId: rows.find(r => r.bank_card_id)?.bank_card_id || null,
          receiptNumber: first.receipt_number,
          baseNote: stripTag(first.notes),
          cardTxId: isLegacy ? null : (cardTxByGroup.get(gid) || null),
          isLegacy,
          cheque,
        });
      }
      arr.sort((a, b) => (b.rows[0]?.created_at || '').localeCompare(a.rows[0]?.created_at || ''));
      setGroups(arr);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'خطا', description: err?.message || 'بارگذاری پرداخت‌ها با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setEditing(null);
      load();
    }
  }, [open]);

  const startEdit = (g: PaymentGroup) => {
    setEditing(g.groupId);
    setEditAmount(String(Math.round(g.totalAmount)));
    setEditCardId(g.bankCardId);
    setEditDate(g.paymentDate || new Date().toISOString());
    setEditReceipt(g.receiptNumber || '');
    setEditNotes(g.cheque ? '' : (g.baseNote || ''));
    if (g.cheque) {
      setEditChequeSerial(g.cheque.serial_number || '');
      setEditChequeReceived(g.cheque.received_date || new Date().toISOString());
      setEditChequeDue(g.cheque.due_date || new Date().toISOString());
    } else {
      setEditChequeSerial('');
      setEditChequeReceived(new Date().toISOString());
      setEditChequeDue(new Date().toISOString());
    }
  };

  /** Recompute total_paid on the order from remaining payments, update status flags */
  const resyncOrder = async (orderId: string) => {
    const o = orderById.get(orderId);
    const { data: cur } = await supabase
      .from('projects_v3')
      .select('total_price, payment_amount, status, execution_stage, payment_confirmed_at, payment_confirmed_by')
      .eq('id', orderId)
      .maybeSingle();
    if (!cur) return;
    const total = Number((cur as any).total_price ?? (cur as any).payment_amount ?? o?.total ?? 0);
    const { data: pays } = await supabase
      .from('order_payments')
      .select('amount')
      .eq('order_id', orderId);
    const totalPaid = (pays || []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
    const fully = total > 0 && totalPaid >= total;
    const upd: Record<string, any> = {
      total_paid: totalPaid,
      updated_at: new Date().toISOString(),
    };
    if (fully) {
      if (!(cur as any).payment_confirmed_at) {
        upd.payment_confirmed_at = new Date().toISOString();
        upd.payment_confirmed_by = user?.id || null;
      }
      if ((cur as any).status !== 'closed' && (cur as any).status !== 'paid') upd.status = 'paid';
    } else {
      upd.payment_confirmed_at = null;
      upd.payment_confirmed_by = null;
      if ((cur as any).status === 'paid') upd.status = 'pending_collection';
    }
    await supabase.from('projects_v3').update(upd).eq('id', orderId);
  };

  const deleteCardTransactionsForGroup = async (groupId: string, paymentIds: string[] = []) => {
    const txIds = new Set<string>();
    const cardIds = new Set<string>();
    const addTxs = (rows: any[] | null) => {
      for (const t of rows || []) {
        if (t.id) txIds.add(t.id);
        if (t.bank_card_id) cardIds.add(t.bank_card_id);
      }
    };

    if (UUID_RE.test(groupId)) {
      const { data } = await supabase
        .from('bank_card_transactions')
        .select('id, bank_card_id')
        .in('reference_type', ['statement_payment', 'cheque_pending', 'cheque_cleared'])
        .eq('reference_id', groupId);
      addTxs(data as any[] | null);
    }

    const { data: tagged } = await supabase
      .from('bank_card_transactions')
      .select('id, bank_card_id')
      .in('reference_type', ['statement_payment', 'cheque_pending', 'cheque_cleared'])
      .ilike('description', `%STMT-GRP:${groupId}%`);
    addTxs(tagged as any[] | null);

    const validPaymentIds = paymentIds.filter(pid => UUID_RE.test(pid));
    if (validPaymentIds.length > 0) {
      const { data } = await supabase
        .from('bank_card_transactions')
        .select('id, bank_card_id')
        .eq('reference_type', 'order_payment')
        .in('reference_id', validPaymentIds);
      addTxs(data as any[] | null);
    }

    if (txIds.size > 0) {
      await supabase.from('bank_card_transactions').delete().in('id', Array.from(txIds));
    }

    return { cardIds: Array.from(cardIds) };
  };

  /** Sweep all bank_card_transactions + orphan cheque rows tied to a cheque serial within this statement.
   *  Guarantees a single source-of-truth row per cheque and removes legacy duplicates that
   *  previous edits left behind with stale STMT-GRP ids. */
  const sweepChequeArtifacts = async (serial: string, keepChequeId?: string) => {
    const result = { paymentIds: [] as string[], orderIds: [] as string[], cardIds: [] as string[] };
    if (!serial) return result;
    const { data: chRows } = await supabase
      .from('cheques')
      .select('id, transaction_id, order_payment_ids, bank_card_id')
      .eq('statement_id', statementId)
      .eq('serial_number', serial);
    const txIds = new Set<string>();
    const payIds = new Set<string>();
    const cardIds = new Set<string>();
    const chequeIdsToDelete: string[] = [];
    for (const c of (chRows || []) as any[]) {
      if (c.transaction_id) txIds.add(c.transaction_id);
      if (Array.isArray(c.order_payment_ids)) for (const p of c.order_payment_ids) p && payIds.add(p);
      if (c.bank_card_id) cardIds.add(c.bank_card_id);
      if (c.id !== keepChequeId) chequeIdsToDelete.push(c.id);
    }
    const { data: txByDesc } = await supabase
      .from('bank_card_transactions')
      .select('id, bank_card_id')
      .in('reference_type', ['cheque_pending', 'cheque_cleared'])
      .ilike('description', `%CHEQUE:${serial}%`);
    for (const t of (txByDesc || []) as any[]) {
      txIds.add(t.id);
      if (t.bank_card_id) cardIds.add(t.bank_card_id);
    }
    if (txIds.size > 0) {
      await supabase.from('bank_card_transactions').delete().in('id', Array.from(txIds));
    }
    if (payIds.size > 0) {
      const { data: pays } = await supabase
        .from('order_payments')
        .select('id, order_id')
        .in('id', Array.from(payIds));
      for (const p of (pays || []) as any[]) p.order_id && result.orderIds.push(p.order_id);
      await supabase.from('order_payments').delete().in('id', Array.from(payIds));
      result.paymentIds = Array.from(payIds);
    }
    if (chequeIdsToDelete.length > 0) {
      await supabase.from('cheques').delete().in('id', chequeIdsToDelete);
    }
    result.cardIds = Array.from(cardIds);
    return result;
  };

  /** Delete a payment group (order_payments + bank_card_transaction) */
  const deleteGroup = async (g: PaymentGroup) => {
    setSubmitting(true);
    try {
      const affectedOrderIds = new Set<string>(g.rows.map(r => r.order_id));
      const affectedCardIds = new Set<string>();
      if (g.bankCardId) affectedCardIds.add(g.bankCardId);

      // Delete every card transaction tied to this group, including orphan rows whose
      // order_payments were already removed but still carry the STMT-GRP tag.
      const deletedTxs = await deleteCardTransactionsForGroup(g.groupId, g.rows.map(r => r.id));
      deletedTxs.cardIds.forEach(id => affectedCardIds.add(id));

      // Cheque cleanup: sweep all transactions + orphan cheque rows with same serial within statement
      if (g.cheque) {
        const swept = await sweepChequeArtifacts(g.cheque.serial_number);
        swept.orderIds.forEach(id => affectedOrderIds.add(id));
        swept.cardIds.forEach(id => affectedCardIds.add(id));
      }

      // Delete order_payments rows
      await supabase
        .from('order_payments')
        .delete()
        .in('id', g.rows.map(r => r.id));

      // Resync orders + recalc cards
      for (const oid of affectedOrderIds) await resyncOrder(oid);
      for (const cid of affectedCardIds) await recalculateBankCardBalance(cid);
      if (affectedCardIds.size > 0) window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));

      toast({ title: '✓ پرداخت حذف شد', description: `مبلغ ${fmt(g.totalAmount)} حذف شد` });
      setDeletingGroup(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'خطا در حذف', description: err?.message || 'حذف با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  /** Save edits: amount/card/date/receipt/notes — re-distribute via waterfall */
  const saveEdit = async (g: PaymentGroup) => {
    const newAmount = Math.round(parseLocalizedNumber(editAmount) || 0);
    if (!newAmount || newAmount <= 0) {
      toast({ title: 'مبلغ نامعتبر', variant: 'destructive' });
      return;
    }
    if (!user?.id) return;

    const isCheque = !!g.cheque;
    if (isCheque) {
      if (!editChequeSerial.trim()) {
        toast({ title: 'شماره سریال چک الزامی است', description: 'لطفاً شماره سریال چک را وارد کنید', variant: 'destructive' });
        return;
      }
      if (!editCardId) {
        toast({ title: 'کارت بانکی الزامی است', description: 'برای ثبت چک باید یک کارت بانکی انتخاب شود', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const affectedOrderIds = new Set<string>(g.rows.map(r => r.order_id));
      const affectedCardIds = new Set<string>();
      if (g.bankCardId) affectedCardIds.add(g.bankCardId);
      if (editCardId) affectedCardIds.add(editCardId);

      // Collect ALL legacy payment ids that should be cleaned up:
      // - rows currently grouped (g.rows)
      // - any orphan ids referenced by the cheque record itself
      const legacyPaymentIds = new Set<string>(g.rows.map(r => r.id));
      if (isCheque && g.cheque && Array.isArray((g.cheque as any).order_payment_ids)) {
        for (const pid of ((g.cheque as any).order_payment_ids as string[])) {
          if (pid) legacyPaymentIds.add(pid);
        }
      }
      // Fetch order_ids of any orphan rows so we can resync those orders too
      if (legacyPaymentIds.size > 0) {
        const { data: legacyRows } = await supabase
          .from('order_payments')
          .select('id, order_id')
          .in('id', Array.from(legacyPaymentIds));
        (legacyRows || []).forEach((r: any) => { if (r.order_id) affectedOrderIds.add(r.order_id); });
      }

      // 1) Remove existing card transactions (statement_payment + cheque variants + legacy) and order_payments
      const deletedTxs = await deleteCardTransactionsForGroup(g.groupId, Array.from(legacyPaymentIds));
      deletedTxs.cardIds.forEach(id => affectedCardIds.add(id));

      if (legacyPaymentIds.size > 0) {
        await supabase
          .from('order_payments')
          .delete()
          .in('id', Array.from(legacyPaymentIds));
      }

      // 1b) For cheque edits, sweep any legacy duplicate cheque rows + their transactions tied to the same serial
      if (isCheque && g.cheque) {
        const swept = await sweepChequeArtifacts(g.cheque.serial_number, g.cheque.id);
        swept.orderIds.forEach(id => affectedOrderIds.add(id));
        swept.cardIds.forEach(id => affectedCardIds.add(id));
      }
      // Same sweep when the user is switching the cheque to a new serial
      if (isCheque && editChequeSerial && g.cheque && editChequeSerial !== g.cheque.serial_number) {
        const swept = await sweepChequeArtifacts(editChequeSerial, g.cheque.id);
        swept.orderIds.forEach(id => affectedOrderIds.add(id));
        swept.cardIds.forEach(id => affectedCardIds.add(id));
      }

      // 2) Re-resync orders before allocating, to read fresh remaining
      for (const oid of affectedOrderIds) await resyncOrder(oid);

      // 3) Re-fetch fresh orders state for waterfall
      const orderIds = orders.map(o => o.id);
      const { data: fresh } = await supabase
        .from('projects_v3')
        .select('id, code, total_price, payment_amount, total_paid, created_at')
        .in('id', orderIds);
      const sortKeyById = new Map(orders.map(o => [o.id, o.sortKey || o.created_at]));
      const list = (fresh || []).map((o: any) => {
        const total = Number(o.total_price ?? o.payment_amount ?? 0);
        const paid = Math.min(Number(o.total_paid ?? 0), total > 0 ? total : Number.MAX_SAFE_INTEGER);
        return { id: o.id, code: o.code, total, paid, remaining: Math.max(total - paid, 0), created_at: o.created_at, sortKey: sortKeyById.get(o.id) || o.created_at };
      }).sort((a, b) => (a.sortKey || '').localeCompare(b.sortKey || ''));


      // 4) Waterfall allocate
      let remaining = newAmount;
      const allocations: { orderId: string; code: string; portion: number }[] = [];
      for (let i = 0; i < list.length; i++) {
        if (remaining <= 0) break;
        const o = list[i];
        const isLast = i === list.length - 1;
        const take = isLast ? remaining : Math.min(remaining, Math.max(0, o.remaining));
        if (take > 0) {
          allocations.push({ orderId: o.id, code: o.code, portion: take });
          remaining -= take;
        }
      }
      if (allocations.length === 0 && list.length > 0) {
        allocations.push({ orderId: list[list.length - 1].id, code: list[list.length - 1].code, portion: newAmount });
      }

      // Determine effective date: cheque → due date, else → editDate
      const appliedPaymentDate = isCheque
        ? new Date(editChequeDue).toISOString()
        : (editDate ? new Date(editDate).toISOString() : new Date().toISOString());
      const appliedReportDate = appliedPaymentDate.substring(0, 10);
      const paymentMethod = isCheque ? 'cheque' : (editCardId ? 'card_transfer' : 'cash');
      const newGroupId = g.isLegacy
        ? ((crypto as any).randomUUID ? (crypto as any).randomUUID() : `grp-${Date.now()}`)
        : g.groupId;
      const groupTag = ` [STMT-GRP:${newGroupId}]`;
      const chequeTag = isCheque ? ` [CHEQUE:${editChequeSerial}]` : '';
      const chequeStatus = isCheque ? (g.cheque!.status) : null;
      const chequeStatusFa = chequeStatus === 'cleared' ? 'وصول شده' : 'وصول نشده';
      const baseNote = isCheque
        ? `چک شماره ${editChequeSerial} — سررسید ${formatPersianDate(editChequeDue, { dateFormat: 'yyyy/MM/dd' })} (${chequeStatusFa}) — صورتحساب`
        : (editNotes || (editCardId ? 'واریز به کارت بانکی (صورتحساب)' : 'پرداخت نقدی / علی‌الحساب (صورتحساب)'));
      const insertedIds: string[] = [];

      for (const a of allocations) {
        const { data: ins, error } = await supabase
          .from('order_payments')
          .insert({
            order_id: a.orderId,
            amount: a.portion,
            payment_method: paymentMethod,
            receipt_number: editReceipt || (isCheque ? editChequeSerial : null),
            notes: `${baseNote} — صورتحساب ${statementNumber}${groupTag}${chequeTag}`,
            paid_by: user.id,
            bank_card_id: null,
            payment_date: appliedPaymentDate,
            created_at: appliedPaymentDate,
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        if (ins?.id) insertedIds.push(ins.id);
        affectedOrderIds.add(a.orderId);
      }

      // 5) Recreate aggregate card transaction
      let newTxId: string | null = null;
      if (editCardId && insertedIds.length > 0) {
        const { data: card } = await supabase
          .from('bank_cards')
          .select('current_balance')
          .eq('id', editCardId)
          .single();
        if (card) {
          const newBal = Number(card.current_balance) + newAmount;
          const orderCodes = allocations.map(a => a.code).join('، ');
          const description = isCheque
            ? `${chequeStatus === 'cleared' ? '🟢 چک وصول شده است' : '🟠 چک وصول نشده است'} — سریال ${editChequeSerial} — صورتحساب ${statementNumber} - ${customerName || ''} - سفارش‌های: ${orderCodes}${chequeTag}${groupTag}`
            : `واریز صورتحساب ${statementNumber} - ${customerName || ''} - سفارش‌های: ${orderCodes}${groupTag}`;
          const referenceType = isCheque
            ? (chequeStatus === 'cleared' ? 'cheque_cleared' : 'cheque_pending')
            : 'statement_payment';
          const { data: txIns } = await supabase.from('bank_card_transactions').insert({
            bank_card_id: editCardId,
            transaction_type: 'deposit',
            amount: newAmount,
            balance_after: newBal,
            description,
            reference_type: referenceType,
            reference_id: newGroupId,
            created_by: user.id,
            report_date: appliedReportDate,
            created_at: appliedPaymentDate,
          } as any).select('id').single();
          newTxId = txIns?.id || null;
          await supabase
            .from('order_payments')
            .update({ bank_card_id: editCardId })
            .in('id', insertedIds);
        }
      }

      // 6) Update cheque record with the new data
      if (isCheque && g.cheque) {
        await supabase.from('cheques').update({
          serial_number: editChequeSerial,
          received_date: editChequeReceived,
          due_date: editChequeDue,
          amount: newAmount,
          bank_card_id: editCardId,
          transaction_id: newTxId,
          order_payment_ids: insertedIds,
          notes: editNotes || null,
          updated_at: new Date().toISOString(),
        } as any).eq('id', g.cheque.id);
      }

      // 7) Resync orders & recalc cards
      for (const oid of affectedOrderIds) await resyncOrder(oid);
      for (const cid of affectedCardIds) await recalculateBankCardBalance(cid);
      if (affectedCardIds.size > 0) window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));

      toast({ title: isCheque ? '✓ چک ویرایش شد' : '✓ پرداخت ویرایش شد', description: `مبلغ جدید: ${fmt(newAmount)}` });
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'خطا در ویرایش', description: err?.message || 'ویرایش با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              تاریخچه پرداخت‌های صورتحساب
            </DialogTitle>
            <DialogDescription>
              صورتحساب شماره {new Intl.NumberFormat('fa-IR').format(statementNumber)} — {customerName || ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">در حال بارگذاری...</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">هنوز پرداختی برای این صورتحساب ثبت نشده است</p>
            ) : (
              groups.map(g => {
                const isEditing = editing === g.groupId;
                const dateLabel = g.paymentDate
                  ? new Date(g.paymentDate).toLocaleDateString('fa-IR') + ' ' + new Date(g.paymentDate).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                  : '—';
                return (
                  <div key={g.groupId} className="border rounded-lg p-3 bg-card">
                    {!isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-emerald-600" />
                            <span className="font-bold text-emerald-700">{fmt(g.totalAmount)}</span>
                            {g.cheque ? (
                              <span className={`text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded ${g.cheque.status === 'cleared' ? 'bg-emerald-50 text-emerald-700' : g.cheque.status === 'bounced' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                <FileCheck className="h-3 w-3" /> چک {g.cheque.status === 'cleared' ? '(وصول شده)' : g.cheque.status === 'bounced' ? '(برگشتی)' : '(وصول نشده)'}
                              </span>
                            ) : g.bankCardId ? (
                              <span className="text-[11px] inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                <CreditCard className="h-3 w-3" /> کارت بانکی
                              </span>
                            ) : (
                              <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded">نقدی</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(g)} title="ویرایش">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => setDeletingGroup(g)} title="حذف">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>تاریخ: <span className="text-foreground">{dateLabel}</span></div>
                          <div>شماره رسید: <span className="text-foreground">{g.receiptNumber || '—'}</span></div>
                          <div className="col-span-2">توضیح: <span className="text-foreground">{g.baseNote || '—'}</span></div>
                          <div className="col-span-2">
                            تخصیص: {g.rows.map(r => {
                              const o = orderById.get(r.order_id);
                              return `${o?.code || '—'} (${new Intl.NumberFormat('fa-IR').format(Number(r.amount))})`;
                            }).join(' | ')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">مبلغ (تومان)</Label>
                          <Input
                            dir="ltr"
                            inputMode="numeric"
                            className="text-right mt-1 h-9"
                            value={editAmount ? new Intl.NumberFormat('fa-IR').format(Math.round(parseLocalizedNumber(editAmount) || 0)) : ''}
                            onChange={(e) => setEditAmount(e.target.value.replace(/[^\d۰-۹٠-٩]/g, ''))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">کارت بانکی</Label>
                          <div className="mt-1">
                            <BankCardSelect value={editCardId} onValueChange={setEditCardId} placeholder="بدون کارت (نقدی)" showBalance moduleKey="order_payment" />
                          </div>
                        </div>
                        {g.cheque ? (
                          <>
                            <div>
                              <Label className="text-xs">شماره سریال چک</Label>
                              <Input
                                value={editChequeSerial}
                                onChange={(e) => setEditChequeSerial(e.target.value)}
                                className="mt-1 h-9"
                                placeholder="شماره سریال روی چک"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">تاریخ تحویل گرفتن چک</Label>
                              <div className="mt-1">
                                <PersianDatePicker value={editChequeReceived} onChange={(v) => setEditChequeReceived(v || new Date().toISOString())} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">تاریخ سررسید چک</Label>
                              <div className="mt-1">
                                <PersianDatePicker value={editChequeDue} onChange={(v) => setEditChequeDue(v || new Date().toISOString())} />
                              </div>
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                تاریخ سررسید به عنوان تاریخ تراکنش کارت ثبت می‌شود و در همه پرداخت‌های مرتبط بروزرسانی خواهد شد.
                              </p>
                            </div>
                          </>
                        ) : (
                          <div>
                            <Label className="text-xs">تاریخ پرداخت</Label>
                            <div className="mt-1">
                              <PersianDatePicker value={editDate} onChange={(v) => setEditDate(v || new Date().toISOString())} />
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">شماره رسید</Label>
                            <Input value={editReceipt} onChange={(e) => setEditReceipt(e.target.value)} className="mt-1 h-9" />
                          </div>
                          <div>
                            <Label className="text-xs">توضیحات</Label>
                            <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="mt-1 h-9" />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={submitting}>
                            <X className="h-3.5 w-3.5 ml-1" /> انصراف
                          </Button>
                          <Button size="sm" onClick={() => saveEdit(g)} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Check className="h-3.5 w-3.5 ml-1" /> {submitting ? 'ذخیره...' : 'ذخیره تغییرات'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingGroup} onOpenChange={(o) => { if (!o && !submitting) setDeletingGroup(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف پرداخت</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingGroup && (
                <>پرداخت به مبلغ <b className="text-red-600">{fmt(deletingGroup.totalAmount)}</b> حذف خواهد شد و در صورت ثبت بر روی کارت بانکی، تراکنش مربوطه نیز از کارت حذف می‌شود. این عملیات غیرقابل بازگشت است.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingGroup && deleteGroup(deletingGroup)}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'در حال حذف...' : 'تایید و حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
