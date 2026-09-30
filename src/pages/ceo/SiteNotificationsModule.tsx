import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Loader2,
  RefreshCw,
  Star,
  X,
  MessageSquare,
  ShoppingCart,
  Wrench,
  PackageOpen,
  CalendarClock,
  StickyNote,
  ExternalLink,
  Save,
  Volume2,
  VolumeX,
  ArrowLeftRight,
  Users,
  GitBranch,
  LogIn,
  Filter,
  Search,
  Check,
  CheckCheck,
  Clock,
  User,
  Tags,
  Send,

} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { supabase } from '@/integrations/supabase/client';
import { formatPersianDateTime } from '@/lib/dateUtils';
import { toast } from '@/hooks/use-toast';
import { SITE_NOTIF_SOUND_KEY } from '@/components/notifications/SiteNotificationSound';
import SiteNotifSoundSettings from '@/components/notifications/SiteNotifSoundSettings';
import { cn } from '@/lib/utils';

interface NotificationRow {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  order_id: string | null;
  order_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  is_important: boolean;
  is_dismissed: boolean;
  admin_note: string | null;
  created_at: string;
  is_sms?: boolean;
  sms_status?: string | null;
  actor_source?: string | null;
  actor_name?: string | null;
  impersonator_name?: string | null;
}

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  customer: { label: 'خود مشتری (از حساب/گوشی خودش)', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' },
  guest: { label: 'میهمان', cls: 'border-slate-500/40 bg-slate-500/10 text-slate-700' },
  admin: { label: 'مدیریت سایت', cls: 'border-blue-500/40 bg-blue-500/10 text-blue-700' },
  impersonation: { label: 'مدیر داخل حساب مشتری', cls: 'border-red-500/50 bg-red-500/15 text-red-700' },
  system: { label: 'سیستم / نامشخص', cls: 'border-border bg-muted text-muted-foreground' },
};
const sourceOf = (r: NotificationRow) => (r.is_sms ? 'system' : r.actor_source || 'system');

const READ_KEY = 'siteNotificationsReadIds';

const loadReadIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
};

const persistReadIds = (ids: Set<string>) => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-2000)));
  } catch {
    /* ignore */
  }
};

const EVENT_META: Record<
  string,
  { label: string; icon: typeof Bell; badge: string; edge: string; iconWrap: string }
> = {
  order_message: {
    label: 'پیام در سفارش',
    icon: MessageSquare,
    badge: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
    edge: 'bg-sky-500',
    iconWrap: 'bg-sky-500/10 text-sky-600',
  },
  order_message_edited: {
    label: 'ویرایش پیام سفارش',
    icon: StickyNote,
    badge: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    edge: 'bg-orange-500',
    iconWrap: 'bg-orange-500/10 text-orange-600',
  },
  new_order: {
    label: 'ثبت سفارش جدید',
    icon: ShoppingCart,
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    edge: 'bg-emerald-500',
    iconWrap: 'bg-emerald-500/10 text-emerald-600',
  },
  repair_request: {
    label: 'درخواست تعمیر',
    icon: Wrench,
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    edge: 'bg-amber-500',
    iconWrap: 'bg-amber-500/10 text-amber-600',
  },
  collection_request: {
    label: 'درخواست جمع‌آوری',
    icon: PackageOpen,
    badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
    edge: 'bg-indigo-500',
    iconWrap: 'bg-indigo-500/10 text-indigo-600',
  },
  renewal_request: {
    label: 'درخواست تمدید',
    icon: CalendarClock,
    badge: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    edge: 'bg-purple-500',
    iconWrap: 'bg-purple-500/10 text-purple-600',
  },
  order_transfer: {
    label: 'انتقال سفارش',
    icon: ArrowLeftRight,
    badge: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
    edge: 'bg-teal-500',
    iconWrap: 'bg-teal-500/10 text-teal-600',
  },
  order_collaborator: {
    label: 'همکاری در سفارش',
    icon: Users,
    badge: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
    edge: 'bg-yellow-500',
    iconWrap: 'bg-yellow-500/10 text-yellow-700',
  },
  order_stage_change: {
    label: 'تغییر مرحله سفارش',
    icon: GitBranch,
    badge: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    edge: 'bg-blue-500',
    iconWrap: 'bg-blue-500/10 text-blue-600',
  },
  user_visit: {
    label: 'ورود/بازدید کاربر',
    icon: LogIn,
    badge: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
    edge: 'bg-slate-400',
    iconWrap: 'bg-slate-500/10 text-slate-600',
  },
  sms_sent: {
    label: 'پیامک ارسالی',
    icon: Send,
    badge: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
    edge: 'bg-rose-500',
    iconWrap: 'bg-rose-500/10 text-rose-600',
  },
  sms_pending: {
    label: 'پیامک در انتظار ارسال',
    icon: Send,
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    edge: 'bg-amber-500',
    iconWrap: 'bg-amber-500/10 text-amber-600',
  },
  sms_failed: {
    label: 'پیامک ناموفق',
    icon: Send,
    badge: 'bg-destructive/10 text-destructive border-destructive/30',
    edge: 'bg-destructive',
    iconWrap: 'bg-destructive/10 text-destructive',
  },
};



const FALLBACK_META = {
  label: 'اعلان',
  icon: Bell,
  badge: 'bg-muted text-muted-foreground border-border',
  edge: 'bg-muted-foreground/50',
  iconWrap: 'bg-muted text-muted-foreground',
};

export default function SiteNotificationsModule() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // انواع اعلانی که مدیر تیکشان را برداشته (پیش‌فرض: هیچ‌کدام → همه نمایش داده می‌شوند)
  const [excludedTypes, setExcludedTypes] = useState<Set<string>>(new Set());
  const [personFilter, setPersonFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());

  const [tab, setTab] = useState('active');
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SITE_NOTIF_SOUND_KEY) !== 'false'
  );

  const load = async () => {
    setLoading(true);
    const [notifRes, smsRes, queueRes] = await Promise.all([
      supabase
        .from('site_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('sms_logs')
        .select('id, message, recipient, status, order_id, order_code, template_key, created_at')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('scheduled_sms')
        .select('id, phone, payload, state, status_key, order_id, order_code, last_error, attempts, send_after, sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    if (notifRes.error) {
      console.error('Error loading site notifications:', notifRes.error);
      toast({ title: 'خطا در بارگذاری اعلانات', variant: 'destructive' });
    }

    const notifRows = (notifRes.data || []) as NotificationRow[];

    const logs = smsRes.error ? [] : smsRes.data || [];
    const queue = queueRes.error ? [] : queueRes.data || [];
    if (smsRes.error) console.error('Error loading sms logs:', smsRes.error);
    if (queueRes.error) console.error('Error loading sms queue:', queueRes.error);

    const phones = [
      ...new Set([
        ...logs.map((l: any) => l.recipient).filter(Boolean),
        ...queue.map((q: any) => q.phone).filter(Boolean),
      ]),
    ];
    const nameByPhone: Record<string, string> = {};
    if (phones.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('phone_number, full_name')
        .in('phone_number', phones);
      (profs || []).forEach((p: any) => {
        if (p.phone_number && p.full_name) nameByPhone[p.phone_number] = p.full_name;
      });
    }

    const isOk = (s?: string | null) => s === 'sent' || s === 'success';

    const smsRows: NotificationRow[] = logs.map((l: any) => ({
      id: `sms-${l.id}`,
      event_type: isOk(l.status) ? 'sms_sent' : 'sms_failed',
      title: `${isOk(l.status) ? 'پیامک به' : 'پیامک ناموفق به'} ${nameByPhone[l.recipient] || l.recipient}`,
      body: l.message,
      order_id: l.order_id,
      order_code: l.order_code,
      customer_name: nameByPhone[l.recipient] || null,
      customer_phone: l.recipient,
      is_important: false,
      is_dismissed: false,
      admin_note: null,
      created_at: l.created_at,
      is_sms: true,
      sms_status: l.status,
    }));

    const queueRows: NotificationRow[] = queue
      .filter((q: any) => q.state !== 'sent')
      .map((q: any) => {
        const failed = q.state === 'failed' || q.state === 'error' || q.state === 'canceled';
        const text =
          (q.payload && (q.payload.message || q.payload.text || q.payload.body)) ||
          `پیامک ${q.status_key || ''}`.trim();
        return {
          id: `smsq-${q.id}`,
          event_type: failed ? 'sms_failed' : 'sms_pending',
          title: `${failed ? 'پیامک ناموفق به' : 'پیامک در انتظار ارسال به'} ${
            nameByPhone[q.phone] || q.phone
          }`,
          body: [text, q.last_error ? `خطا: ${q.last_error}` : null]
            .filter(Boolean)
            .join('\n'),
          order_id: q.order_id,
          order_code: q.order_code,
          customer_name: nameByPhone[q.phone] || null,
          customer_phone: q.phone,
          is_important: false,
          is_dismissed: false,
          admin_note: null,
          created_at: q.created_at,
          is_sms: true,
          sms_status: failed ? q.state : `در انتظار ارسال (${q.attempts || 0} تلاش)`,
        } as NotificationRow;
      });

    setRows(
      [...notifRows, ...smsRows, ...queueRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );

    setLoading(false);
  };


  useEffect(() => {
    load();

    const channel = supabase
      .channel('site-notifications-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'site_notifications' },
        (payload) => {
          setRows((prev) => [payload.new as NotificationRow, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markRead = (ids: string[]) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      persistReadIds(next);
      return next;
    });
  };

  const toggleImportant = async (row: NotificationRow) => {
    const next = !row.is_important;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_important: next } : r)));
    const { error } = await supabase
      .from('site_notifications')
      .update({ is_important: next })
      .eq('id', row.id);
    if (error) {
      toast({ title: 'خطا در تغییر وضعیت مهم', variant: 'destructive' });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_important: !next } : r)));
    }
  };

  const dismiss = async (row: NotificationRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_dismissed: true } : r)));
    const { error } = await supabase
      .from('site_notifications')
      .update({ is_dismissed: true })
      .eq('id', row.id);
    if (error) {
      toast({ title: 'خطا در حذف پاپ‌آپ', variant: 'destructive' });
      load();
    }
  };

  const restore = async (row: NotificationRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_dismissed: false } : r)));
    await supabase.from('site_notifications').update({ is_dismissed: false }).eq('id', row.id);
  };

  const removeForever = async (row: NotificationRow) => {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const { error } = await supabase.from('site_notifications').delete().eq('id', row.id);
    if (error) {
      toast({ title: 'خطا در حذف کامل اعلان', variant: 'destructive' });
      load();
    }
  };

  const saveNote = async (row: NotificationRow) => {
    const value = noteDraft.trim() || null;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, admin_note: value } : r)));
    setNoteOpenId(null);
    const { error } = await supabase
      .from('site_notifications')
      .update({ admin_note: value })
      .eq('id', row.id);
    if (error) {
      toast({ title: 'خطا در ذخیره توضیحات', variant: 'destructive' });
      load();
    } else {
      toast({ title: 'توضیحات ذخیره شد' });
    }
  };

  const personSuggestions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.customer_name) set.add(r.customer_name);
      if (r.customer_phone) set.add(r.customer_phone);
    });
    return [...set].slice(0, 60);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const person = personFilter.trim();
    const fromTs = fromDate ? new Date(new Date(fromDate).setHours(0, 0, 0, 0)).getTime() : null;
    const toTs = toDate ? new Date(new Date(toDate).setHours(23, 59, 59, 999)).getTime() : null;

    return rows.filter((r) => {
      if (tab === 'active' && r.is_dismissed) return false;
      if (tab === 'important' && (!r.is_important || r.is_dismissed)) return false;
      if (tab === 'dismissed' && !r.is_dismissed) return false;

      if (excludedTypes.has(r.event_type)) return false;
      if (sourceFilter !== 'all' && sourceOf(r) !== sourceFilter) return false;

      if (person) {
        const hay = [r.customer_name, r.customer_phone, r.actor_name, r.impersonator_name].filter(Boolean).join(' ');
        if (!hay.includes(person)) return false;
      }

      if (fromTs || toTs) {
        const ts = new Date(r.created_at).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }

      if (!q) return true;
      return [r.order_code, r.customer_name, r.customer_phone, r.title, r.body, r.admin_note]
        .filter(Boolean)
        .some((v) => String(v).includes(q));
    });
  }, [rows, search, tab, excludedTypes, personFilter, fromDate, toDate, sourceFilter]);

  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { if (!r.is_dismissed) c[sourceOf(r)] = (c[sourceOf(r)] || 0) + 1; });
    return c;
  }, [rows]);

  const counts = useMemo(
    () => ({
      active: rows.filter((r) => !r.is_dismissed).length,
      important: rows.filter((r) => r.is_important && !r.is_dismissed).length,
      dismissed: rows.filter((r) => r.is_dismissed).length,
      unread: rows.filter((r) => !r.is_dismissed && !readIds.has(r.id)).length,
    }),
    [rows, readIds]
  );

  const hasFilters =
    !!search || !!personFilter || !!fromDate || !!toDate || excludedTypes.size > 0 || sourceFilter !== 'all';

  const allEventKeys = Object.keys(EVENT_META);
  const activeTypeCount = allEventKeys.filter((k) => !excludedTypes.has(k)).length;

  const toggleType = (key: string) => {
    setExcludedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      map[r.event_type] = (map[r.event_type] || 0) + 1;
    });
    return map;
  }, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background p-3 md:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
              {counts.unread > 0 && (
                <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {counts.unread}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-base font-bold md:text-xl">ماژول گزارشات و اعلانات سایت</h1>
              <p className="text-xs text-muted-foreground">
                {counts.active} اعلان فعال · {counts.unread} خوانده‌نشده
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                markRead(rows.filter((r) => !r.is_dismissed).map((r) => r.id));
                toast({ title: 'همه اعلان‌ها خوانده‌شده علامت خوردند' });
              }}
              disabled={counts.unread === 0}
            >
              <CheckCheck className="h-4 w-4" />
              خواندن همه
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                localStorage.setItem(SITE_NOTIF_SOUND_KEY, next ? 'true' : 'false');
                toast({ title: next ? 'صدای اعلان‌ها روشن شد' : 'صدای اعلان‌ها خاموش شد' });
              }}
              title="صدای اعلان‌ها"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundEnabled ? 'صدا روشن' : 'صدا خاموش'}
            </Button>
            <SiteNotifSoundSettings />
            <Button variant="outline" size="sm" className="rounded-xl" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              بروزرسانی
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => navigate('/profile?tab=modules')}
            >
              بازگشت
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4 text-primary" />
            فیلتر پیشرفته اعلان‌ها
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="rounded-xl pr-9"
                placeholder="جستجو در شماره سفارش، نام مشتری، متن پیام..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Tags className="h-3.5 w-3.5" />
                انواع اعلانات
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                  {activeTypeCount}/{allEventKeys.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(EVENT_META).map(([key, meta]) => {
                  const checked = !excludedTypes.has(key);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleType(key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-all',
                        checked
                          ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm'
                          : 'border-muted bg-muted/40 text-muted-foreground opacity-70'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md',
                          meta.iconWrap
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="font-medium">{meta.label}</span>
                      <span className="rounded-full bg-background/80 px-1 py-0 text-[10px] font-bold">
                        {typeCounts[key] || 0}
                      </span>
                      {checked ? (
                        <Check className="h-3 w-3 shrink-0 text-primary" />
                      ) : (
                        <span className="h-3 w-3 shrink-0 rounded-full border border-muted-foreground/40" />
                      )}
                    </button>
                  );
                })}
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    onClick={() => setExcludedTypes(new Set())}
                    disabled={excludedTypes.size === 0}
                  >
                    انتخاب همه
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[11px]"
                    onClick={() => setExcludedTypes(new Set(allEventKeys))}
                    disabled={activeTypeCount === 0}
                  >
                    حذف همه
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <User className="h-4 w-4" /> انجام‌دهنده اتفاق
              </div>
              <div className="flex flex-wrap gap-2">
                {[['all', 'همه'], ...Object.entries(SOURCE_META).map(([k, v]) => [k, v.label])].map(([k, label]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={sourceFilter === k ? 'default' : 'outline'}
                    className="h-8 rounded-xl text-xs"
                    onClick={() => setSourceFilter(k)}
                  >
                    {label}
                    {k !== 'all' && <span className="ms-1 opacity-70">{sourceCounts[k] || 0}</span>}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="rounded-xl pr-9"
                  list="site-notif-persons"
                  placeholder="نام یا شماره شخص"
                  value={personFilter}
                  onChange={(e) => setPersonFilter(e.target.value)}
                />
                <datalist id="site-notif-persons">
                  {personSuggestions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <PersianDatePicker value={fromDate} onChange={setFromDate} timeMode="none" placeholder="از تاریخ" />
              <PersianDatePicker value={toDate} onChange={setToDate} timeMode="none" placeholder="تا تاریخ" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {filtered.length} اعلان نمایش داده می‌شود
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              disabled={!hasFilters}
              onClick={() => {
                setExcludedTypes(new Set());
                setPersonFilter('');
                setSourceFilter('all');
                setFromDate('');
                setToDate('');
                setSearch('');
              }}
            >
              <X className="h-4 w-4" />
              حذف فیلترها
            </Button>
          </div>
        </div>

        {/* Tabs + list */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full rounded-2xl bg-muted/60 p-1">
            {[
              { key: 'active', label: 'فعال', count: counts.active },
              { key: 'important', label: 'مهم', count: counts.important },
              { key: 'dismissed', label: 'حذف‌شده', count: counts.dismissed },
            ].map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="flex-1 gap-2 rounded-xl py-2 text-xs data-[state=active]:shadow-sm sm:text-sm"
              >
                {t.label}
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold">
                  {t.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card/60 py-16">
                <Bell className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">اعلانی برای نمایش وجود ندارد</p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filtered.map((row) => {
                  const meta = EVENT_META[row.event_type] || {
                    ...FALLBACK_META,
                    label: row.event_type,
                  };
                  const Icon = meta.icon;
                  const unread = !row.is_dismissed && !readIds.has(row.id);

                  return (
                    <Card
                      key={row.id}
                      onMouseEnter={() => unread && markRead([row.id])}
                      className={cn(
                        'group relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-200',
                        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
                        row.is_important && 'border-yellow-500/60 ring-1 ring-yellow-500/25',
                        unread && 'bg-primary/[0.035]',
                        sourceOf(row) === 'impersonation' && 'border-2 border-dashed border-red-500/70 bg-red-500/[0.04]',
                        sourceOf(row) === 'admin' && 'border-blue-500/50'
                      )}
                    >
                      <span className={cn('absolute inset-y-0 right-0 w-1.5', meta.edge)} />

                      <CardContent className="space-y-3 p-4 pr-5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                                meta.iconWrap
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                                <h3 className="truncate text-sm font-bold">{row.title}</h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={cn('gap-1 text-[10px]', meta.badge)}>
                                  {meta.label}
                                </Badge>
                                <Badge variant="outline" className={cn('text-[10px] font-bold', SOURCE_META[sourceOf(row)]?.cls)}>
                                  {SOURCE_META[sourceOf(row)]?.label}
                                  {sourceOf(row) === 'impersonation' && row.impersonator_name ? `: ${row.impersonator_name}` : ''}
                                  {sourceOf(row) === 'admin' && row.actor_name ? `: ${row.actor_name}` : ''}
                                </Badge>
                                {row.order_code && (
                                  <Badge variant="secondary" className="font-mono text-[10px]">
                                    سفارش {row.order_code}
                                  </Badge>
                                )}
                                {row.is_important && (
                                  <Badge className="bg-yellow-500 text-[10px] text-yellow-950 hover:bg-yellow-500">
                                    مهم
                                  </Badge>
                                )}
                                {row.is_sms && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px]',
                                      row.event_type === 'sms_sent'
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                                        : row.event_type === 'sms_pending'
                                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                                        : 'border-destructive/40 bg-destructive/10 text-destructive'
                                    )}
                                  >
                                    {row.event_type === 'sms_sent'
                                      ? 'ارسال شد'
                                      : `وضعیت: ${row.sms_status || '—'}`}
                                  </Badge>
                                )}

                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                            {row.is_sms ? null : row.is_dismissed ? (

                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  title="بازگردانی"
                                  onClick={() => restore(row)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-destructive"
                                  title="حذف کامل"
                                  onClick={() => removeForever(row)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  title={row.is_important ? 'حذف نشان مهم' : 'علامت‌گذاری به عنوان مهم'}
                                  onClick={() => toggleImportant(row)}
                                >
                                  <Star
                                    className={cn(
                                      'h-4 w-4',
                                      row.is_important
                                        ? 'fill-yellow-500 text-yellow-500'
                                        : 'text-muted-foreground'
                                    )}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  title="افزودن توضیحات"
                                  onClick={() => {
                                    setNoteOpenId(noteOpenId === row.id ? null : row.id);
                                    setNoteDraft(row.admin_note || '');
                                  }}
                                >
                                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-destructive"
                                  title="حذف پاپ‌آپ"
                                  onClick={() => dismiss(row)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        {row.body && (
                          <p className="whitespace-pre-wrap rounded-xl bg-muted/60 p-2.5 text-sm leading-relaxed">
                            {row.body}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                          {row.customer_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {row.customer_name}
                            </span>
                          )}
                          {row.customer_phone && <span className="font-mono">{row.customer_phone}</span>}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatPersianDateTime(row.created_at)}
                          </span>
                        </div>

                        {row.admin_note && noteOpenId !== row.id && (
                          <p className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
                            توضیحات: {row.admin_note}
                          </p>
                        )}

                        {noteOpenId === row.id && (
                          <div className="space-y-2">
                            <Textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="توضیحات خود را برای این اعلان بنویسید..."
                              rows={3}
                              className="rounded-xl"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="rounded-xl" onClick={() => saveNote(row)}>
                                <Save className="h-4 w-4" />
                                ذخیره
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl"
                                onClick={() => setNoteOpenId(null)}
                              >
                                انصراف
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        {row.order_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl"
                            onClick={() => navigate(`/user/orders/${row.order_id}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                            مشاهده سفارش
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
