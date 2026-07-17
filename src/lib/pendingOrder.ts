// Helper for persisting an in-progress guest order so we can return to the
// same form after the user logs in / registers.

const KEY = 'pendingOrderReturn';

export interface PendingOrderReturn {
  /** Route path of the form (e.g. /scaffolding/rental-form) */
  path: string;
  /** Navigation state required by the form (locationId, subcategoryId, ...) */
  state: any;
  /** Unique key per form type, used to scope value restore */
  formKey: 'rental' | 'scaffolding';
  /** Snapshot of form values / UI state to rehydrate */
  values?: Record<string, any>;
  ts: number;
}

export function savePendingOrder(data: PendingOrderReturn) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.error('savePendingOrder failed', err);
  }
}

export function getPendingOrder(): PendingOrderReturn | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingOrderReturn) : null;
  } catch {
    return null;
  }
}

export function clearPendingOrder() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
