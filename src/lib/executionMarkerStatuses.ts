interface MarkerOrder {
  id: string;
  status: string;
  execution_stage?: string | null;
  is_archived?: boolean | null;
  is_deep_archived?: boolean | null;
}

export function executionMarkerStatuses(orders: readonly MarkerOrder[]) {
  const counts = { pending: 0, pending_execution: 0, awaiting_collection: 0 };
  const seen = new Set<string>();
  for (const order of orders) {
    if (seen.has(order.id) || order.is_archived || order.is_deep_archived || order.status === 'rejected') continue;
    seen.add(order.id);
    if (order.status === 'pending') counts.pending++;
    else if (order.execution_stage === 'awaiting_collection') counts.awaiting_collection++;
    else if (!order.execution_stage && ['approved', 'pending_execution'].includes(order.status)) counts.pending_execution++;
  }
  return counts;
}