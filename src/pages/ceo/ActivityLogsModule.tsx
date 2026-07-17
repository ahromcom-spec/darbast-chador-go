import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader } from '@/components/common/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { Activity, Mail, Plus, Trash2, Pencil, Filter, RefreshCw, Eye, Users, ChevronDown, Boxes } from 'lucide-react';
import { formatPersianDateTimeFull, formatPersianDate } from '@/lib/dateUtils';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';

// Convert any YYYY-MM-DD occurrences inside a string to Jalali (yyyy/MM/dd)
function toJalaliDateOnly(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    // Construct a noon-UTC date to avoid tz drift
    const dt = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
    return formatPersianDate(dt, { dateFormat: 'yyyy/MM/dd' });
  } catch {
    return iso;
  }
}
function jalaliizeDates(text: string | null | undefined): string {
  if (!text) return text || '';
  return text.replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (m) => toJalaliDateOnly(m));
}

// Friendly Persian module names
const MODULE_LABELS: Record<string, string> = {
  daily_report: 'گزارش روزانه شرکت اهرم',
  daily_report_executive: 'گزارش روزانه اجرایی اهرم',
  daily_report_management: 'گزارش روزانه مدیریت اهرم',
  daily_report_support: 'گزارش روزانه پشتیبانی اهرم',
  daily_report_full: 'گزارش روزانه کلی اهرم',
  daily_report_all: 'گزارش روزانه کلی اهرم',
  daily_report_total: 'گزارش روزانه کلی اهرم',
  activity_logs: 'لاگ فعالیت‌ها',
  bank_cards: 'کارت‌های بانکی',
  hr_employees: 'پرسنل (منابع انسانی)',
  orders: 'سفارش‌ها',
  module_management: 'مدیریت ماژول‌ها',
  ceo_management: 'مدیریت کل (مدیرعامل)',
};
// Runtime registry of custom module key -> friendly Persian name,
// populated from `module_hierarchy_states` so user-created modules
// (e.g. "custom-1769657272050") show their real name.
const CUSTOM_MODULE_NAMES: Record<string, string> = {};
function friendlyModule(name: string | null | undefined): string {
  if (!name) return '—';
  if (MODULE_LABELS[name]) return MODULE_LABELS[name];
  if (CUSTOM_MODULE_NAMES[name]) return CUSTOM_MODULE_NAMES[name];
  // Strip ugly auto-generated "custom-<timestamp>" prefix
  if (/^custom-\d+$/.test(name)) return 'ماژول سفارشی';
  return name;
}

// Short summary (one line) for list view
function buildShortSummary(l: {
  action: string;
  details?: any;
}): string {
  const changes = Array.isArray(l.details?.changes) ? l.details.changes : null;
  if (changes && changes.length) {
    return `${changes.length.toLocaleString('fa-IR')} تغییر ثبت شد`;
  }
  if (l.action === 'insert') return 'ثبت رکورد جدید';
  if (l.action === 'delete') return 'حذف رکورد';
  if (l.action === 'login') return 'ورود به سایت';
  if (l.action === 'update') return 'ویرایش';
  return '';
}

// Full friendly description (used in dialog)
function buildFriendlyDescription(l: {
  action: string;
  event_type?: string | null;
  module_name?: string | null;
  entity_table?: string | null;
  title?: string | null;
  actor_name?: string | null;
  details?: any;
  diff?: any;
}): string {
  const who = l.actor_name || 'یک کاربر';
  const mod = l.module_name ? ` در ماژول «${friendlyModule(l.module_name)}»` : (l.entity_table ? ` در جدول «${l.entity_table}»` : '');
  const note = (l.details && (l.details.note || l.details.message || l.details.description)) || '';
  const title = jalaliizeDates(l.title || l.event_type || '');
  if (l.action === 'login' || /login|ورود/i.test(l.event_type || '')) {
    return `${who} وارد سایت شد${note ? ` (${note})` : ''}.`;
  }
  if (/pricing|قیمت/i.test(l.event_type || '') || l.event_type === 'assistant_pricing') {
    const q = l.details?.query || l.details?.question;
    return `${who} از دستیار اهرم درخواست قیمت کرد${q ? `: «${q}»` : ''}.`;
  }
  if (/order/i.test(l.entity_table || '') || /سفارش/.test(l.module_name || '')) {
    if (l.action === 'insert') return `${who} یک سفارش جدید ثبت کرد${title ? ` — ${title}` : ''}.`;
    if (l.action === 'update') return `${who} سفارش را ویرایش کرد${title ? ` — ${title}` : ''}.`;
    if (l.action === 'delete') return `${who} یک سفارش را حذف کرد${title ? ` — ${title}` : ''}.`;
  }

  const actionWord =
    l.action === 'insert' ? 'یک رکورد جدید ثبت کرد' :
    l.action === 'update' ? 'تغییراتی اعمال کرد' :
    l.action === 'delete' ? 'یک رکورد را حذف کرد' :
    l.action === 'event' ? 'یک رویداد ثبت کرد' :
    'فعالیتی انجام داد';

  let extra = '';
  const changes = Array.isArray(l.details?.changes) ? l.details.changes : null;
  if (l.action !== 'login' && changes && changes.length) {
    const parts = changes.slice(0, 3).map((c: any) => {
      const lbl = c.label || c.field;
      const hasOld = c?.old !== null && c?.old !== undefined && String(c.old).length > 0;
      const hasNew = c?.new !== null && c?.new !== undefined && String(c.new).length > 0;
      const truncate = (v: any) => {
        const s = String(v ?? '');
        return s.length > 40 ? s.slice(0, 40) + '…' : s;
      };
      if (!hasOld && hasNew) return `${lbl}: «${truncate(c.new)}»`;
      if (hasOld && !hasNew) return `${lbl}: حذف «${truncate(c.old)}»`;
      return `${lbl}: «${truncate(c.old)}» ← «${truncate(c.new)}»`;
    });
    extra = ` — ${parts.join(' ، ')}${changes.length > 3 ? ` و ${changes.length - 3} تغییر دیگر` : ''}`;
  } else if (l.action === 'update' && l.diff && typeof l.diff === 'object' && !Array.isArray(l.diff)) {
    const keys = Object.keys(l.diff).slice(0, 3);
    if (keys.length) extra = ` (تغییر در: ${keys.join('، ')})`;
  }
  if (note) extra += ` — ${note}`;

  return `${who} ${actionWord}${mod}${title ? ` — ${title}` : ''}${extra}.`;
}

interface ActivityLog {
  id: string;
  event_type: string;
  event_category: string;
  action: string;
  module_name: string | null;
  entity_table: string | null;
  entity_id: string | null;
  title: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_phone: string | null;
  actor_email: string | null;
  details: any;
  diff: any;
  occurred_at: string;
  created_at: string;
}

interface EmailRule {
  id: string;
  name: string;
  enabled: boolean;
  event_types: string[];
  event_categories: string[];
  modules: string[];
  actions: string[];
  recipient_emails: string[];
  schedule: string;
  notes: string | null;
  created_at: string;
}

interface LogGroup {
  key: string;
  primary: ActivityLog;
  items: ActivityLog[];
  count: number;
  day: string;
  reportDate?: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  insert: 'ثبت جدید',
  update: 'ویرایش',
  delete: 'حذف',
  event: 'رویداد',
  login: 'ورود',
};

const ACTION_COLORS: Record<string, string> = {
  insert: 'bg-green-100 text-green-700',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  event: 'bg-blue-100 text-blue-700',
  login: 'bg-indigo-100 text-indigo-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عمومی',
  auth: 'احراز هویت',
  module_change: 'تغییر در ماژول',
  pricing: 'قیمت‌گذاری',
  order: 'سفارش',
  financial: 'مالی',
};

export default function ActivityLogsModule() {
  const { toast } = useToast();
  const [tab, setTab] = useState('logs');

  // logs state
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<LogGroup | null>(null);
  const [excludedActors, setExcludedActors] = useState<Set<string>>(new Set());
  const [userFilterOpen, setUserFilterOpen] = useState(false);
  const [userFilterSearch, setUserFilterSearch] = useState('');
  const [excludedModules, setExcludedModules] = useState<Set<string>>(new Set());
  const [moduleFilterOpen, setModuleFilterOpen] = useState(false);
  const [moduleFilterSearch, setModuleFilterSearch] = useState('');

  // rules state
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [editRule, setEditRule] = useState<EmailRule | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    let q = supabase.from('activity_logs').select('*').order('occurred_at', { ascending: false }).limit(500);
    if (actionFilter !== 'all') q = q.eq('action', actionFilter);
    if (categoryFilter !== 'all') q = q.eq('event_category', categoryFilter);
    // module filter applied client-side via excludedModules
    if (dateFrom) q = q.gte('occurred_at', new Date(dateFrom).toISOString());
    if (dateTo) q = q.lte('occurred_at', new Date(dateTo + 'T23:59:59').toISOString());
    const { data, error } = await q;
    if (error) {
      toast({ variant: 'destructive', title: 'خطا در بارگذاری لاگ‌ها', description: error.message });
    } else {
      setLogs((data || []) as ActivityLog[]);
    }
    setLoading(false);
  };

  const loadRules = async () => {
    setRulesLoading(true);
    const { data, error } = await supabase
      .from('activity_email_rules')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'خطا در بارگذاری قوانین', description: error.message });
    } else {
      setRules((data || []) as EmailRule[]);
    }
    setRulesLoading(false);
  };

  // Load custom module names (e.g. user-created "custom-..." keys)
  // so the activity log shows real Persian names instead of raw keys.
  const [, setCustomNamesVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('module_hierarchy_states')
          .select('hierarchy, custom_names');
        if (cancelled || !data) return;
        const walk = (items: any[]) => {
          if (!Array.isArray(items)) return;
          for (const it of items) {
            const k = it?.key || it?.id;
            const n = (it?.name || '').toString().trim();
            if (k && n) CUSTOM_MODULE_NAMES[k] = n;
            if (Array.isArray(it?.children)) walk(it.children);
          }
        };
        for (const row of data as any[]) {
          if (row?.hierarchy) walk(row.hierarchy);
          if (row?.custom_names && typeof row.custom_names === 'object') {
            for (const [k, v] of Object.entries(row.custom_names)) {
              const n = (v as any)?.name;
              if (k && typeof n === 'string' && n.trim()) {
                CUSTOM_MODULE_NAMES[k] = n.trim();
              }
            }
          }
        }
        setCustomNamesVersion(v => v + 1);
      } catch (e) {
        console.debug('[ActivityLogs] custom module name load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadLogs();
    loadRules();
    // realtime
    const ch = supabase
      .channel('activity-logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => {
        loadLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadLogs(); /* eslint-disable-next-line */ }, [actionFilter, categoryFilter, dateFrom, dateTo]);

  const actorKey = (l: { actor_user_id?: string | null; actor_phone?: string | null; actor_name?: string | null }) =>
    l.actor_user_id || l.actor_phone || l.actor_name || 'unknown';

  const userOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; phone: string; count: number }>();
    logs.forEach(l => {
      const key = actorKey(l);
      const ex = map.get(key);
      if (ex) ex.count++;
      else map.set(key, { key, name: l.actor_name || '(بدون نام)', phone: l.actor_phone || l.actor_email || '', count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [logs]);

  const filteredUserOptions = useMemo(() => {
    const s = userFilterSearch.trim();
    if (!s) return userOptions;
    return userOptions.filter(u => u.name.includes(s) || u.phone.includes(s));
  }, [userOptions, userFilterSearch]);

  const moduleOptions = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach(l => {
      const key = l.module_name || '(بدون ماژول)';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [logs]);

  const filteredModuleOptions = useMemo(() => {
    const s = moduleFilterSearch.trim();
    if (!s) return moduleOptions;
    return moduleOptions.filter(m => m.name.includes(s) || friendlyModule(m.name).includes(s));
  }, [moduleOptions, moduleFilterSearch]);

  const moduleKeyOf = (l: { module_name?: string | null }) => l.module_name || '(بدون ماژول)';

  const filteredLogs = useMemo(() => {
    const s = search.trim();
    let arr = logs;
    if (excludedActors.size > 0) arr = arr.filter(l => !excludedActors.has(actorKey(l)));
    if (excludedModules.size > 0) arr = arr.filter(l => !excludedModules.has(moduleKeyOf(l)));
    if (!s) return arr;
    return arr.filter(l =>
      [l.event_type, l.title, l.module_name, l.actor_name, l.actor_phone, l.actor_email, l.entity_table, l.entity_id]
        .filter(Boolean).some(v => String(v).includes(s))
    );
  }, [logs, search, excludedActors, excludedModules]);

  // Group consecutive activity on the same day, by same actor + module + reportDate,
  // so that many small edits to one daily-report appear as a single item.
  const groupedLogs = useMemo<LogGroup[]>(() => {
    const map = new Map<string, LogGroup>();
    const order: string[] = [];
    for (const l of filteredLogs) {
      const day = (l.occurred_at || '').slice(0, 10);
      const reportDate = l.details?.reportDate || l.details?.report_date || l.details?.date || null;
      const ak = actorKey(l);
      const mk = moduleKeyOf(l);
      // Aggregate updates/events; keep login/insert/delete as individual rows.
      const groupable = l.action === 'update' || l.action === 'event';
      const key = groupable
        ? `g|${ak}|${mk}|${day}|${reportDate || ''}`
        : `s|${l.id}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(l);
        existing.count++;
      } else {
        map.set(key, { key, primary: l, items: [l], count: 1, day, reportDate });
        order.push(key);
      }
    }
    return order.map(k => map.get(k)!);
  }, [filteredLogs]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLogs = logs.filter(l => new Date(l.occurred_at) >= today);
    const uniqueActorsToday = new Set(todayLogs.map(l => l.actor_user_id).filter(Boolean)).size;
    return {
      total: logs.length,
      today: todayLogs.length,
      actorsToday: uniqueActorsToday,
      modules: moduleOptions.length,
    };
  }, [logs, moduleOptions]);

  const openNewRule = () => {
    setEditRule({
      id: '',
      name: '',
      enabled: true,
      event_types: [],
      event_categories: [],
      modules: [],
      actions: [],
      recipient_emails: [],
      schedule: 'instant',
      notes: '',
      created_at: '',
    });
    setRuleDialogOpen(true);
  };

  const saveRule = async () => {
    if (!editRule) return;
    if (!editRule.name || editRule.recipient_emails.length === 0) {
      toast({ variant: 'destructive', title: 'اطلاعات ناقص', description: 'نام قانون و حداقل یک ایمیل مقصد لازم است.' });
      return;
    }
    const payload = {
      name: editRule.name,
      enabled: editRule.enabled,
      event_types: editRule.event_types,
      event_categories: editRule.event_categories,
      modules: editRule.modules,
      actions: editRule.actions,
      recipient_emails: editRule.recipient_emails,
      schedule: editRule.schedule,
      notes: editRule.notes,
    };
    let error;
    if (editRule.id) {
      ({ error } = await supabase.from('activity_email_rules').update(payload).eq('id', editRule.id));
    } else {
      ({ error } = await supabase.from('activity_email_rules').insert(payload));
    }
    if (error) {
      toast({ variant: 'destructive', title: 'خطا در ذخیره قانون', description: error.message });
      return;
    }
    toast({ title: 'قانون ذخیره شد' });
    setRuleDialogOpen(false);
    setEditRule(null);
    loadRules();
  };

  const toggleRule = async (rule: EmailRule, enabled: boolean) => {
    const { error } = await supabase.from('activity_email_rules').update({ enabled }).eq('id', rule.id);
    if (error) {
      toast({ variant: 'destructive', title: 'خطا', description: error.message });
    } else {
      loadRules();
    }
  };

  const deleteRule = async (rule: EmailRule) => {
    if (!confirm(`قانون «${rule.name}» حذف شود؟`)) return;
    const { error } = await supabase.from('activity_email_rules').delete().eq('id', rule.id);
    if (error) {
      toast({ variant: 'destructive', title: 'خطا', description: error.message });
    } else {
      toast({ title: 'قانون حذف شد' });
      loadRules();
    }
  };

  const parseList = (v: string): string[] => v.split(/[,\n،]/).map(x => x.trim()).filter(Boolean);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
      <PageHeader
        title="لاگ فعالیت‌ها و ایمیل‌های خودکار"
        description="هر اقدامی که در سایت اهرم انجام می‌شود اینجا ثبت می‌شود. می‌توانید قوانین ایمیل خودکار تنظیم کنید."
        showBackButton
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">کل رویدادها (نمایش)</div><div className="text-2xl font-bold">{stats.total.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">رویدادهای امروز</div><div className="text-2xl font-bold">{stats.today.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">کاربران فعال امروز</div><div className="text-2xl font-bold">{stats.actorsToday.toLocaleString('fa-IR')}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ماژول‌های درگیر</div><div className="text-2xl font-bold">{stats.modules.toLocaleString('fa-IR')}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="logs"><Activity className="w-4 h-4 ml-1" /> لاگ فعالیت‌ها</TabsTrigger>
          <TabsTrigger value="rules"><Mail className="w-4 h-4 ml-1" /> قوانین ایمیل خودکار</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Filter className="w-4 h-4" /> فیلترها</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <Input placeholder="جستجو..." value={search} onChange={e => setSearch(e.target.value)} className="md:col-span-2" />
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger><SelectValue placeholder="نوع اقدام" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه اقدام‌ها</SelectItem>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue placeholder="دسته" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه دسته‌ها</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover open={moduleFilterOpen} onOpenChange={setModuleFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-between font-normal">
                      <span className="flex items-center gap-1 truncate">
                        <Boxes className="w-4 h-4" />
                        {excludedModules.size === 0
                          ? `همه ماژول‌ها (${moduleOptions.length.toLocaleString('fa-IR')})`
                          : `${(moduleOptions.length - excludedModules.size).toLocaleString('fa-IR')} از ${moduleOptions.length.toLocaleString('fa-IR')} ماژول`}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="end">
                    <div className="space-y-2">
                      <Input
                        placeholder="جستجوی ماژول..."
                        value={moduleFilterSearch}
                        onChange={e => setModuleFilterSearch(e.target.value)}
                        className="h-8"
                      />
                      <div className="flex items-center justify-between text-xs px-1">
                        <button type="button" className="text-primary hover:underline" onClick={() => setExcludedModules(new Set())}>انتخاب همه</button>
                        <button type="button" className="text-muted-foreground hover:underline" onClick={() => setExcludedModules(new Set(moduleOptions.map(m => m.name)))}>حذف همه</button>
                      </div>
                      <ScrollArea className="h-64 pr-1">
                        <div className="space-y-1">
                          {filteredModuleOptions.length === 0 && (
                            <div className="text-xs text-muted-foreground py-2 text-center">ماژولی یافت نشد</div>
                          )}
                          {filteredModuleOptions.map(m => {
                            const checked = !excludedModules.has(m.name);
                            return (
                              <label key={m.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setExcludedModules(prev => {
                                      const next = new Set(prev);
                                      if (v) next.delete(m.name); else next.add(m.name);
                                      return next;
                                    });
                                  }}
                                />
                                <div className="flex-1 min-w-0 text-sm truncate">{friendlyModule(m.name)}</div>
                                <span className="text-[10px] text-muted-foreground">{m.count.toLocaleString('fa-IR')}</span>
                              </label>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover open={userFilterOpen} onOpenChange={setUserFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-between font-normal">
                      <span className="flex items-center gap-1 truncate">
                        <Users className="w-4 h-4" />
                        {excludedActors.size === 0
                          ? `همه کاربران (${userOptions.length.toLocaleString('fa-IR')})`
                          : `${(userOptions.length - excludedActors.size).toLocaleString('fa-IR')} از ${userOptions.length.toLocaleString('fa-IR')} کاربر`}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="end">
                    <div className="space-y-2">
                      <Input
                        placeholder="جستجوی کاربر..."
                        value={userFilterSearch}
                        onChange={e => setUserFilterSearch(e.target.value)}
                        className="h-8"
                      />
                      <div className="flex items-center justify-between text-xs px-1">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => setExcludedActors(new Set())}
                        >
                          انتخاب همه
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:underline"
                          onClick={() => setExcludedActors(new Set(userOptions.map(u => u.key)))}
                        >
                          حذف همه
                        </button>
                      </div>
                      <ScrollArea className="h-64 pr-1">
                        <div className="space-y-1">
                          {filteredUserOptions.length === 0 && (
                            <div className="text-xs text-muted-foreground py-2 text-center">کاربری یافت نشد</div>
                          )}
                          {filteredUserOptions.map(u => {
                            const checked = !excludedActors.has(u.key);
                            return (
                              <label
                                key={u.key}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setExcludedActors(prev => {
                                      const next = new Set(prev);
                                      if (v) next.delete(u.key); else next.add(u.key);
                                      return next;
                                    });
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">{u.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">{u.phone}</div>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{u.count.toLocaleString('fa-IR')}</span>
                              </label>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" onClick={loadLogs} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} /> بروزرسانی
                </Button>
                <div className="md:col-span-1">
                  <PersianDatePicker
                    value={dateFrom ? new Date(dateFrom).toISOString() : ''}
                    onChange={(iso) => setDateFrom(iso ? iso.slice(0, 10) : '')}
                    placeholder="از تاریخ"
                    timeMode="none"
                  />
                </div>
                <div className="md:col-span-1">
                  <PersianDatePicker
                    value={dateTo ? new Date(dateTo).toISOString() : ''}
                    onChange={(iso) => setDateTo(iso ? iso.slice(0, 10) : '')}
                    placeholder="تا تاریخ"
                    timeMode="none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان</TableHead>
                      <TableHead>کاربر</TableHead>
                      <TableHead>اقدام</TableHead>
                      <TableHead>ماژول</TableHead>
                      <TableHead>عنوان رویداد</TableHead>
                      <TableHead className="text-left">جزئیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedLogs.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">رویدادی یافت نشد</TableCell></TableRow>
                    )}
                    {groupedLogs.map(g => {
                      const l = g.primary;
                      const totalChanges = g.items.reduce((sum, it) => sum + (Array.isArray(it.details?.changes) ? it.details.changes.length : 0), 0);
                      const summary = totalChanges > 0
                        ? `${totalChanges.toLocaleString('fa-IR')} تغییر${g.count > 1 ? ` در ${g.count.toLocaleString('fa-IR')} مرحله` : ''}`
                        : buildShortSummary(l);
                      return (
                        <TableRow key={g.key}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatPersianDateTimeFull(l.occurred_at)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{l.actor_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{l.actor_phone || l.actor_email || ''}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={ACTION_COLORS[l.action] || 'bg-gray-100 text-gray-700'}>
                              {ACTION_LABELS[l.action] || l.action}
                            </Badge>
                            {g.count > 1 && (
                              <Badge variant="outline" className="mr-1 text-[10px]">×{g.count.toLocaleString('fa-IR')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{friendlyModule(l.module_name)}</TableCell>
                          <TableCell className="text-sm max-w-md">
                            <div className="font-medium">
                              {g.reportDate
                                ? `گزارش ${jalaliizeDates(String(g.reportDate))}`
                                : jalaliizeDates(l.title || l.event_type)}
                            </div>
                            {summary && (
                              <div className="text-xs text-muted-foreground mt-1">{summary}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-left">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedGroup(g)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">قوانین زیر تعیین می‌کنند که برای هر نوع رویداد، چه ایمیلی به چه آدرسی فرستاده شود.</p>
            <Button onClick={openNewRule}><Plus className="w-4 h-4 ml-1" /> قانون جدید</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.length === 0 && !rulesLoading && (
              <Card className="md:col-span-2">
                <CardContent className="p-8 text-center text-muted-foreground">هنوز قانونی تعریف نشده است.</CardContent>
              </Card>
            )}
            {rules.map(r => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{r.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.enabled} onCheckedChange={(v) => toggleRule(r, v)} />
                      <Button size="sm" variant="ghost" onClick={() => { setEditRule(r); setRuleDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRule(r)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div><span className="text-muted-foreground">ایمیل‌های مقصد: </span>{r.recipient_emails.join('، ') || '—'}</div>
                  {r.event_types.length > 0 && <div><span className="text-muted-foreground">انواع رویداد: </span>{r.event_types.join('، ')}</div>}
                  {r.event_categories.length > 0 && <div><span className="text-muted-foreground">دسته‌ها: </span>{r.event_categories.map(c => CATEGORY_LABELS[c] || c).join('، ')}</div>}
                  {r.modules.length > 0 && <div><span className="text-muted-foreground">ماژول‌ها: </span>{r.modules.join('، ')}</div>}
                  {r.actions.length > 0 && <div><span className="text-muted-foreground">اقدام‌ها: </span>{r.actions.map(a => ACTION_LABELS[a] || a).join('، ')}</div>}
                  <div><span className="text-muted-foreground">زمان‌بندی: </span>{r.schedule === 'instant' ? 'آنی' : r.schedule}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Log detail dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={(o) => !o && setSelectedGroup(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {selectedGroup?.reportDate
                ? `گزارش ${jalaliizeDates(String(selectedGroup.reportDate))} — ${friendlyModule(selectedGroup.primary.module_name)}`
                : jalaliizeDates(selectedGroup?.primary?.title || selectedGroup?.primary?.event_type)}
            </DialogTitle>
            <DialogDescription>
              {selectedGroup && formatPersianDateTimeFull(selectedGroup.primary.occurred_at)}
              {selectedGroup?.primary?.actor_name && <> — {selectedGroup.primary.actor_name}</>}
              {selectedGroup && selectedGroup.count > 1 && (
                <> — {selectedGroup.count.toLocaleString('fa-IR')} رویداد در این روز</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <div className="space-y-4 text-sm">
              {selectedGroup.items.map((selectedLog, gi) => (
                <div key={selectedLog.id} className="space-y-3 border rounded p-3 bg-background">
                  {selectedGroup.items.length > 1 && (
                    <div className="text-xs text-muted-foreground border-b pb-2">
                      مرحله {(gi + 1).toLocaleString('fa-IR')} — {formatPersianDateTimeFull(selectedLog.occurred_at)}
                    </div>
                  )}
                  <div className="bg-muted/50 p-3 rounded leading-7">
                    {buildFriendlyDescription(selectedLog)}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">نوع: </span>{selectedLog.event_type}</div>
                    <div><span className="text-muted-foreground">دسته: </span>{CATEGORY_LABELS[selectedLog.event_category] || selectedLog.event_category}</div>
                    <div><span className="text-muted-foreground">اقدام: </span>{ACTION_LABELS[selectedLog.action] || selectedLog.action}</div>
                    <div><span className="text-muted-foreground">ماژول: </span>{friendlyModule(selectedLog.module_name)}</div>
                    <div><span className="text-muted-foreground">جدول: </span>{selectedLog.entity_table || '—'}</div>
                    <div><span className="text-muted-foreground">شناسه: </span>{selectedLog.entity_id || '—'}</div>
                  </div>
                  {Array.isArray(selectedLog.details?.changes) && selectedLog.details.changes.length > 0 && (
                    <div>
                      <Label>تغییرات ثبت‌شده</Label>
                      <div className="space-y-2 mt-1">
                        {selectedLog.details.changes.map((c: any, idx: number) => {
                          const hasOld = c?.old !== null && c?.old !== undefined && String(c.old).length > 0;
                          const hasNew = c?.new !== null && c?.new !== undefined && String(c.new).length > 0;
                          return (
                            <div key={idx} className="border rounded p-2 bg-muted/30">
                              <div className="text-xs text-muted-foreground mb-1">
                                <span className="font-medium text-foreground">{c.label || c.field}</span>
                                {c.row ? <span> — {c.row}</span> : null}
                              </div>
                              {hasOld && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">قبل: </span>
                                  <span className="line-through opacity-70 whitespace-pre-wrap">{jalaliizeDates(String(c.old))}</span>
                                </div>
                              )}
                              {hasNew && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">{hasOld ? 'بعد: ' : 'مقدار جدید: '}</span>
                                  <span className="font-medium whitespace-pre-wrap">{jalaliizeDates(String(c.new))}</span>
                                </div>
                              )}
                              {!hasNew && hasOld && (
                                <div className="text-xs text-destructive">حذف شد</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <details>
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">نمایش داده‌ی خام (JSON)</summary>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-72 mt-2" dir="ltr">{JSON.stringify(selectedLog.details, null, 2)}</pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rule editor dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editRule?.id ? 'ویرایش قانون' : 'قانون جدید'}</DialogTitle>
            <DialogDescription>برای هر رویدادی که با فیلترها مطابقت داشته باشد، ایمیل به آدرس‌های مقصد ارسال می‌شود. خالی گذاشتن یک فیلتر یعنی «همه».</DialogDescription>
          </DialogHeader>
          {editRule && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>نام قانون</Label>
                  <Input value={editRule.name} onChange={e => setEditRule({ ...editRule, name: e.target.value })} />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={editRule.enabled} onCheckedChange={(v) => setEditRule({ ...editRule, enabled: v })} />
                  <Label>فعال</Label>
                </div>
              </div>
              <div>
                <Label>ایمیل‌های مقصد (با کاما یا خط جدید جدا کنید)</Label>
                <Textarea
                  value={editRule.recipient_emails.join('\n')}
                  onChange={e => setEditRule({ ...editRule, recipient_emails: parseList(e.target.value) })}
                  placeholder="ahrom.com@gmail.com"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>دسته‌ها (با کاما)</Label>
                  <Input
                    value={editRule.event_categories.join('، ')}
                    onChange={e => setEditRule({ ...editRule, event_categories: parseList(e.target.value) })}
                    placeholder="auth, order, pricing, module_change..."
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>اقدام‌ها (با کاما)</Label>
                  <Input
                    value={editRule.actions.join('، ')}
                    onChange={e => setEditRule({ ...editRule, actions: parseList(e.target.value) })}
                    placeholder="insert, update, delete, login, event"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <Label>ماژول‌ها (با کاما — خالی = همه)</Label>
                <Input
                  value={editRule.modules.join('، ')}
                  onChange={e => setEditRule({ ...editRule, modules: parseList(e.target.value) })}
                  placeholder="سفارشات، گزارش روزانه، کارت‌های بانکی..."
                />
              </div>
              <div>
                <Label>انواع رویداد دقیق (اختیاری — تطبیق با ILIKE)</Label>
                <Input
                  value={editRule.event_types.join('، ')}
                  onChange={e => setEditRule({ ...editRule, event_types: parseList(e.target.value) })}
                  placeholder="ورود کاربر، دریافت قیمت..."
                />
              </div>
              <div>
                <Label>یادداشت</Label>
                <Textarea value={editRule.notes || ''} onChange={e => setEditRule({ ...editRule, notes: e.target.value })} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>انصراف</Button>
            <Button onClick={saveRule}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
