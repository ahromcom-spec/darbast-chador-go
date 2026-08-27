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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { formatPersianDate } from '@/lib/dateUtils';
import { toast } from '@/hooks/use-toast';

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
}

const EVENT_META: Record<string, { label: string; icon: typeof Bell; className: string }> = {
  order_message: { label: 'پیام در سفارش', icon: MessageSquare, className: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  new_order: { label: 'ثبت سفارش جدید', icon: ShoppingCart, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  repair_request: { label: 'درخواست تعمیر', icon: Wrench, className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  collection_request: { label: 'درخواست جمع‌آوری', icon: PackageOpen, className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
  renewal_request: { label: 'درخواست تمدید', icon: CalendarClock, className: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
};

export default function SiteNotificationsModule() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active');
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      console.error('Error loading site notifications:', error);
      toast({ title: 'خطا در بارگذاری اعلانات', variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data || []) as NotificationRow[]);
    }
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

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) => {
      if (tab === 'active' && r.is_dismissed) return false;
      if (tab === 'important' && (!r.is_important || r.is_dismissed)) return false;
      if (tab === 'dismissed' && !r.is_dismissed) return false;
      if (!q) return true;
      return [r.order_code, r.customer_name, r.customer_phone, r.title, r.body, r.admin_note]
        .filter(Boolean)
        .some((v) => String(v).includes(q));
    });
  }, [rows, search, tab]);

  const counts = useMemo(
    () => ({
      active: rows.filter((r) => !r.is_dismissed).length,
      important: rows.filter((r) => r.is_important && !r.is_dismissed).length,
      dismissed: rows.filter((r) => r.is_dismissed).length,
    }),
    [rows]
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold md:text-xl">ماژول گزارشات و اعلانات سایت</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              بروزرسانی
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/profile?tab=modules')}>
              بازگشت
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              هر پیام سفارش، ثبت سفارش جدید، درخواست تعمیر، جمع‌آوری و تمدید به‌صورت یک پاپ‌آپ در این ماژول ثبت می‌شود.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="جستجو در شماره سفارش، نام مشتری، متن پیام..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="active" className="flex-1">
                  فعال ({counts.active})
                </TabsTrigger>
                <TabsTrigger value="important" className="flex-1">
                  مهم ({counts.important})
                </TabsTrigger>
                <TabsTrigger value="dismissed" className="flex-1">
                  حذف‌شده ({counts.dismissed})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-4">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">اعلانی برای نمایش وجود ندارد</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filtered.map((row) => {
                      const meta = EVENT_META[row.event_type] || {
                        label: row.event_type,
                        icon: Bell,
                        className: 'bg-muted text-muted-foreground border-border',
                      };
                      const Icon = meta.icon;
                      return (
                        <Card
                          key={row.id}
                          className={`relative border shadow-sm transition-shadow hover:shadow-md ${
                            row.is_important ? 'border-yellow-500/60 ring-1 ring-yellow-500/30' : ''
                          }`}
                        >
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            {row.is_dismissed ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="بازگردانی" onClick={() => restore(row)}>
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
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
                                  className="h-7 w-7"
                                  title={row.is_important ? 'حذف نشان مهم' : 'علامت‌گذاری به عنوان مهم'}
                                  onClick={() => toggleImportant(row)}
                                >
                                  <Star
                                    className={`h-4 w-4 ${
                                      row.is_important ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'
                                    }`}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
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
                                  className="h-7 w-7 text-destructive"
                                  title="حذف پاپ‌آپ"
                                  onClick={() => dismiss(row)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>

                          <CardContent className="space-y-2 p-4 pt-10">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                              {row.order_code && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  سفارش {row.order_code}
                                </Badge>
                              )}
                              {row.is_important && (
                                <Badge className="bg-yellow-500 text-yellow-950 hover:bg-yellow-500">مهم</Badge>
                              )}
                            </div>

                            <div className="text-sm font-semibold">{row.title}</div>

                            {row.body && (
                              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-sm leading-relaxed">
                                {row.body}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {row.customer_name && <span>مشتری: {row.customer_name}</span>}
                              {row.customer_phone && <span className="font-mono">{row.customer_phone}</span>}
                              <span>{formatPersianDate(row.created_at, true)}</span>
                            </div>

                            {row.admin_note && noteOpenId !== row.id && (
                              <p className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
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
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => saveNote(row)}>
                                    <Save className="h-4 w-4" />
                                    ذخیره
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setNoteOpenId(null)}>
                                    انصراف
                                  </Button>
                                </div>
                              </div>
                            )}

                            {row.order_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
