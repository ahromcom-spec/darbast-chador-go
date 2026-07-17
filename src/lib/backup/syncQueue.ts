/**
 * Replays queued mutations against the live Supabase backend when the device
 * comes back online. Last-Write-Wins: we just send the captured request as-is.
 */
import { toast } from 'sonner';
import { listMutations, deleteMutation, updateMutation, countPending } from './offlineStore';

let syncing = false;

export interface SyncResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: { id: number; error: string }[];
}

async function getFreshAuthHeader(): Promise<string | null> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? `Bearer ${token}` : null;
  } catch {
    return null;
  }
}

export async function syncPendingMutations(opts?: { silent?: boolean }): Promise<SyncResult> {
  const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  if (syncing) return result;
  syncing = true;
  try {
    if (!navigator.onLine) return result;
    const items = await listMutations();
    if (items.length === 0) return result;

    const fresh = await getFreshAuthHeader();

    for (const m of items) {
      result.attempted++;
      try {
        const headers: Record<string, string> = { ...m.headers };
        delete headers['authorization'];
        delete headers['Authorization'];
        if (fresh) headers['Authorization'] = fresh;

        const res = await fetch(m.url, {
          method: m.method,
          headers,
          body: m.body,
        });

        if (res.ok || res.status === 204) {
          await deleteMutation(m.id!);
          result.succeeded++;
        } else {
          const text = await res.text().catch(() => '');
          await updateMutation(m.id!, {
            status: 'failed',
            lastError: `HTTP ${res.status}: ${text.slice(0, 300)}`,
            attempts: (m.attempts || 0) + 1,
          });
          result.failed++;
          result.errors.push({ id: m.id!, error: `HTTP ${res.status}` });
        }
      } catch (e: any) {
        await updateMutation(m.id!, {
          status: 'failed',
          lastError: e?.message || 'network error',
          attempts: (m.attempts || 0) + 1,
        });
        result.failed++;
        result.errors.push({ id: m.id!, error: e?.message || 'network error' });
      }
    }

    // Global user-facing notification — the user asked to be told when offline
    // work is safely replayed to the server.
    if (!opts?.silent && result.attempted > 0) {
      const faNum = (n: number) => n.toLocaleString('fa-IR');
      if (result.failed === 0 && result.succeeded > 0) {
        toast.success('اطلاعات آفلاین با موفقیت با سرور همگام‌سازی شد', {
          description: `${faNum(result.succeeded)} تغییر آفلاین ذخیره شد`,
          duration: 5000,
        });
      } else if (result.succeeded > 0 && result.failed > 0) {
        toast.warning('همگام‌سازی جزئی انجام شد', {
          description: `${faNum(result.succeeded)} موفق • ${faNum(result.failed)} ناموفق — دوباره تلاش می‌شود`,
          duration: 6000,
        });
      } else if (result.failed > 0) {
        toast.error('همگام‌سازی ناموفق بود', {
          description: `${faNum(result.failed)} تغییر آفلاین منتقل نشد. در تلاش بعدی دوباره امتحان می‌شود.`,
          duration: 6000,
        });
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('ahrom:sync-complete', { detail: result }));
    } catch {}
    return result;
  } finally {
    syncing = false;
  }
}

let installed = false;
export function installSyncListeners() {
  if (installed) return;
  installed = true;

  window.addEventListener('online', () => {
    syncPendingMutations().catch(() => {});
  });

  setTimeout(() => {
    if (navigator.onLine) {
      countPending().then((n) => {
        if (n > 0) syncPendingMutations().catch(() => {});
      });
    }
  }, 2000);

  setInterval(() => {
    if (navigator.onLine) {
      countPending().then((n) => {
        if (n > 0) syncPendingMutations().catch(() => {});
      });
    }
  }, 60_000);
}
