export interface StatementFinancialOrder {
  total: number;
  paid: number;
}

/** Receipts are never capped at invoice cost; excess remains customer credit. */
export function calculateStatementTotals(orders: StatementFinancialOrder[], discount = 0) {
  const total = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const paid = orders.reduce((sum, order) => sum + (Number(order.paid) || 0), 0);
  const net = total - paid - Math.max(0, Number(discount) || 0);
  return { total, paid, remaining: Math.max(net, 0), credit: Math.max(-net, 0) };
}

export interface OrderCostSource {
  total_price?: number | string | null;
  payment_amount?: number | string | null;
  billing_only?: boolean | null;
  discount_amount?: number | string | null;
}

/**
 * Invoice cost of one order for statements. Older orders keep their price only in
 * `payment_amount` (total_price stayed at its default 0); a zero total_price is real
 * only for billing-only shells or fully discounted orders.
 */
export function orderStatementCost(order: OrderCostSource | null | undefined): number {
  if (!order) return 0;
  const total = Number(order.total_price) || 0;
  if (total > 0) return total;
  if (order.billing_only || (Number(order.discount_amount) || 0) > 0) return 0;
  return Number(order.payment_amount) || 0;
}
