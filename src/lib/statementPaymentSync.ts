import { supabase } from '@/integrations/supabase/client';

/**
 * Two-way sync between bank card transactions and statement payment allocations.
 *
 * A statement payment creates:
 *  - one `bank_card_transactions` row (reference_id = STMT-GRP group id)
 *  - N `order_payments` rows (one per order the amount was allocated to),
 *    each tagged in `notes` with `[STMT-GRP:<group id>]`
 *  - optionally a `cheques` row (transaction_id = the card transaction)
 *
 * When the manager edits or deletes the *card transaction*, the allocations on
 * the individual invoices must follow. These helpers do exactly that.
 */

export const STATEMENT_TX_TYPES = ['statement_payment', 'cheque_pending', 'cheque_cleared'] as const;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const GRP_RE = /\[STMT-GRP:([0-9a-fA-F-]{8,})\]/;

export interface StatementTxLike {
  id: string;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  amount?: number | null;
}

export function isStatementTransaction(tx: StatementTxLike | null | undefined): boolean {
  if (!tx?.reference_type) return false;
  return (STATEMENT_TX_TYPES as readonly string[]).includes(tx.reference_type);
}

/** Resolve the STMT-GRP group id for a card transaction. */
function groupIdOf(tx: StatementTxLike): string | null {
  const fromDesc = String(tx.description || '').match(GRP_RE)?.[1];
  if (fromDesc) return fromDesc;
  if (tx.reference_id && UUID_RE.test(tx.reference_id)) return tx.reference_id;
  return null;
}

/** Recompute `total_paid` + payment flags of an order from its remaining payments. */
export async function resyncOrderPaidState(orderId: string, actorId?: string | null) {
  const { data: cur } = await supabase
    .from('projects_v3')
    .select('total_price, payment_amount, payment_confirmed_at')
    .eq('id', orderId)
    .maybeSingle();
  if (!cur) return;
  const total = Number((cur as any).total_price ?? (cur as any).payment_amount ?? 0);
  const { data: pays } = await supabase
    .from('order_payments')
    .select('amount')
    .eq('order_id', orderId);
  const totalPaid = (pays || []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
  const fully = total > 0 && totalPaid >= total;
  const upd: Record<string, any> = { total_paid: totalPaid, updated_at: new Date().toISOString() };
  if (fully) {
    if (!(cur as any).payment_confirmed_at) {
      upd.payment_confirmed_at = new Date().toISOString();
      upd.payment_confirmed_by = actorId || null;
    }
  } else {
    upd.payment_confirmed_at = null;
    upd.payment_confirmed_by = null;
  }
  await supabase.from('projects_v3').update(upd).eq('id', orderId);
}

/** Fetch the order_payments rows created by a statement card transaction. */
async function fetchAllocations(tx: StatementTxLike) {
  const gid = groupIdOf(tx);
  const rows = new Map<string, { id: string; order_id: string; notes: string | null; receipt_number: string | null; payment_method: string | null }>();

  if (gid) {
    const { data } = await supabase
      .from('order_payments')
      .select('id, order_id, notes, receipt_number, payment_method')
      .ilike('notes', `%STMT-GRP:${gid}%`);
    (data || []).forEach((r: any) => rows.set(r.id, r));
  }

  // Cheque fallback: the cheque row keeps the authoritative allocation ids
  const { data: cheque } = await supabase
    .from('cheques')
    .select('id, order_payment_ids')
    .eq('transaction_id', tx.id)
    .maybeSingle();
  const payIds = ((cheque as any)?.order_payment_ids || []).filter((p: string) => p && UUID_RE.test(p));
  if (payIds.length > 0) {
    const { data } = await supabase
      .from('order_payments')
      .select('id, order_id, notes, receipt_number, payment_method')
      .in('id', payIds);
    (data || []).forEach((r: any) => rows.set(r.id, r));
  }

  return { gid, rows: Array.from(rows.values()), cheque: (cheque as any) || null };
}

/**
 * Delete the invoice-level allocations belonging to a statement card transaction.
 * Call this right before (or after) deleting the transaction itself.
 */
export async function deleteStatementAllocationsForTransaction(
  tx: StatementTxLike,
  actorId?: string | null,
): Promise<{ deleted: number }> {
  if (!isStatementTransaction(tx)) return { deleted: 0 };
  const { rows, cheque } = await fetchAllocations(tx);
  if (rows.length === 0 && !cheque) return { deleted: 0 };

  const orderIds = Array.from(new Set(rows.map(r => r.order_id).filter(Boolean)));
  if (rows.length > 0) {
    await supabase.from('order_payments').delete().in('id', rows.map(r => r.id));
  }
  if (cheque?.id) {
    await supabase.from('cheques').delete().eq('id', cheque.id);
  }
  for (const oid of orderIds) await resyncOrderPaidState(oid, actorId);
  return { deleted: rows.length };
}

/**
 * Re-allocate a statement card transaction's new amount/date across the invoices
 * of the same statement (oldest invoice first), replacing the previous allocations.
 */
export async function resyncStatementAllocationsForTransaction(
  tx: StatementTxLike,
  newAmount: number,
  newDateIso: string,
  actorId?: string | null,
): Promise<{ allocated: number }> {
  if (!isStatementTransaction(tx)) return { allocated: 0 };
  const { gid, rows, cheque } = await fetchAllocations(tx);
  if (rows.length === 0) return { allocated: 0 };

  const groupId = gid || rows[0].id;
  const template = rows[0];
  const oldOrderIds = Array.from(new Set(rows.map(r => r.order_id).filter(Boolean)));

  // Determine the statement scope from any of the touched orders
  const { data: anchor } = await supabase
    .from('projects_v3')
    .select('statement_id')
    .eq('id', oldOrderIds[0])
    .maybeSingle();
  const statementId = (anchor as any)?.statement_id || null;

  // Remove old allocations first so remaining amounts are accurate
  await supabase.from('order_payments').delete().in('id', rows.map(r => r.id));
  for (const oid of oldOrderIds) await resyncOrderPaidState(oid, actorId);

  // Load the target invoices (statement scope when known, else the touched orders)
  let query = supabase
    .from('projects_v3')
    .select('id, code, total_price, payment_amount, total_paid, created_at');
  query = statementId ? query.eq('statement_id', statementId) : query.in('id', oldOrderIds);
  const { data: fresh } = await query;

  const list = (fresh || [])
    .map((o: any) => {
      const total = Number(o.total_price ?? o.payment_amount ?? 0);
      const paid = Number(o.total_paid ?? 0);
      return { id: o.id, code: o.code as string, remaining: Math.max(total - paid, 0), created_at: o.created_at as string };
    })
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

  // Waterfall the new amount
  let remaining = Math.round(newAmount);
  const allocations: { id: string; code: string; portion: number }[] = [];
  for (let i = 0; i < list.length; i++) {
    if (remaining <= 0) break;
    const o = list[i];
    const isLast = i === list.length - 1;
    const take = isLast ? remaining : Math.min(remaining, o.remaining);
    if (take > 0) {
      allocations.push({ id: o.id, code: o.code, portion: take });
      remaining -= take;
    }
  }
  if (allocations.length === 0 && list.length > 0) {
    const last = list[list.length - 1];
    allocations.push({ id: last.id, code: last.code, portion: Math.round(newAmount) });
  }

  const baseNote = String(template.notes || '').replace(/\s*\[STMT-GRP:[^\]]+\]\s*/g, ' ').trim();
  const insertedIds: string[] = [];
  for (const a of allocations) {
    const { data: ins } = await supabase
      .from('order_payments')
      .insert({
        order_id: a.id,
        amount: a.portion,
        payment_method: template.payment_method || 'cash',
        receipt_number: template.receipt_number || null,
        notes: `${baseNote} [STMT-GRP:${groupId}]`.trim(),
        paid_by: actorId || null,
        bank_card_id: null,
        payment_date: newDateIso,
        created_at: newDateIso,
      } as any)
      .select('id')
      .single();
    if (ins?.id) insertedIds.push(ins.id);
  }

  // Keep the card link + cheque record in sync
  const { data: txRow } = await supabase
    .from('bank_card_transactions')
    .select('bank_card_id')
    .eq('id', tx.id)
    .maybeSingle();
  if ((txRow as any)?.bank_card_id && insertedIds.length > 0) {
    await supabase
      .from('order_payments')
      .update({ bank_card_id: (txRow as any).bank_card_id })
      .in('id', insertedIds);
  }
  if (cheque?.id) {
    await supabase
      .from('cheques')
      .update({ amount: Math.round(newAmount), order_payment_ids: insertedIds, updated_at: new Date().toISOString() } as any)
      .eq('id', cheque.id);
  }

  const touched = new Set<string>([...oldOrderIds, ...allocations.map(a => a.id)]);
  for (const oid of touched) await resyncOrderPaidState(oid, actorId);

  return { allocated: allocations.length };
}
