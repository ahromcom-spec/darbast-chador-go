/**
 * Global fetch interceptor that serves Supabase REST + Storage requests from
 * the offline backup IndexedDB when the network is unavailable.
 *
 * PostgREST emulator features:
 *   • Operators: eq, neq, gt, lt, gte, lte, like, ilike, is, in
 *   • Negation: `not.<op>.<value>` on any column
 *   • Logical OR: `or=(col.op.val,col.op.val,...)` (supports `not.` inside)
 *   • Projection: `select=col1,col2` (with alias syntax `alias:col` accepted)
 *   • Ordering: `order=col.dir.nullsfirst|nullslast` (multi-column)
 *   • Pagination: offset/limit
 *   • Single-row: `Accept: application/vnd.pgrst.object+json`
 *   • Count: `Prefer: count=exact|planned|estimated` → Content-Range header
 *
 * Large tables are streamed via IndexedDB cursor (queryTable) so we never
 * load a 16k+ row table entirely into memory.
 */
import { getMeta, getMedia, putMedia, queryTable, countTable, enqueueMutation } from './offlineStore';

const SUPABASE_URL: string = (import.meta as any).env?.VITE_SUPABASE_URL || '';

let installed = false;
let hasBackup = false;

async function refreshHasBackup() {
  try {
    const m = await getMeta();
    hasBackup = !!m;
  } catch {
    hasBackup = false;
  }
}

function jsonResponse(body: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Cache': 'ahrom-backup',
      ...extraHeaders,
    },
  });
}

function blobResponse(blob: Blob, mime: string) {
  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': mime || blob.type || 'application/octet-stream',
      'X-Offline-Cache': 'ahrom-backup',
      'Cache-Control': 'private, max-age=0',
    },
  });
}

// ==================== Predicate builder ====================

type Predicate = (row: any) => boolean;

function matchOp(v: any, op: string, arg: string): boolean {
  switch (op) {
    case 'eq':
      if (v === null || v === undefined) return String(v) === arg;
      return String(v) === arg;
    case 'neq':
      return String(v) !== arg;
    case 'gt':
      return Number(v) > Number(arg);
    case 'lt':
      return Number(v) < Number(arg);
    case 'gte':
      return Number(v) >= Number(arg);
    case 'lte':
      return Number(v) <= Number(arg);
    case 'is':
      if (arg === 'null') return v === null || v === undefined;
      if (arg === 'true') return v === true;
      if (arg === 'false') return v === false;
      return String(v) === arg;
    case 'in': {
      const inside = arg.replace(/^\(/, '').replace(/\)$/, '');
      const list = inside.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      return list.includes(String(v));
    }
    case 'like':
    case 'ilike': {
      const pat = arg.replace(/\*/g, '.*').replace(/%/g, '.*');
      const flags = op === 'ilike' ? 'i' : '';
      try {
        return new RegExp(`^${pat}$`, flags).test(String(v ?? ''));
      } catch {
        return true;
      }
    }
    default:
      return true;
  }
}

/** Parse an expression like `eq.5`, `not.is.null`, `ilike.*foo*`. */
function parseExpression(col: string, expr: string): Predicate | null {
  let negate = false;
  let rest = expr;
  if (rest.startsWith('not.')) {
    negate = true;
    rest = rest.slice(4);
  }
  const m = rest.match(/^(eq|neq|gt|lt|gte|lte|like|ilike|is|in)\.(.*)$/i);
  if (!m) return null;
  const op = m[1].toLowerCase();
  const arg = m[2];
  const base: Predicate = (row) => matchOp(row?.[col], op, arg);
  return negate ? (row) => !base(row) : base;
}

/**
 * Split a comma-separated list at the top level only — parentheses group.
 * Used for `or=(a.eq.1,b.eq.2,and(c.eq.3,d.eq.4))`.
 */
function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') { depth++; buf += ch; continue; }
    if (ch === ')') { depth--; buf += ch; continue; }
    if (ch === sep && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.length) out.push(buf);
  return out;
}

/** Parse an `or(...)` group value (without the `or=` key). Value contains outer parens. */
function parseOrGroup(value: string): Predicate | null {
  let inside = value.trim();
  if (inside.startsWith('(') && inside.endsWith(')')) {
    inside = inside.slice(1, -1);
  }
  const parts = splitTopLevel(inside, ',');
  const subs: Predicate[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Nested `and(...)` / `or(...)`
    if (/^and\s*\(/i.test(trimmed)) {
      const p = parseAndGroup(trimmed.replace(/^and/i, ''));
      if (p) subs.push(p);
      continue;
    }
    if (/^or\s*\(/i.test(trimmed)) {
      const p = parseOrGroup(trimmed.replace(/^or/i, ''));
      if (p) subs.push(p);
      continue;
    }
    // Flat `col.op.value` or `col.not.op.value`
    const dot = trimmed.indexOf('.');
    if (dot === -1) continue;
    const col = trimmed.slice(0, dot);
    const expr = trimmed.slice(dot + 1);
    const p = parseExpression(col, expr);
    if (p) subs.push(p);
  }
  if (subs.length === 0) return null;
  return (row) => subs.some((f) => f(row));
}

function parseAndGroup(value: string): Predicate | null {
  let inside = value.trim();
  if (inside.startsWith('(') && inside.endsWith(')')) {
    inside = inside.slice(1, -1);
  }
  const parts = splitTopLevel(inside, ',');
  const subs: Predicate[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^and\s*\(/i.test(trimmed)) {
      const p = parseAndGroup(trimmed.replace(/^and/i, ''));
      if (p) subs.push(p);
      continue;
    }
    if (/^or\s*\(/i.test(trimmed)) {
      const p = parseOrGroup(trimmed.replace(/^or/i, ''));
      if (p) subs.push(p);
      continue;
    }
    const dot = trimmed.indexOf('.');
    if (dot === -1) continue;
    const col = trimmed.slice(0, dot);
    const expr = trimmed.slice(dot + 1);
    const p = parseExpression(col, expr);
    if (p) subs.push(p);
  }
  if (subs.length === 0) return null;
  return (row) => subs.every((f) => f(row));
}

const RESERVED_PARAMS = new Set(['select', 'limit', 'offset', 'order', 'on_conflict', 'columns']);

/** Read a possibly dotted path (`subcategories.code`, `a.b.c`) from a row/embedded tree. */
function readPath(row: any, path: string): any {
  const segs = path.split('.');
  let cur: any = row;
  for (const s of segs) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      // Any element matching is enough — return the array of values
      cur = cur.map((el) => el?.[s]);
      continue;
    }
    cur = cur[s];
  }
  return cur;
}

/** Predicate over an embedded (dotted) column — arrays match if ANY element matches. */
function embeddedPredicate(path: string, expr: string): Predicate | null {
  const base = parseExpression('__v', expr);
  if (!base) return null;
  return (row) => {
    const v = readPath(row, path);
    if (Array.isArray(v)) return v.some((x) => base({ __v: x }));
    return base({ __v: v });
  };
}

/**
 * Build predicates from URL filters.
 * Top-level (plain column) filters run before embedding; dotted filters that
 * target embedded resources run after embedding.
 */
function buildPredicates(url: URL): { top?: Predicate; embedded?: Predicate } {
  const top: Predicate[] = [];
  const embedded: Predicate[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    if (key === 'or') {
      const p = parseOrGroup(value);
      if (p) top.push(p);
      continue;
    }
    if (key === 'and') {
      const p = parseAndGroup(value);
      if (p) top.push(p);
      continue;
    }
    if (key.includes('.')) {
      const idx = key.lastIndexOf('.');
      const p = embeddedPredicate(key.slice(0, idx) + '.' + key.slice(idx + 1), value);
      if (p) embedded.push(p);
      continue;
    }
    const p = parseExpression(key, value);
    if (p) top.push(p);
  }
  return {
    top: top.length ? (row) => top.every((f) => f(row)) : undefined,
    embedded: embedded.length ? (row) => embedded.every((f) => f(row)) : undefined,
  };
}

// ==================== Post-processing ====================

function applyOrder(rows: any[], url: URL): any[] {
  const order = url.searchParams.get('order');
  if (!order) return rows;
  const parts = order.split(',');
  return rows.slice().sort((a, b) => {
    for (const p of parts) {
      const [col, dir = 'asc', nulls] = p.split('.');
      const av = a?.[col];
      const bv = b?.[col];
      if (av === bv) continue;
      if (av === null || av === undefined) return nulls === 'nullsfirst' ? -1 : 1;
      if (bv === null || bv === undefined) return nulls === 'nullsfirst' ? 1 : -1;
      const cmp = av < bv ? -1 : 1;
      return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

function applyOffsetLimit(rows: any[], url: URL): any[] {
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const limitStr = url.searchParams.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  let out = rows;
  if (offset) out = out.slice(offset);
  if (limit !== undefined) out = out.slice(0, limit);
  return out;
}

// ==================== select= parsing (with embedded resources) ====================

interface PlainCol { key: string; source: string }
interface RelSpec {
  /** output key (alias or table name) */
  key: string;
  /** target table name */
  table: string;
  /** hint after `!` — either an FK name or a column name */
  hint?: string;
  inner: boolean;
  /** nested select string, or null for `*` */
  sub: string | null;
}
interface ParsedSelect { star: boolean; cols: PlainCol[]; rels: RelSpec[] }

function parseSelect(selectStr: string | null): ParsedSelect {
  const result: ParsedSelect = { star: false, cols: [], rels: [] };
  if (!selectStr || selectStr.trim() === '' || selectStr.trim() === '*') {
    result.star = true;
    return result;
  }
  const parts = splitTopLevel(selectStr, ',').map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (p === '*') { result.star = true; continue; }
    const open = p.indexOf('(');
    if (open !== -1 && p.endsWith(')')) {
      const head = p.slice(0, open).trim();
      const sub = p.slice(open + 1, -1).trim();
      // head forms: `table`, `alias:table`, `table!inner`, `alias:table!fk`, `table!fk!inner`
      let alias: string | undefined;
      let rest = head;
      if (rest.includes(':')) {
        const i = rest.indexOf(':');
        alias = rest.slice(0, i).trim();
        rest = rest.slice(i + 1).trim();
      }
      const bangs = rest.split('!').map((s) => s.trim()).filter(Boolean);
      const table = bangs.shift() || rest;
      const inner = bangs.includes('inner');
      const hint = bangs.find((b) => b !== 'inner' && b !== 'left');
      result.rels.push({
        key: alias || table,
        table,
        hint,
        inner,
        sub: sub === '*' || sub === '' ? null : sub,
      });
      continue;
    }
    let key = p;
    let source = p;
    if (p.includes(':')) {
      const i = p.indexOf(':');
      key = p.slice(0, i).trim();
      source = p.slice(i + 1).split('::')[0].trim();
    } else if (p.includes('::')) {
      source = p.split('::')[0].trim();
      key = source;
    }
    result.cols.push({ key, source });
  }
  return result;
}

function singularize(name: string): string {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('ses')) return name.slice(0, -2);
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
}

/** Cache related tables per request batch so a join loads each table once. */
type TableCache = Map<string, any[]>;

async function loadTable(cache: TableCache, name: string): Promise<any[]> {
  const hit = cache.get(name);
  if (hit) return hit;
  let rows: any[] = [];
  try { rows = await queryTable<any>(name); } catch { rows = []; }
  cache.set(name, rows);
  return rows;
}

/**
 * Resolve one embedded resource onto `rows` (mutates copies) and return the
 * possibly filtered row list (for `!inner`).
 */
async function embedRelation(
  parentTable: string,
  rows: any[],
  rel: RelSpec,
  cache: TableCache,
): Promise<any[]> {
  if (rows.length === 0) return rows;
  const childRows = await loadTable(cache, rel.table);
  const sample = rows[0] || {};

  // --- 1) many-to-one: find the FK column living on the parent row ---
  const candidates: string[] = [];
  if (rel.hint) {
    if (/_fkey$/.test(rel.hint)) {
      const stripped = rel.hint.replace(/_fkey$/, '');
      // pick the parent column that is a suffix of the constraint name
      for (const col of Object.keys(sample)) {
        if (col.endsWith('_id') && stripped.endsWith(col)) candidates.push(col);
      }
    } else {
      candidates.push(rel.hint);
    }
  }
  candidates.push(`${rel.key}_id`, `${rel.table}_id`, `${singularize(rel.table)}_id`, `${singularize(rel.key)}_id`);

  const fkCol = candidates.find((c) => c && Object.prototype.hasOwnProperty.call(sample, c));
  if (fkCol) {
    const byId = new Map<any, any>();
    for (const c of childRows) if (c && c.id !== undefined) byId.set(String(c.id), c);
    const out: any[] = [];
    for (const row of rows) {
      const target = row?.[fkCol] != null ? byId.get(String(row[fkCol])) ?? null : null;
      if (rel.inner && !target) continue;
      out.push({ ...row, [rel.key]: target ? projectRow(target, rel.sub) : null });
    }
    return out;
  }

  // --- 2) one-to-many: find the column on the child pointing back at us ---
  const childSample = childRows[0] || {};
  const backCandidates = [
    rel.hint,
    `${singularize(parentTable)}_id`,
    `${parentTable}_id`,
    'order_id',
    'project_id',
  ].filter(Boolean) as string[];
  const backCol = backCandidates.find((c) => Object.prototype.hasOwnProperty.call(childSample, c));
  if (!backCol) {
    // Cannot resolve — expose an empty relation instead of breaking the caller
    return rows.map((row) => ({ ...row, [rel.key]: rel.inner ? [] : [] }));
  }
  const grouped = new Map<string, any[]>();
  for (const c of childRows) {
    const k = c?.[backCol];
    if (k == null) continue;
    const key = String(k);
    const arr = grouped.get(key);
    if (arr) arr.push(c); else grouped.set(key, [c]);
  }
  const out: any[] = [];
  for (const row of rows) {
    const children = grouped.get(String(row?.id)) || [];
    if (rel.inner && children.length === 0) continue;
    out.push({ ...row, [rel.key]: children.map((c) => projectRow(c, rel.sub)) });
  }
  return out;
}

/** Project a single (already embedded) row against a nested select string. */
function projectRow(row: any, sub: string | null): any {
  if (!sub) return row;
  const parsed = parseSelect(sub);
  if (parsed.star && parsed.rels.length === 0) return row;
  const out: any = parsed.star ? { ...row } : {};
  for (const c of parsed.cols) out[c.key] = row?.[c.source] ?? null;
  // Deeper nesting is not resolved here (would need async) — keep the raw value
  for (const r of parsed.rels) out[r.key] = row?.[r.key] ?? null;
  return out;
}

/** Final projection of top-level rows (embedded keys are preserved). */
function applyProjection(rows: any[], parsed: ParsedSelect): any[] {
  if (parsed.star) return rows;
  if (parsed.cols.length === 0 && parsed.rels.length === 0) return rows;
  const relKeys = parsed.rels.map((r) => r.key);
  return rows.map((row) => {
    const out: any = {};
    for (const c of parsed.cols) out[c.key] = row?.[c.source] ?? null;
    for (const k of relKeys) out[k] = row?.[k] ?? null;
    return out;
  });
}

/** Resolve every embedded resource requested by `select=`. */
async function applyEmbeds(table: string, rows: any[], parsed: ParsedSelect): Promise<any[]> {
  if (parsed.rels.length === 0) return rows;
  const cache: TableCache = new Map();
  let current = rows;
  for (const rel of parsed.rels) {
    current = await embedRelation(table, current, rel, cache);
  }
  return current;
}

// ==================== REST + Storage handlers ====================

/**
 * RPC (PostgREST functions) — سرور در آفلاین در دسترس نیست، اما تعدادی از
 * توابع پرکاربرد را می‌توان مستقیماً از روی جدول‌های IndexedDB شبیه‌سازی کرد.
 * برای بقیه، به‌جای خطا یک پاسخ خالی امن برمی‌گردانیم تا صفحه لود شود.
 */
type RpcHandler = (args: any) => Promise<any>;

const RPC_REGISTRY: Record<string, RpcHandler> = {
  // پروژه‌های کاربر — صرفاً همه‌ی projects_v3 موجود در بکاپ را برمی‌گرداند
  get_my_projects_v3: async () => {
    try { return await queryTable<any>('projects_v3'); } catch { return []; }
  },
  // سفارشات به همراه اطلاعات مشتری — join سبک روی customers
  get_orders_with_customer_info: async () => {
    try {
      const [orders, customers] = await Promise.all([
        queryTable<any>('orders'),
        queryTable<any>('customers').catch(() => []),
      ]);
      const byId = new Map<string, any>((customers || []).map((c: any) => [c.id, c]));
      return (orders || []).map((o: any) => ({
        ...o,
        customer: byId.get(o.customer_id) || null,
      }));
    } catch { return []; }
  },
  get_sales_pending_orders: async () => {
    try {
      const rows = await queryTable<any>('orders', (r) => r?.status === 'pending' || r?.status === 'awaiting_approval');
      return rows;
    } catch { return []; }
  },
  get_public_contractors: async () => {
    try { return await queryTable<any>('contractors', (r) => r?.is_public !== false); } catch { return []; }
  },
  get_incoming_transfer_requests: async () => {
    try { return await queryTable<any>('order_transfer_requests'); } catch { return []; }
  },
  get_incoming_transfer_request_media: async () => {
    try { return await queryTable<any>('approved_media').catch(() => []); } catch { return []; }
  },
  current_user_has_password: async () => true,
  check_staff_whitelist: async (args: any) => {
    try {
      const phone = args?.p_phone || args?.phone;
      const rows = await queryTable<any>('staff_whitelist', (r) => r?.phone === phone);
      return rows.length > 0;
    } catch { return false; }
  },
  lookup_profile_by_phone: async (args: any) => {
    try {
      const phone = args?.p_phone || args?.phone;
      const rows = await queryTable<any>('profiles', (r) => r?.phone === phone);
      return rows[0] || null;
    } catch { return null; }
  },
  get_contractor_contact_info: async (args: any) => {
    try {
      const id = args?.p_contractor_id || args?.contractor_id;
      const rows = await queryTable<any>('contractors', (r) => r?.id === id);
      return rows[0] || null;
    } catch { return null; }
  },
  get_module_lock_status: async () => null,
  acquire_module_lock: async () => ({ acquired: false, reason: 'offline' }),
  refresh_module_lock: async () => ({ ok: false, reason: 'offline' }),
  release_module_lock: async () => ({ ok: true }),
  get_or_create_project: async () => null,
};

async function handleRpc(url: URL, init: RequestInit | undefined): Promise<Response> {
  const m = url.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
  if (!m) return jsonResponse(null);
  const fn = decodeURIComponent(m[1]);
  let args: any = {};
  if (init?.body) {
    try {
      const bodyStr = typeof init.body === 'string'
        ? init.body
        : new TextDecoder().decode(await new Response(init.body as any).arrayBuffer());
      args = JSON.parse(bodyStr || '{}');
    } catch { args = {}; }
  }
  const handler = RPC_REGISTRY[fn];
  if (handler) {
    try {
      const result = await handler(args);
      return jsonResponse(result ?? null, 200, { 'X-Offline-RPC': fn });
    } catch (e: any) {
      return jsonResponse(null, 200, { 'X-Offline-RPC': fn, 'X-Offline-RPC-Error': (e?.message || 'err').slice(0, 100) });
    }
  }
  // ناشناخته → پاسخ خالی امن تا UI خطا ندهد
  return jsonResponse(null, 200, { 'X-Offline-RPC': fn, 'X-Offline-RPC-Fallback': 'empty' });
}

async function handleRest(url: URL, init: RequestInit | undefined): Promise<Response | null> {
  const m = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
  if (!m) return null;
  const table = decodeURIComponent(m[1]);
  // مسیرهای rpc را جدا مدیریت کن
  if (table === 'rpc') return handleRpc(url, init);

  const method = (init?.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    // Queue mutation for later sync
    try {
      const headersObj: Record<string, string> = {};
      new Headers(init?.headers || {}).forEach((v, k) => { headersObj[k] = v; });
      const bodyStr = typeof init?.body === 'string'
        ? init!.body as string
        : init?.body
          ? new TextDecoder().decode(await new Response(init.body as any).arrayBuffer())
          : undefined;
      const id = await enqueueMutation({
        table,
        method: method as any,
        url: url.toString(),
        headers: headersObj,
        body: bodyStr,
      });
      try { window.dispatchEvent(new CustomEvent('ahrom:mutation-queued', { detail: { id, table, method } })); } catch {}

      const prefer = new Headers(init?.headers || {}).get('prefer') || '';
      const wantsRepresentation = prefer.includes('return=representation');
      let echo: any = null;
      if (wantsRepresentation && bodyStr) {
        try { echo = JSON.parse(bodyStr); } catch { echo = null; }
      }
      return jsonResponse(echo ?? [], wantsRepresentation ? 201 : 204, { 'X-Offline-Queued': String(id) });
    } catch (e: any) {
      return jsonResponse({ code: 'OFFLINE_QUEUE_FAIL', message: e?.message || 'صف آفلاین با خطا مواجه شد', details: null, hint: null }, 500);
    }
  }

  // GET path — stream via cursor with predicate, never materialise full table.
  const { top, embedded } = buildPredicates(url);
  let filtered: any[];
  try {
    filtered = await queryTable<any>(table, top);
  } catch {
    filtered = [];
  }

  const parsedSelect = parseSelect(url.searchParams.get('select'));

  // Embedded resources (joins) → embedded filters → order
  filtered = await applyEmbeds(table, filtered, parsedSelect);
  if (embedded) filtered = filtered.filter(embedded);
  filtered = applyOrder(filtered, url);

  const matched = filtered.length;

  // Pagination: PostgREST `Range` header (supabase-js `.range()`) + offset/limit params
  const headers = new Headers(init?.headers || {});
  const rangeHeader = headers.get('range') || '';
  const rangeMatch = rangeHeader.match(/^(\d+)-(\d*)$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1], 10);
    const to = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : undefined;
    filtered = filtered.slice(from, to !== undefined ? to + 1 : undefined);
  } else {
    filtered = applyOffsetLimit(filtered, url);
  }

  filtered = applyProjection(filtered, parsedSelect);

  // Single-object mode
  const accept = headers.get('accept') || '';
  if (accept.includes('vnd.pgrst.object+json')) {
    if (filtered.length === 0) {
      return jsonResponse({ code: 'PGRST116', message: 'No rows', details: null, hint: null }, 406);
    }
    return jsonResponse(filtered[0]);
  }

  // Count header — must reflect the filtered total so paginated loops terminate
  const prefer = headers.get('prefer') || '';
  const extra: Record<string, string> = {};
  if (/count=(exact|planned|estimated)/.test(prefer)) {
    extra['Content-Range'] = `0-${Math.max(0, filtered.length - 1)}/${matched}`;
  }

  return jsonResponse(filtered, 200, extra);
}

async function handleStorage(url: URL): Promise<Response | null> {
  const m = url.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public\/|authenticated\/|sign\/)?([^/]+)\/(.+)$/);
  if (!m) return null;
  const bucket = decodeURIComponent(m[1]);
  const path = decodeURIComponent(m[2]);
  const key = `${bucket}/${path}`;
  const media = await getMedia(key);
  if (!media) return new Response(null, { status: 404, headers: { 'X-Offline-Cache': 'ahrom-backup' } });
  return blobResponse(media.blob, media.mimeType);
}

// ==================== Media auto-hydration ====================

/** استخراج {bucket,path} از URL Supabase Storage. */
function parseStorageKey(url: URL): { bucket: string; path: string } | null {
  const m = url.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public\/|authenticated\/|sign\/)?([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
}

/** در حالت آنلاین، پاسخ رسانه را پس‌زمینه در IndexedDB ذخیره می‌کنیم تا آفلاین دیده شود. */
function hydrateMediaInBackground(url: URL, response: Response) {
  try {
    const parsed = parseStorageKey(url);
    if (!parsed) return;
    if (!response.ok) return;
    const ct = response.headers.get('content-type') || '';
    // فقط رسانه‌ها (عکس/فیلم/صوت/pdf)
    if (!/^(image|video|audio)\//i.test(ct) && !/pdf/i.test(ct)) return;
    // نسخه‌ی clone برای عدم مصرف body اصلی
    const clone = response.clone();
    clone.blob().then((blob) => {
      // به‌صورت پس‌زمینه رسانه را کش می‌کنیم — حتی اگر بکاپ کامل هم نباشد
      // در آفلاین از IndexedDB سرو می‌شود.
      putMedia(`${parsed.bucket}/${parsed.path}`, blob, ct).catch(() => {});
    }).catch(() => {});
  } catch {}
}

// ==================== Install ====================

export function installOfflineFetchInterceptor() {
  if (installed) return;
  installed = true;

  refreshHasBackup();
  window.addEventListener('online', refreshHasBackup);
  window.addEventListener('offline', refreshHasBackup);
  window.addEventListener('ahrom:backup-imported' as any, refreshHasBackup);

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlStr: string;
    if (typeof input === 'string') urlStr = input;
    else if (input instanceof URL) urlStr = input.toString();
    else urlStr = input.url;

    const isSupabase = SUPABASE_URL && urlStr.startsWith(SUPABASE_URL);
    if (!isSupabase) return originalFetch(input as any, init);

    const url = new URL(urlStr);

    // Auth endpoints must always hit the network
    if (url.pathname.startsWith('/auth/')) {
      return originalFetch(input as any, init);
    }

    const offline = !navigator.onLine;

    if (!offline) {
      try {
        const response = await originalFetch(input as any, init);
        // پس‌زمینه: رسانه‌های Storage را در IndexedDB ذخیره کن تا آفلاین دیده شود
        if (url.pathname.startsWith('/storage/v1/object/') || url.pathname.startsWith('/storage/v1/render/image/')) {
          hydrateMediaInBackground(url, response);
        }
        return response;
      } catch (err) {
        if (!hasBackup) throw err;
      }
    }

    // در آفلاین، حتی بدون بکاپ کامل، اگر رسانه‌ای قبلاً کش شده باشد آن را سرو کن
    if (offline && url.pathname.startsWith('/storage/v1/')) {
      try {
        const r = await handleStorage(url);
        if (r && r.status !== 404) return r;
      } catch {}
    }

    if (!hasBackup) {
      return jsonResponse(
        { code: 'OFFLINE_NO_BACKUP', message: 'آفلاین هستید و بکاپی روی این مرورگر بارگذاری نشده است', details: null, hint: null },
        503,
      );
    }

    try {
      if (url.pathname.startsWith('/rest/v1/')) {
        const r = await handleRest(url, init);
        if (r) return r;
      }
      if (url.pathname.startsWith('/storage/v1/')) {
        const r = await handleStorage(url);
        if (r) return r;
      }
      return jsonResponse(
        { code: 'OFFLINE_UNSUPPORTED', message: 'این درخواست در حالت آفلاین پشتیبانی نمی‌شود', details: url.pathname, hint: null },
        503,
      );
    } catch (e: any) {
      return jsonResponse(
        { code: 'OFFLINE_ERROR', message: e?.message || 'خطای آفلاین', details: null, hint: null },
        500,
      );
    }
  };

  console.log('[offline-fetch] interceptor installed (v2 emulator: or/not/select/cursor)');
}
