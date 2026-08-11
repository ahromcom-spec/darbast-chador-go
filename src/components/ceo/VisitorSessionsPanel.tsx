import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock, Eye, Keyboard, MousePointerClick, RefreshCw, Smartphone, Monitor,
  Tablet, UserCheck, UserX, ShieldAlert, ArrowLeftRight,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface SessionRow {
  id: string;
  session_id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  total_duration_seconds: number | null;
  total_page_views: number | null;
  entry_page: string | null;
  exit_page: string | null;
  device_type: string | null;
  device_model: string | null;
  os_name: string | null;
  browser_name: string | null;
  ip_address: string | null;
  is_logged_in: boolean | null;
  phone_number: string | null;
  visited_pages: string[] | null;
  is_impersonation: boolean | null;
  impersonator_user_id: string | null;
}

interface EventRow {
  id: string;
  event_type: string;
  page_url: string | null;
  page_title: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

const faTime = (iso: string) =>
  new Date(iso).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const faDate = (iso: string) => new Date(iso).toLocaleDateString('fa-IR');

const formatDuration = (seconds: number) => {
  if (!seconds || seconds < 60) return `${Math.max(0, Math.round(seconds))} ثانیه`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m} دقیقه${s ? ` و ${s} ثانیه` : ''}`;
  const h = Math.floor(m / 60);
  return `${h} ساعت و ${m % 60} دقیقه`;
};

const DeviceIcon = ({ type }: { type: string | null }) => {
  if (type === 'mobile') return <Smartphone className="w-4 h-4" />;
  if (type === 'tablet') return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

export function VisitorSessionsPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('site_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(200);
      const rows = (data || []) as unknown as SessionRow[];
      setSessions(rows);

      const ids = Array.from(
        new Set(
          rows
            .flatMap((r) => [r.user_id, r.impersonator_user_id])
            .filter((v): v is string => !!v),
        ),
      );
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone_number')
          .in('user_id', ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => {
          map[p.user_id] = p.full_name || p.phone_number || 'کاربر';
        });
        setNames(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEvents = useCallback(async (sessionId: string) => {
    if (openSession === sessionId) {
      setOpenSession(null);
      return;
    }
    setOpenSession(sessionId);
    setEventsLoading(true);
    try {
      const { data } = await supabase
        .from('site_analytics')
        .select('id, event_type, page_url, page_title, created_at, details')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(500);
      setEvents((data || []) as unknown as EventRow[]);
    } finally {
      setEventsLoading(false);
    }
  }, [openSession]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const name = s.user_id ? names[s.user_id] || '' : 'مهمان';
      return [name, s.phone_number, s.ip_address, s.entry_page, s.device_model]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [sessions, names, search]);

  const displayName = (s: SessionRow) => {
    if (s.is_impersonation && s.impersonator_user_id) {
      const mgr = names[s.impersonator_user_id] || 'مدیر';
      const target = s.user_id ? names[s.user_id] || 'کاربر' : 'کاربر';
      return `${mgr} (ورود مدیر به حساب ${target})`;
    }
    if (s.user_id) return names[s.user_id] || 'کاربر ثبت‌نام‌شده';
    return 'بازدیدکننده مهمان (ثبت‌نام نشده)';
  };

  const eventLine = (e: EventRow) => {
    const d = (e.details || {}) as any;
    switch (e.event_type) {
      case 'page_view':
        return { icon: <Eye className="w-4 h-4 text-blue-600" />, text: `مشاهده صفحه ${e.page_url || d.page || '—'}${e.page_title ? ` — ${e.page_title}` : ''}` };
      case 'page_leave':
        return { icon: <ArrowLeftRight className="w-4 h-4 text-indigo-600" />, text: `${formatDuration(Number(d.seconds_on_page) || 0)} در صفحه ${d.page} بود، سپس رفت به ${d.next_page}` };
      case 'click':
        return { icon: <MousePointerClick className="w-4 h-4 text-amber-600" />, text: `کلیک روی «${d.label || '—'}» در صفحه ${d.page || e.page_url || '—'}` };
      case 'input_typed':
        return { icon: <Keyboard className="w-4 h-4 text-emerald-600" />, text: `تایپ در «${d.field || 'فیلد'}»: ${d.value || ''}` };
      case 'login':
        return { icon: <UserCheck className="w-4 h-4 text-green-600" />, text: 'ورود به حساب' };
      case 'logout':
        return { icon: <UserX className="w-4 h-4 text-red-600" />, text: 'خروج از حساب' };
      case 'session_pause':
        return { icon: <Clock className="w-4 h-4 text-muted-foreground" />, text: 'صفحه را در پس‌زمینه برد' };
      case 'session_resume':
        return { icon: <Clock className="w-4 h-4 text-muted-foreground" />, text: 'به صفحه بازگشت' };
      case 'session_end':
        return { icon: <Clock className="w-4 h-4 text-muted-foreground" />, text: 'پایان بازدید (بستن صفحه)' };
      default:
        return { icon: <Activity4 />, text: `${e.event_type} — ${e.page_url || ''}` };
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              بازدیدهای سایت — مهمان و کاربران ({filtered.length.toLocaleString('fa-IR')})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="جستجو نام، شماره، IP، صفحه..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} /> بروزرسانی
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && sessions.length === 0 ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">بازدیدی ثبت نشده است.</p>
          ) : (
            filtered.map((s) => (
              <div key={s.id} className="rounded-lg border">
                <div className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {s.is_impersonation ? (
                        <ShieldAlert className="w-4 h-4 text-orange-600" />
                      ) : s.user_id ? (
                        <UserCheck className="w-4 h-4 text-green-600" />
                      ) : (
                        <UserX className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{displayName(s)}</span>
                      {s.phone_number && (
                        <span className="text-xs text-muted-foreground">{s.phone_number}</span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEvents(s.session_id)}>
                      {openSession === s.session_id ? 'بستن جزئیات' : 'مشاهده رفتار کاربر'}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(s.total_duration_seconds || 0)}
                    </Badge>
                    <Badge variant="outline">{faDate(s.started_at)} — {faTime(s.started_at)}</Badge>
                    <Badge variant="outline" className="gap-1">
                      <DeviceIcon type={s.device_type} />
                      {s.device_model || s.device_type || '—'} / {s.os_name || '—'} / {s.browser_name || '—'}
                    </Badge>
                    {s.ip_address && <Badge variant="outline">IP: {s.ip_address}</Badge>}
                    <Badge variant="outline">
                      {(s.total_page_views || s.visited_pages?.length || 0).toLocaleString('fa-IR')} صفحه
                    </Badge>
                    {s.is_impersonation && (
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                        ورود مدیر به حساب کاربر (نه بازدید خود کاربر)
                      </Badge>
                    )}
                  </div>

                  {s.visited_pages && s.visited_pages.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      {s.visited_pages.slice(0, 12).map((p, i) => (
                        <span key={`${p}-${i}`} className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded bg-muted">{p}</span>
                          {i < Math.min(s.visited_pages!.length, 12) - 1 && <span>←</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {openSession === s.session_id && (
                  <div className="border-t bg-muted/30 p-3">
                    {eventsLoading ? (
                      <LoadingSpinner />
                    ) : events.length === 0 ? (
                      <p className="text-xs text-muted-foreground">رفتاری برای این بازدید ثبت نشده است.</p>
                    ) : (
                      <ScrollArea className="max-h-80">
                        <div className="space-y-2 pl-1">
                          {events.map((e) => {
                            const line = eventLine(e);
                            return (
                              <div key={e.id} className="flex items-start gap-2 text-xs">
                                <span className="mt-0.5">{line.icon}</span>
                                <span className="text-muted-foreground shrink-0">{faTime(e.created_at)}</span>
                                <span className="break-all">{line.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Activity4() {
  return <Eye className="w-4 h-4 text-muted-foreground" />;
}
