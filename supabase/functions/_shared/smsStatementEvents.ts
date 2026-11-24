// رویدادهای صورتحساب (ثبت پرداخت، تخفیف، بستن) برای قاب‌های پیام سفارشی.
// متن‌ها فقط از داده واقعی پایگاه داده ساخته می‌شوند؛ این فایل بین سرور و آزمون‌ها مشترک است.
import { eventMoney } from "./smsOrderEvents.ts";

export type StatementEventKind = "payment" | "discount" | "closed";
export const STATEMENT_EVENT_STAGE: Record<StatementEventKind, string> = {
  payment: "statement_payment",
  discount: "statement_discount",
  closed: "statement_closed",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدی",
  card_transfer: "کارت به کارت",
  cheque: "چک",
  online: "پرداخت آنلاین",
  zarinpal: "پرداخت آنلاین",
};
export const paymentMethodLabel = (m?: string | null) => PAYMENT_METHOD_LABELS[String(m || "")] || "نقدی";

export interface AllocationRow {
  orderCode: string;
  statementNumber?: number | null;
  amount: number;
}

const faNum = (n: number) => Math.round(n).toLocaleString("fa-IR");

/** «سفارش 1000539 (صورتحساب ۳): ۸٬۰۰۰٬۰۰۰ تومان، ...» — هر سفارش یک بار و به ترتیب تخصیص */
export function formatAllocation(rows: AllocationRow[]): string {
  const merged = new Map<string, AllocationRow>();
  for (const r of rows) {
    const k = `${r.orderCode}|${r.statementNumber ?? ""}`;
    const cur = merged.get(k);
    if (cur) cur.amount += Number(r.amount) || 0;
    else merged.set(k, { ...r, amount: Number(r.amount) || 0 });
  }
  return [...merged.values()]
    .filter((r) => r.amount > 0)
    .map((r) => `سفارش ${r.orderCode}${r.statementNumber ? ` (صورتحساب ${faNum(r.statementNumber)})` : ""}: ${eventMoney(r.amount)}`)
    .join("، ");
}

export interface StatementOrderLite {
  status?: string | null;
  total_price?: number | string | null;
  payment_amount?: number | string | null;
  billing_only?: boolean | null;
  discount_amount?: number | string | null;
}

/** همان قاعده `orderStatementCost`: total_price، وگرنه payment_amount (جز سفارش فقط‌صورتحساب/تخفیف‌دار) */
export function statementOrderCost(o: StatementOrderLite): number {
  if (o.status === "rejected") return 0;
  const total = Number(o.total_price) || 0;
  if (total > 0) return total;
  if (o.billing_only || Number(o.discount_amount) > 0) return 0;
  return Number(o.payment_amount) || 0;
}

export function statementSummary(orders: StatementOrderLite[], paid: number, discount: number) {
  const total = orders.reduce((a, o) => a + statementOrderCost(o), 0);
  return { total, paid, discount, remaining: Math.max(total - paid - discount, 0) };
}
