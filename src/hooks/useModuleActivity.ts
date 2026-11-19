import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminImpersonating } from '@/lib/impersonation';
import {
  type ActivityKind,
  type ActivityRow,
  type ActivitySource,
  type ModuleActivityCounts,
  type SeenMap,
  countActivity,
  hasActivityTab,
  resolveActivityKind,
  seenKey,
  sourceWindows,
} from '@/lib/moduleActivity';

const SEEN_QK = (uid?: string) => ['module-activity-seen', uid] as const;
const ROWS_LIMIT = 500;
const WINDOW_ROUND_MS = 10 * 60 * 1000;
const REFRESH_MS = 60_000;

/** آخرین بازدید کاربر از هر تب هر ماژول */
export function useModuleActivitySeen() {
  const { user } = useAuth();
  return useQuery({
    queryKey: SEEN_QK(user?.id),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<SeenMap> => {
      const { data, error } = await supabase
        .from('module_activity_seen')
        .select('module_key, tab_key, seen_at')
        .eq('user_id', user!.id);
      if (error) throw error;
      const map: SeenMap = {};
      for (const r of data || []) map[seenKey(r.module_key, r.tab_key)] = r.seen_at;
      return map;
    },
  });
}

async function fetchSourceRows(source: ActivitySource, moduleKey: string, sinceIso: string, uid: string): Promise<ActivityRow[]> {
  const cols = Array.from(new Set(['id', source.tsColumn, ...source.columns])).join(',');
  // جدول‌ها پویا هستند؛ دسترسی هر کاربر توسط RLS همان جدول محدود می‌شود.
  let q: any = (supabase as any)
    .from(source.table)
    .select(cols)
    .gt(source.tsColumn, sinceIso)
    .order(source.tsColumn, { ascending: false })
    .limit(ROWS_LIMIT);
  for (const [col, value] of Object.entries(source.eq || {})) q = q.eq(col, value);
  for (const col of source.notTrue || []) q = q.not(col, 'is', true);
  if (source.moduleKeyColumn) q = q.eq(source.moduleKeyColumn, moduleKey);
  if (source.excludeOwnColumn) q = q.or(`${source.excludeOwnColumn}.is.null,${source.excludeOwnColumn}.neq.${uid}`);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ActivityRow[];
}

export interface ModuleActivityRef {
  moduleKey: string;
  href: string | null | undefined;
}

/** شمارش رویدادهای دیده‌نشده برای چند ماژول (مثلاً میانبرهای صفحه نخست) */
export function useModuleActivityCounts(modules: ModuleActivityRef[]): Record<string, ModuleActivityCounts> {
  const { user } = useAuth();
  const seenQuery = useModuleActivitySeen();
  const seen = seenQuery.data;
  const modulesKey = JSON.stringify(modules.map((m) => [m.moduleKey, m.href]));

  const resolved = useMemo(
    () =>
      modules
        .map((m) => ({ moduleKey: m.moduleKey, kind: resolveActivityKind(m.href) }))
        .filter((m): m is { moduleKey: string; kind: ActivityKind } => !!m.kind && !!m.moduleKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modulesKey],
  );

  const requests = useMemo(() => {
    if (!seen) return [];
    const now = Date.now();
    return resolved.flatMap(({ moduleKey, kind }) => {
      const windows = sourceWindows(kind, moduleKey, seen, now);
      return kind.sources
        .filter((s) => windows[s.id] !== undefined)
        .map((source) => {
          const since = Math.floor(windows[source.id] / WINDOW_ROUND_MS) * WINDOW_ROUND_MS;
          return { moduleKey, source, since };
        });
    });
  }, [resolved, seen]);

  const results = useQueries({
    queries: requests.map(({ moduleKey, source, since }) => ({
      queryKey: [
        'module-activity-rows',
        user?.id,
        source.table,
        source.id,
        source.moduleKeyColumn ? moduleKey : '*',
        since,
      ],
      enabled: !!user,
      staleTime: 30_000,
      refetchInterval: REFRESH_MS,
      refetchOnWindowFocus: true,
      queryFn: () => fetchSourceRows(source, moduleKey, new Date(since).toISOString(), user!.id),
    })),
  });

  const dataSignature = results.map((r) => r.dataUpdatedAt).join(',');

  return useMemo(() => {
    const out: Record<string, ModuleActivityCounts> = {};
    if (!seen) return out;
    const rowsByModule: Record<string, Record<string, ActivityRow[]>> = {};
    requests.forEach((req, i) => {
      const rows = results[i]?.data;
      if (!rows) return;
      rowsByModule[req.moduleKey] = rowsByModule[req.moduleKey] || {};
      rowsByModule[req.moduleKey][req.source.id] = rows;
    });
    const now = Date.now();
    for (const { moduleKey, kind } of resolved) {
      out[moduleKey] = countActivity(kind, moduleKey, rowsByModule[moduleKey] || {}, seen, now);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, seen, requests, dataSignature]);
}

/** ثبت «دیدم» برای تب فعال؛ تا وقتی تب باز و صفحه دیده می‌شود، هر ۳۰ ثانیه تمدید می‌شود. */
export function useMarkActivitySeen(moduleKey: string | null | undefined, tabKey: string | null | undefined, enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !enabled || !moduleKey || !tabKey) return;
    // مدیری که وارد حساب کاربر شده نباید رویدادهای آن کاربر را «دیده‌شده» کند
    if (isAdminImpersonating()) return;

    const mark = async () => {
      const { data, error } = await supabase.rpc('mark_module_tab_seen', {
        p_module_key: moduleKey,
        p_tab_key: tabKey,
      });
      if (error) return;
      queryClient.setQueryData<SeenMap>(SEEN_QK(user.id), (prev) => ({
        ...(prev || {}),
        [seenKey(moduleKey, tabKey)]: (data as string | null) || new Date().toISOString(),
      }));
    };
    const markIfVisible = () => {
      if (document.visibilityState === 'visible') void mark();
    };

    markIfVisible();
    const interval = window.setInterval(markIfVisible, 30_000);
    document.addEventListener('visibilitychange', markIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', markIfVisible);
      // هنگام خروج از تب، رویدادهایی که در همین مدت دیده شده‌اند هم پاک شوند
      void mark();
    };
  }, [user, enabled, moduleKey, tabKey, queryClient]);
}

const EMPTY_COUNTS: ModuleActivityCounts = { tabs: {}, groups: {}, total: 0 };

/**
 * برای استفاده داخل یک ماژول: شمارش تب‌ها + ثبت بازدید تب فعال.
 * کلید ماژول از ?moduleKey= آدرس خوانده می‌شود (همان که میانبر صفحه نخست می‌فرستد).
 */
export function useModuleTabActivity(options: { href: string; defaultModuleKey: string; activeTab?: string | null }) {
  const [searchParams] = useSearchParams();
  const moduleKey = searchParams.get('moduleKey') || options.defaultModuleKey;
  const kind = resolveActivityKind(options.href);
  const refs = useMemo(() => [{ moduleKey, href: options.href }], [moduleKey, options.href]);
  const all = useModuleActivityCounts(refs);
  useMarkActivitySeen(moduleKey, options.activeTab, hasActivityTab(kind, options.activeTab));
  return { moduleKey, kind, counts: all[moduleKey] || EMPTY_COUNTS };
}
