/**
 * شمارنده رویدادهای مشاهده‌نشده ماژول‌ها و تب‌ها (مثل نشان عددی برنامه‌های اندروید).
 *
 * هر «نوع ماژول» چند «منبع» داده (جدول + ستون زمان) و چند «تب» دارد.
 * یک رویداد = ردیفی از منبع که بعد از آخرین بازدید کاربر از همان تب ایجاد/تغییر کرده است.
 * این فایل خالص است (بدون فراخوانی شبکه) تا قواعد شمارش قابل آزمون باشند.
 */

export type ActivityRow = Record<string, unknown> & { id?: unknown };

export interface ActivitySource {
  id: string;
  table: string;
  /** ستون زمانی که رخداد را نشان می‌دهد */
  tsColumn: string;
  /** ستون‌های لازم برای تشخیص تب (همراه id و tsColumn خوانده می‌شوند) */
  columns: string[];
  /** فیلترهای ثابت سمت سرور */
  eq?: Record<string, string | boolean>;
  notTrue?: string[];
  /** رخدادهایی که خود کاربر انجام داده شمرده نشوند */
  excludeOwnColumn?: string;
  /** محدود کردن ردیف‌ها به همین ماژول (مثلاً daily_reports.module_key) */
  moduleKeyColumn?: string;
}

export interface ActivityTabPart {
  source: string;
  match?: (row: ActivityRow) => boolean;
}

export interface ActivityTab {
  key: string;
  label: string;
  parts: ActivityTabPart[];
  /** تب‌های تجمیعی (مثل «همه سفارشات») در جمع ماژول تکراری حساب نمی‌شوند */
  aggregate?: boolean;
  group?: string;
}

export interface ActivityKind {
  id: string;
  sources: ActivitySource[];
  tabs: ActivityTab[];
}

/** تب پیش‌فرض ماژول‌هایی که تب ندارند */
export const MAIN_TAB = 'main';
/** برای تبی که هرگز باز نشده، رویدادهای این چند روز اخیر شمرده می‌شود */
export const ACTIVITY_BASELINE_DAYS = 7;
/** حداکثر بازه‌ای که برای یک تب قدیمی بررسی می‌شود */
export const ACTIVITY_MAX_LOOKBACK_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const str = (v: unknown) => (v == null ? '' : String(v));
const statusIn = (...values: string[]) => (row: ActivityRow) => values.includes(str(row.status));
const stageIn = (...values: string[]) => (row: ActivityRow) => values.includes(str(row.execution_stage));

// ---------- منابع مشترک ----------
const ORDERS_SOURCE: ActivitySource = {
  id: 'orders',
  table: 'projects_v3',
  tsColumn: 'updated_at',
  columns: ['status', 'execution_stage'],
  notTrue: ['is_archived', 'is_deep_archived'],
};
const TRANSFER_SOURCE: ActivitySource = {
  id: 'transfers',
  table: 'order_transfer_requests',
  tsColumn: 'updated_at',
  columns: ['status'],
};
const COLLAB_SOURCE: ActivitySource = {
  id: 'collaborators',
  table: 'order_collaborators',
  tsColumn: 'updated_at',
  columns: ['status'],
};

export const TRANSFER_STATUS_TABS = {
  transfer: {
    pending: ['pending_manager'],
    approved: ['manager_approved', 'pending_registration', 'pending_recipient', 'recipient_accepted', 'completed'],
    rejected: ['manager_rejected', 'recipient_rejected'],
  },
  collaborator: {
    pending: ['pending_manager'],
    approved: ['manager_approved', 'pending_registration', 'pending', 'accepted'],
    rejected: ['manager_rejected', 'rejected'],
  },
} as const;

const STATUS_LABELS: Record<string, string> = { pending: 'در انتظار تایید', approved: 'تایید شده', rejected: 'رد شده' };

export const transferTabKey = (type: 'transfer' | 'collaborator', status: string) => `${type}:${status}`;

const TRANSFER_TABS: ActivityTab[] = (['transfer', 'collaborator'] as const).flatMap((type) =>
  (Object.keys(TRANSFER_STATUS_TABS[type]) as Array<keyof typeof TRANSFER_STATUS_TABS.transfer>).map((status) => ({
    key: transferTabKey(type, status),
    label: `${type === 'transfer' ? 'انتقال سفارش' : 'همکاری در سفارش'} - ${STATUS_LABELS[status]}`,
    group: type,
    parts: [
      {
        source: type === 'transfer' ? 'transfers' : 'collaborators',
        match: statusIn(...TRANSFER_STATUS_TABS[type][status]),
      },
    ],
  })),
);

/** تب‌های مراحل سفارش در ماژول مدیریت سفارشات (کلید = بخش آخر مسیر /executive/...) */
export const EXECUTIVE_STAGE_TABS: ActivityTab[] = [
  { key: 'pending-orders', label: 'در انتظار تایید مدیران', group: 'stages', parts: [{ source: 'orders', match: statusIn('pending') }] },
  { key: 'ready', label: 'در انتظار اجرا', group: 'stages', parts: [{ source: 'orders', match: statusIn('approved', 'pending_execution', 'scheduled') }] },
  { key: 'in-progress', label: 'در حال اجرا', group: 'stages', parts: [{ source: 'orders', match: statusIn('in_progress') }] },
  { key: 'stage-order-executed', label: 'اجرا شد', group: 'stages', parts: [{ source: 'orders', match: stageIn('order_executed') }] },
  { key: 'stage-awaiting-payment', label: 'در انتظار پرداخت', group: 'stages', parts: [{ source: 'orders', match: stageIn('awaiting_payment') }] },
  { key: 'stage-awaiting-collection', label: 'در انتظار جمع‌آوری', group: 'stages', parts: [{ source: 'orders', match: stageIn('awaiting_collection', 'awaiting_payment') }] },
  { key: 'stage-in-collection', label: 'در حال جمع‌آوری', group: 'stages', parts: [{ source: 'orders', match: stageIn('in_collection') }] },
  { key: 'stage-collected', label: 'جمع‌آوری شد', group: 'stages', parts: [{ source: 'orders', match: stageIn('collected') }] },
  { key: 'completed', label: 'تکمیل سفارش', group: 'stages', parts: [{ source: 'orders', match: statusIn('completed') }] },
  { key: 'all-orders', label: 'همه سفارشات', aggregate: true, parts: [{ source: 'orders' }] },
];

export const ACTIVITY_KINDS: Record<string, ActivityKind> = {
  executive: {
    id: 'executive',
    sources: [ORDERS_SOURCE, TRANSFER_SOURCE, COLLAB_SOURCE],
    tabs: [...EXECUTIVE_STAGE_TABS, ...TRANSFER_TABS],
  },
  order_transfers: {
    id: 'order_transfers',
    sources: [TRANSFER_SOURCE, COLLAB_SOURCE],
    tabs: TRANSFER_TABS,
  },
  sms: {
    id: 'sms',
    sources: [
      { id: 'sms_logs', table: 'sms_logs', tsColumn: 'created_at', columns: ['status'] },
      { id: 'sms_queue', table: 'scheduled_sms', tsColumn: 'created_at', columns: ['state'], eq: { state: 'pending' } },
    ],
    tabs: [
      { key: 'logs', label: 'گزارش ارسال', parts: [{ source: 'sms_logs' }] },
      { key: 'queue', label: 'در انتظار ارسال', parts: [{ source: 'sms_queue' }] },
    ],
  },
  site_notifications: {
    id: 'site_notifications',
    sources: [{ id: 'site_notifications', table: 'site_notifications', tsColumn: 'created_at', columns: ['is_dismissed', 'is_important'] }],
    tabs: [
      { key: 'active', label: 'فعال', parts: [{ source: 'site_notifications', match: (r) => r.is_dismissed !== true }] },
      { key: 'important', label: 'مهم', parts: [{ source: 'site_notifications', match: (r) => r.is_important === true && r.is_dismissed !== true }] },
    ],
  },
  contractors: {
    id: 'contractors',
    sources: [
      { id: 'contractors_new', table: 'contractors', tsColumn: 'created_at', columns: ['is_approved', 'exit_requested_at'] },
      { id: 'contractor_requests', table: 'contractor_verification_requests', tsColumn: 'created_at', columns: ['status'], eq: { status: 'pending' } },
      { id: 'contractor_exits', table: 'contractors', tsColumn: 'exit_requested_at', columns: ['is_approved'] },
    ],
    tabs: [
      {
        key: 'pending',
        label: 'در انتظار تأیید',
        parts: [
          { source: 'contractors_new', match: (r) => r.is_approved !== true && !r.exit_requested_at },
          { source: 'contractor_requests' },
        ],
      },
      { key: 'exits', label: 'درخواست خروج', parts: [{ source: 'contractor_exits' }] },
    ],
  },
  daily_report: {
    id: 'daily_report',
    sources: [
      { id: 'daily_reports', table: 'daily_reports', tsColumn: 'updated_at', columns: ['is_archived'], notTrue: ['is_archived'], excludeOwnColumn: 'created_by', moduleKeyColumn: 'module_key' },
    ],
    tabs: [{ key: 'saved-reports', label: 'گزارشات ذخیره شده', parts: [{ source: 'daily_reports' }] }],
  },
  bank_cards: {
    id: 'bank_cards',
    sources: [{ id: 'bank_tx', table: 'bank_card_transactions', tsColumn: 'created_at', columns: ['transaction_type'], excludeOwnColumn: 'created_by' }],
    tabs: [{ key: 'cards', label: 'کارت‌ها', parts: [{ source: 'bank_tx' }] }],
  },
  new_users: {
    id: 'new_users',
    sources: [{ id: 'profiles', table: 'profiles', tsColumn: 'created_at', columns: [] }],
    tabs: [{ key: MAIN_TAB, label: 'کاربران جدید', parts: [{ source: 'profiles' }] }],
  },
  hr: {
    id: 'hr',
    sources: [{ id: 'hr_employees', table: 'hr_employees', tsColumn: 'created_at', columns: ['status'], excludeOwnColumn: 'created_by' }],
    tabs: [{ key: MAIN_TAB, label: 'نیروهای جدید', parts: [{ source: 'hr_employees' }] }],
  },
};

const HREF_KIND_PREFIXES: Array<[string, string]> = [
  ['/executive', 'executive'],
  ['/order-transfers-module', 'order_transfers'],
  ['/sms-management', 'sms'],
  ['/site-notifications', 'site_notifications'],
  ['/ceo/contractors-management', 'contractors'],
  ['/daily-report', 'daily_report'],
  ['/bank-cards', 'bank_cards'],
  ['/site-registration', 'new_users'],
  ['/admin/users', 'new_users'],
  ['/hr-management', 'hr'],
];

/** نوع ماژول از روی مسیر آن تشخیص داده می‌شود؛ ماژول‌های سفارشی (custom-...) هم مسیر واقعی دارند. */
export function resolveActivityKind(href: string | null | undefined): ActivityKind | null {
  if (!href) return null;
  let path = href;
  try {
    path = new URL(href, 'https://x.local').pathname;
  } catch {
    path = href.split('?')[0];
  }
  for (const [prefix, kindId] of HREF_KIND_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + '/')) return ACTIVITY_KINDS[kindId];
  }
  return null;
}

export const seenKey = (moduleKey: string, tabKey: string) => `${moduleKey}::${tabKey}`;
export type SeenMap = Record<string, string>;

/** زمانی که رویدادهای بعد از آن «دیده‌نشده» حساب می‌شوند */
export function tabSince(seen: SeenMap, moduleKey: string, tabKey: string, now: number = Date.now()): number {
  const raw = seen[seenKey(moduleKey, tabKey)];
  const parsed = raw ? Date.parse(raw) : NaN;
  const floor = now - ACTIVITY_MAX_LOOKBACK_DAYS * DAY_MS;
  if (Number.isFinite(parsed)) return Math.max(parsed, floor);
  return now - ACTIVITY_BASELINE_DAYS * DAY_MS;
}

/** کمترین زمان شروع لازم برای هر منبع (برای یک بار خواندن ردیف‌ها) */
export function sourceWindows(kind: ActivityKind, moduleKey: string, seen: SeenMap, now: number = Date.now()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tab of kind.tabs) {
    const since = tabSince(seen, moduleKey, tab.key, now);
    for (const part of tab.parts) {
      out[part.source] = out[part.source] === undefined ? since : Math.min(out[part.source], since);
    }
  }
  return out;
}

export interface ModuleActivityCounts {
  tabs: Record<string, number>;
  groups: Record<string, number>;
  total: number;
}

/**
 * شمارش رویدادهای دیده‌نشده هر تب. جمع ماژول و گروه‌ها بر اساس ردیف‌های یکتا است
 * تا سفارشی که هم در «در انتظار پرداخت» و هم در «در انتظار جمع‌آوری» دیده می‌شود دوبار شمرده نشود.
 */
export function countActivity(
  kind: ActivityKind,
  moduleKey: string,
  rowsBySource: Record<string, ActivityRow[] | undefined>,
  seen: SeenMap,
  now: number = Date.now(),
): ModuleActivityCounts {
  const tsColumnOf = new Map(kind.sources.map((s) => [s.id, s.tsColumn]));
  const tabs: Record<string, number> = {};
  const groupIds: Record<string, Set<string>> = {};
  const totalIds = new Set<string>();

  for (const tab of kind.tabs) {
    const since = tabSince(seen, moduleKey, tab.key, now);
    const ids = new Set<string>();
    for (const part of tab.parts) {
      const ts = tsColumnOf.get(part.source);
      if (!ts) continue;
      for (const row of rowsBySource[part.source] || []) {
        const when = Date.parse(str(row[ts]));
        if (!Number.isFinite(when) || when <= since) continue;
        if (part.match && !part.match(row)) continue;
        ids.add(`${part.source}:${str(row.id)}`);
      }
    }
    tabs[tab.key] = ids.size;
    if (!tab.aggregate) {
      ids.forEach((id) => totalIds.add(id));
      if (tab.group) {
        groupIds[tab.group] = groupIds[tab.group] || new Set();
        ids.forEach((id) => groupIds[tab.group!].add(id));
      }
    }
  }
  const groups: Record<string, number> = {};
  for (const [g, set] of Object.entries(groupIds)) groups[g] = set.size;
  return { tabs, groups, total: totalIds.size };
}

/** متن نشان عددی: خالی برای صفر، و «99+» برای اعداد بزرگ */
export function formatBadgeCount(n: number | null | undefined, max = 99): string {
  if (!n || n <= 0) return '';
  return n > max ? `${max}+` : String(n);
}

/** کلید تب ماژول مدیریت سفارشات از روی مسیر */
export function executiveTabFromPath(pathname: string): string | null {
  const seg = pathname.replace(/\/+$/, '').split('/')[2] || '';
  if (seg === 'orders') return 'all-orders';
  return EXECUTIVE_STAGE_TABS.some((t) => t.key === seg) ? seg : null;
}

export function hasActivityTab(kind: ActivityKind | null, tabKey: string | null | undefined): boolean {
  return !!kind && !!tabKey && kind.tabs.some((t) => t.key === tabKey);
}
