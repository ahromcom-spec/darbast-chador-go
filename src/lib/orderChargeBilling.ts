import { supabase } from '@/integrations/supabase/client';
import { isBillableRepair, repairCost } from '@/lib/repairBilling';

export type BillingCharge = {
  id: string;
  kind: 'renewal' | 'repair';
  title: string;
  amount: number;
  start: string | null;
  end: string | null;
};

export const billingOwner = (row: { order_id: string; billing_order_id?: string | null }) => row.billing_order_id ?? row.order_id;

export function transferPreview(total: number, paid: number, selected: number, destinationTotal = 0, destinationPaid = 0, discount = 0) {
  const sourceTotal = Math.max(0, total - selected);
  const targetTotal = Math.max(0, destinationTotal + selected);
  return { sourceTotal, targetTotal, sourceRemaining: Math.max(0, sourceTotal - paid - discount), sourceOverpaid: Math.max(0, paid + discount - sourceTotal), targetRemaining: Math.max(0, targetTotal - destinationPaid) };
}

export async function fetchBilledExtras(orderId: string) {
  const [renewals, repairs] = await Promise.all([
    supabase.from('order_renewals').select('*').or(`billing_order_id.eq.${orderId},and(billing_order_id.is.null,order_id.eq.${orderId})`).eq('status', 'approved').order('renewal_number'),
    supabase.from('repair_requests').select('*').or(`billing_order_id.eq.${orderId},and(billing_order_id.is.null,order_id.eq.${orderId})`).order('created_at'),
  ]);
  if (renewals.error) throw renewals.error;
  if (repairs.error) throw repairs.error;
  return { renewals: renewals.data || [], repairs: (repairs.data || []).filter(isBillableRepair) };
}

export async function fetchBillingCharges(orderId: string): Promise<BillingCharge[]> {
  const { renewals, repairs } = await fetchBilledExtras(orderId);
  return [
    ...renewals.map(r => ({ id: r.id, kind: 'renewal' as const, title: `تمدید ماه ${new Intl.NumberFormat('fa-IR').format(r.renewal_number + 1)}${r.manager_notes ? ` — ${r.manager_notes}` : ''}`, amount: Number(r.renewal_price || 0), start: r.new_start_date, end: r.new_end_date })),
    ...repairs.map(r => ({ id: r.id, kind: 'repair' as const, title: `تعمیر${r.description ? ` — ${r.description}` : ''}`, amount: repairCost(r), start: r.created_at, end: null })),
  ];
}