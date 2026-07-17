import { useEffect, useState, useCallback } from 'react';
import { countPending, listMutations, type PendingMutation } from '@/lib/backup/offlineStore';
import { syncPendingMutations, type SyncResult } from '@/lib/backup/syncQueue';

export function usePendingMutations() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<PendingMutation[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [c, l] = await Promise.all([countPending(), listMutations()]);
    setCount(c);
    setItems(l);
  }, []);

  useEffect(() => {
    refresh();
    const onAny = () => refresh();
    window.addEventListener('ahrom:mutation-queued', onAny);
    window.addEventListener('ahrom:sync-complete', onAny);
    window.addEventListener('online', onAny);
    window.addEventListener('offline', onAny);
    const t = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener('ahrom:mutation-queued', onAny);
      window.removeEventListener('ahrom:sync-complete', onAny);
      window.removeEventListener('online', onAny);
      window.removeEventListener('offline', onAny);
      clearInterval(t);
    };
  }, [refresh]);

  const sync = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true);
    try {
      const r = await syncPendingMutations();
      await refresh();
      return r;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  return { count, items, syncing, sync, refresh };
}
