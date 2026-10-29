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