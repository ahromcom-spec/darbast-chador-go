import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Loader2, MessageSquare, Save, RefreshCw, Smartphone, Send, AlertCircle,
  CheckCircle2, XCircle, Lock, RotateCcw, Wallet, Clock, Settings2,
  Search, X,
} from "lucide-react";

interface SmsTemplate {
  id: string;
  key: string;
  title: string;
  description: string | null;
  scope: "customer" | "ceo" | string;
  template: string;
  default_template: string | null;
  enabled: boolean;
  delay_minutes: number;
  conditions: Record<string, any> | null;
  footer: string;
  append_footer: boolean;
  updated_at: string;
}

interface SmsLog {
  id: string;
  recipient: string;
  message: string;
  status: string;
  template_key: string | null;
  order_code: string | null;
  provider_response: string | null;
  created_at: string;
  customer_name?: string | null;
  address?: string | null;
  detailed_address?: string | null;
}

interface ScheduledSms {
  id: string;
  phone: string;
  order_code: string;
  status_key: string;
  send_after: string;
  state: string;
  attempts: number;
  last_error: string | null;
  payload: Record<string, any> | null;
  created_at: string;
}


const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{code}", label: "کد سفارش" },
  { token: "{serviceType}", label: "نوع خدمت" },
  { token: "{address}", label: "آدرس" },
  { token: "{customerName}", label: "نام مشتری" },
  { token: "{dateTime}", label: "تاریخ/ساعت" },
  { token: "{amount}", label: "مبلغ" },
  { token: "{orderLink}", label: "لینک سفارش" },
  { token: "{description}", label: "شرح فعالیت سفارش" },
  { token: "{paymentLink}", label: "لینک پرداخت سفارش" },

];

const BRAND_FOOTER = "ahrom.ir";

// Mobile preview mockup
function MobilePreview({ text }: { text: string }) {
  const chars = text.length;
  const parts = Math.max(1, Math.ceil(chars / 70));
  return (
    <div className="w-full max-w-[260px] mx-auto" dir="rtl">
      <div className="rounded-[28px] border-4 border-slate-800 bg-slate-900 p-2 shadow-xl">
        <div className="rounded-[20px] bg-gradient-to-b from-slate-50 to-slate-200 min-h-[320px] p-3 flex flex-col">
          <div className="flex items-center justify-between text-[10px] text-slate-600 px-1 pb-2">
            <span>9:41</span>
            <span>اهرم</span>
            <span>📶 100%</span>
          </div>
          <div className="bg-white rounded-2xl shadow p-3 text-[12px] leading-6 text-slate-800 whitespace-pre-wrap break-words flex-1">
            <div className="text-[10px] text-slate-500 mb-1">پیامک از 90000319</div>
            {text || <span className="text-slate-400">— پیش‌نمایش —</span>}
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between px-1">
            <span>{chars} کاراکتر</span>
            <span>{parts} بخش پیامکی</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SmsManagementModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [items, setItems] = useState<SmsTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<SmsTemplate>>>({});
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [stats, setStats] = useState({ sentToday: 0, failedToday: 0, total: 0 });
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [queue, setQueue] = useState<ScheduledSms[]>([]);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [queueSearch, setQueueSearch] = useState("");

  const cancelScheduled = async (row: ScheduledSms) => {
    setCanceling(row.id);
    try {
      const { error } = await supabase
        .from("scheduled_sms")
        .delete()
        .eq("id", row.id)
        .eq("state", "pending");
      if (error) throw error;
      setQueue((q) => q.filter((r) => r.id !== row.id));
      toast.success("ارسال این پیامک لغو شد");
    } catch (e: any) {
      toast.error("خطا در لغو ارسال: " + (e?.message || ""));
    } finally {
      setCanceling(null);
    }
  };

  const resendLog = async (l: SmsLog) => {
    if (!l.message || !l.recipient) {

      toast.error("متن یا شماره گیرنده برای ارسال مجدد موجود نیست");
      return;
    }
    setResending(l.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-order-sms", {
        body: {
          phone: l.recipient,
          orderCode: l.order_code || "-",
          status: l.template_key || "resend",
          resendMessage: l.message,
        },
      });
      if (error) throw error;
      if (data && (data as any).success === false) throw new Error((data as any).error || "ارسال مجدد ناموفق بود");
      toast.success("پیامک با تاریخ جدید مجدداً ارسال شد");
      load();
    } catch (e: any) {
      toast.error("خطا در ارسال مجدد: " + (e?.message || ""));
    } finally {
      setResending(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const [tplRes, logsRes, statsRes, queueRes] = await Promise.all([
      supabase.from("sms_templates").select("*").order("scope").order("title"),
      supabase.from("sms_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("sms_logs").select("status, created_at").gte(
        "created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
      ),
      supabase.from("scheduled_sms").select("*").eq("state", "pending")
        .order("send_after", { ascending: true }).limit(100),
    ]);
    if (tplRes.error) toast.error("خطا در دریافت قالب‌ها: " + tplRes.error.message);
    else {
      setItems((tplRes.data || []) as SmsTemplate[]);
      setDrafts({});
    }
    if (!logsRes.error) setLogs((logsRes.data || []) as SmsLog[]);
    if (!queueRes.error) setQueue((queueRes.data || []) as unknown as ScheduledSms[]);

    if (!statsRes.error) {
      const rows = (statsRes.data || []) as { status: string }[];
      setStats({
        sentToday: rows.filter((r) => r.status === "sent").length,
        failedToday: rows.filter((r) => r.status === "failed").length,
        total: rows.length,
      });
    }
    setLoading(false);
  };

  const fetchWalletBalance = async () => {
    setWalletLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-sms-balance");
      if (error) throw error;
      setWalletBalance(data?.balance ?? "نامشخص");
    } catch (e: any) {
      setWalletBalance("در دسترس نیست");
    } finally {
      setWalletLoading(false);
    }
  };

  const refreshQueue = async () => {
    const { data, error } = await supabase
      .from("scheduled_sms")
      .select("*")
      .eq("state", "pending")
      .order("send_after", { ascending: true })
      .limit(100);
    if (!error) setQueue((data || []) as unknown as ScheduledSms[]);
  };

  useEffect(() => { load(); }, []);

  // به‌روزرسانی خودکار صف ارسال (برای دیدن تلاش‌های مجدد رندوم)
  useEffect(() => {
    const t = setInterval(() => { refreshQueue(); }, 20000);
    return () => clearInterval(t);
  }, []);

  const getQueueMessage = (row: ScheduledSms): string => {
    const p = row.payload || {};
    return p.message || p.text || p.body || p.resendMessage || "";
  };


  const merged = (item: SmsTemplate): SmsTemplate => ({ ...item, ...(drafts[item.id] || {}) });
  const setDraft = (id: string, patch: Partial<SmsTemplate>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const previewText = (item: SmsTemplate) => {
    const m = merged(item);
    const body = (m.template || "")
      .replace(/\{code\}/g, "1000123")
      .replace(/\{serviceType\}/g, "داربست نما (ثبت شد)")
      .replace(/\{address\}/g, "تهران، خیابان نمونه")
      .replace(/\{customerName\}/g, "علی رضایی")
      .replace(/\{dateTime\}/g, "1404/04/08 ساعت 14:30")
      .replace(/\{amount\}/g, "۲٬۵۰۰٬۰۰۰")
      .replace(/\{orderLink\}/g, "https://ahrom.ir/orders/123")
      .replace(/\{description\}/g, "اجرای داربست نما ۱۲ متر طول × ۶ متر ارتفاع")
      .replace(/\{paymentLink\}/g, "https://ahrom.ir/user/orders/123?pay=1");

    const footer = (m.footer || BRAND_FOOTER).trim() || BRAND_FOOTER;
    const header = "خدمات ساختمانی و منزل اهرم";
    const withHeader = body.startsWith(header) ? body : `${header}\n${body}`;
    return withHeader + (m.append_footer ? `\n${footer}` : "") + (!withHeader.includes("ahrom.ir") && !m.append_footer ? `\n${BRAND_FOOTER}` : "");
  };

  const save = async (item: SmsTemplate) => {
    const m = merged(item);
    setSaving(item.id);
    const { data, error } = await supabase.from("sms_templates").update({
      template: m.template,
      description: m.description,
      title: m.title,
      enabled: m.enabled,
      delay_minutes: Number(m.delay_minutes) || 0,
      conditions: m.conditions || {},
      footer: (m.footer || BRAND_FOOTER).trim() || BRAND_FOOTER,
      append_footer: m.append_footer !== false,
    }).eq("id", item.id).select("id");
    setSaving(null);
    if (error) { toast.error("خطا در ذخیره: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("ذخیره انجام نشد — دسترسی ویرایش قالب پیامک برای حساب شما وجود ندارد");
      return;
    }
    toast.success("ذخیره شد");
    await load();
  };

  const resetToDefault = async (item: SmsTemplate) => {
    if (!item.default_template) { toast.error("نسخه پیش‌فرض موجود نیست"); return; }
    setDraft(item.id, { template: item.default_template });
    toast.info("بازنشانی شد — برای اعمال «ذخیره» کنید");
  };

  const toggleEnabled = async (item: SmsTemplate, value: boolean) => {
    setSaving(item.id);
    const { data, error } = await supabase.from("sms_templates").update({ enabled: value }).eq("id", item.id).select("id");
    setSaving(null);
    if (error) { toast.error("خطا: " + error.message); return; }
    if (!data || data.length === 0) { toast.error("تغییر وضعیت انجام نشد — دسترسی کافی ندارید"); return; }
    toast.success(value ? "فعال شد" : "غیرفعال شد");
    load();
  };


  const groups: Record<string, SmsTemplate[]> = useMemo(() => {
    const g: Record<string, SmsTemplate[]> = { customer: [], ceo: [] };
    for (const it of items) (g[it.scope] || (g[it.scope] = [])).push(it);
    return g;
  }, [items]);

  const renderItem = (item: SmsTemplate) => {
    const m = merged(item);
    const dirty = !!drafts[item.id];
    const cond = (m.conditions || {}) as Record<string, any>;
    return (
      <Card key={item.id} className={dirty ? "border-amber-400 shadow-md" : "shadow-sm"}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <MessageSquare className="h-4 w-4 text-primary" />
                {m.title}
                <Badge variant="outline" className="text-xs font-mono">{item.key}</Badge>
                {!m.enabled && <Badge variant="destructive">غیرفعال</Badge>}
                {m.delay_minutes > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />{m.delay_minutes} دقیقه تأخیر
                  </Badge>
                )}
              </CardTitle>
              {m.description && (
                <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">فعال</Label>
              <Switch
                checked={!!m.enabled}
                disabled={saving === item.id}
                onCheckedChange={(v) => toggleEnabled(item, v)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">عنوان</Label>
                <Input value={m.title} onChange={(e) => setDraft(item.id, { title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">توضیحات (فقط برای مدیران)</Label>
                <Input
                  value={m.description || ""}
                  placeholder="مثلاً: پیامک پس از تایید سفارش به مشتری ارسال می‌شود"
                  onChange={(e) => setDraft(item.id, { description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  متن پیامک
                  <span className="text-[10px] text-muted-foreground">— متغیرها را با کلیک اضافه کنید</span>
                </Label>
                <Textarea
                  dir="rtl" rows={4}
                  value={m.template}
                  onChange={(e) => setDraft(item.id, { template: e.target.value })}
                />
                {/* Locked brand footer */}
                <div className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">پابرگ اجباری برند:</span>
                  <code className="font-mono text-primary">{BRAND_FOOTER}</code>
                  <span className="text-muted-foreground">— به‌صورت خودکار در انتهای هر پیامک افزوده می‌شود</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {PLACEHOLDERS.map((p) => (
                    <Button
                      key={p.token}
                      type="button" size="sm" variant="outline" className="h-7 text-xs"
                      title={p.label}
                      onClick={() => setDraft(item.id, { template: (m.template || "") + " " + p.token })}
                    >
                      {p.token}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-5 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  متن باید مطابق الگوی تایید شده پارس‌گرین باشد تا فیلتر نشود. تغییرات عمده ممکن است نیاز به تایید مجدد الگو داشته باشند.
                </p>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="adv" className="border rounded-md">
                  <AccordionTrigger className="px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />تنظیمات پیشرفته (شرط‌ها و تأخیر)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">تأخیر ارسال (دقیقه)</Label>
                        <Input
                          type="number" min={0}
                          value={m.delay_minutes ?? 0}
                          onChange={(e) => setDraft(item.id, { delay_minutes: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">حداقل مبلغ سفارش (تومان)</Label>
                        <Input
                          type="number" min={0}
                          value={cond.minAmount ?? ""}
                          onChange={(e) => setDraft(item.id, {
                            conditions: { ...cond, minAmount: e.target.value === "" ? undefined : Number(e.target.value) }
                          })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">حداکثر مبلغ سفارش (تومان)</Label>
                        <Input
                          type="number" min={0}
                          value={cond.maxAmount ?? ""}
                          onChange={(e) => setDraft(item.id, {
                            conditions: { ...cond, maxAmount: e.target.value === "" ? undefined : Number(e.target.value) }
                          })}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      اگر مبلغ سفارش خارج از بازه تعیین‌شده باشد، این پیامک ارسال نخواهد شد.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Smartphone className="h-3.5 w-3.5" />پیش‌نمایش روی موبایل
              </Label>
              <MobilePreview text={previewText(m)} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
            <span className="text-[11px] text-muted-foreground">
              آخرین ویرایش: {new Date(item.updated_at).toLocaleString("fa-IR")}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => resetToDefault(item)}>
                <RotateCcw className="h-4 w-4 ml-1" />بازنشانی به پیش‌فرض
              </Button>
              {dirty && (
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setDrafts((d) => { const c = { ...d }; delete c[item.id]; return c; })}
                >لغو</Button>
              )}
              <Button size="sm" disabled={!dirty || saving === item.id} onClick={() => save(item)}>
                {saving === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                ذخیره
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            مدیریت پیامک‌ها
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            متن، شرط‌ها و تأخیر ارسال پیامک‌ها به مشتری و مدیرعامل را کنترل کنید. پابرگ <code className="font-mono">ahrom.ir</code> در همه پیامک‌ها اجباری است.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={"h-4 w-4 ml-1 " + (loading ? "animate-spin" : "")} />
          بارگذاری مجدد
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">ارسال موفق امروز</p>
              <p className="text-2xl font-bold text-green-600">{stats.sentToday.toLocaleString("fa-IR")}</p>
            </div>
            <Send className="h-8 w-8 text-green-500/60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">ناموفق امروز</p>
              <p className="text-2xl font-bold text-rose-600">{stats.failedToday.toLocaleString("fa-IR")}</p>
            </div>
            <XCircle className="h-8 w-8 text-rose-500/60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">کل تلاش‌های امروز</p>
              <p className="text-2xl font-bold">{stats.total.toLocaleString("fa-IR")}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">موجودی پنل پیامکی</p>
                <p className="text-lg font-bold">
                  {walletBalance ?? <span className="text-muted-foreground text-sm">—</span>}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-primary/60" />
            </div>
            <Button
              size="sm" variant="ghost" className="w-full mt-2 h-7 text-xs"
              onClick={fetchWalletBalance} disabled={walletLoading}
            >
              {walletLoading ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : null}
              استعلام موجودی
            </Button>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="customer" className="w-full">
          <TabsList>
            <TabsTrigger value="customer">پیامک‌های مشتری ({groups.customer?.length || 0})</TabsTrigger>
            <TabsTrigger value="ceo">پیامک‌های مدیرعامل ({groups.ceo?.length || 0})</TabsTrigger>
            <TabsTrigger value="logs">گزارش ارسال ({logs.length})</TabsTrigger>
            <TabsTrigger value="queue">در انتظار ارسال ({queue.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="queue" className="mt-4">
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">پیامک‌های در انتظار ارسال</CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={refreshQueue}>
                  <RefreshCw className="h-3.5 w-3.5 ml-1" /> بارگذاری مجدد
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <p className="text-xs text-muted-foreground mb-3">
                  پیامک‌های ناموفق به‌صورت خودکار با یک زمان تصادفی بین ۵ تا ۱۲۰ ثانیه دوباره ارسال می‌شوند (حداکثر ۵ تلاش).
                  در صورت انصراف می‌توانید ارسال را لغو کنید.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان ارسال</TableHead>
                      <TableHead>گیرنده</TableHead>
                      <TableHead>کلید</TableHead>
                      <TableHead>کد سفارش</TableHead>
                      <TableHead className="min-w-[260px]">متن پیامک</TableHead>
                      <TableHead>تلاش</TableHead>
                      <TableHead>آخرین خطا</TableHead>
                      <TableHead>لغو</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        پیامکی در انتظار ارسال نیست.
                      </TableCell></TableRow>
                    )}
                    {queue.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(row.send_after).toLocaleString("fa-IR")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.phone}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-[10px]">{row.status_key}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{row.order_code || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap max-w-[320px]" title={getQueueMessage(row)}>
                          {getQueueMessage(row) || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {Number(row.payload?.retryCount ?? 0) > 0
                            ? `تلاش مجدد ${row.payload?.retryCount}`
                            : "اولین ارسال"}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate" title={row.last_error || ""}>
                          {row.last_error || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs whitespace-nowrap"
                            disabled={canceling === row.id}
                            onClick={() => cancelScheduled(row)}
                          >
                            {canceling === row.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <XCircle className="h-3.5 w-3.5 ml-1" />}
                            لغو ارسال
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer" className="space-y-3 mt-4">
            {(groups.customer || []).map(renderItem)}
            {(!groups.customer || groups.customer.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">قالبی یافت نشد.</p>
            )}
          </TabsContent>
          <TabsContent value="ceo" className="space-y-3 mt-4">
            {(groups.ceo || []).map(renderItem)}
            {(!groups.ceo || groups.ceo.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">قالبی یافت نشد.</p>
            )}
          </TabsContent>
          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">آخرین ارسال‌ها</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان</TableHead>
                      <TableHead>گیرنده</TableHead>
                      <TableHead>کلید</TableHead>
                      <TableHead>کد سفارش</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="min-w-[260px]">متن پیامک</TableHead>
                      <TableHead>پاسخ سرویس‌دهنده</TableHead>
                      <TableHead>ارسال مجدد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        گزارشی ثبت نشده است.
                      </TableCell></TableRow>
                    )}
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("fa-IR")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.recipient}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-[10px]">{l.template_key}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{l.order_code || "—"}</TableCell>
                        <TableCell>
                          {l.status === "sent" && <Badge className="bg-green-600 hover:bg-green-600">ارسال شد</Badge>}
                          {l.status === "failed" && <Badge variant="destructive">ناموفق</Badge>}
                          {l.status === "skipped" && <Badge variant="secondary">رد شد</Badge>}
                        </TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap max-w-[320px]">{l.message}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate" title={l.provider_response || ""}>
                          {l.provider_response || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs whitespace-nowrap"
                            disabled={resending === l.id || !l.message}
                            onClick={() => resendLog(l)}
                          >
                            {resending === l.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RotateCcw className="h-3.5 w-3.5 ml-1" />}
                            ارسال مجدد
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
