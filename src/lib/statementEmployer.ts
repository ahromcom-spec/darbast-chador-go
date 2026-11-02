export interface StatementEmployer {
  name: string;
  phone: string;
  overridden: boolean;
}

interface EmployerOrder {
  raw?: { notes?: unknown };
}

export function orderStatementEmployer(order: EmployerOrder, customerName: string | null, customerPhone: string | null): StatementEmployer {
  let notes = order.raw?.notes;
  if (typeof notes === 'string') {
    try { notes = JSON.parse(notes); } catch { notes = null; }
  }
  const override = notes && typeof notes === 'object' && 'invoice_override' in notes
    ? notes.invoice_override : null;
  const name = override && typeof override === 'object' && 'employer_name' in override && typeof override.employer_name === 'string'
    ? override.employer_name.trim() : '';
  const phone = override && typeof override === 'object' && 'employer_phone' in override && typeof override.employer_phone === 'string'
    ? override.employer_phone.trim() : '';
  return { name: name || customerName || '', phone: name && phone ? phone : customerPhone || '', overridden: Boolean(name) };
}

export function statementEmployers(orders: EmployerOrder[], customerName: string | null, customerPhone: string | null) {
  const employers = orders.map(order => orderStatementEmployer(order, customerName, customerPhone));
  if (!employers.length) employers.push({ name: customerName || '', phone: customerPhone || '', overridden: false });
  return {
    name: [...new Set(employers.map(e => e.name).filter(Boolean))].join(' / '),
    phone: [...new Set(employers.map(e => e.phone).filter(Boolean))].join(' / '),
    overridden: employers.some(e => e.overridden),
    multiple: new Set(employers.map(e => `${e.name}\u0000${e.phone}`)).size > 1,
  };
}