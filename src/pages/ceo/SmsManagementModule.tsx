import { useEffect, useMemo, useRef, useState } from "react";
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
import { BaleMessengerTab } from "@/components/ceo/BaleMessengerTab";
import { SmsCustomVariablesTab, SAMPLE_SMS_SNAPSHOT, type SmsCustomVariableRow } from "@/components/ceo/SmsCustomVariablesTab";
import { applySmsCustomVariables } from "../../../supabase/functions/_shared/smsCustomVariables";
import {
  findServiceConflicts, isGeneralTemplate, makeVariantKey, selectSmsTemplate, stageOf, targetsOf,
} from "../../../supabase/functions/_shared/smsTemplateSelection";
import { SmsCustomFramesTab, setFrameDisplayTab, type CustomFrameRow } from "@/components/ceo/SmsCustomFramesTab";
import {
  CUSTOM_FRAME_STAGES, FRAME_STAGE_GROUP_LABELS, customFrameStage, customFrameStageLabel, describeRecipients,
} from "../../../supabase/functions/_shared/smsCustomFrames";
import { applyEventVariables, eventVariablesFor, sampleEventVars } from "../../../supabase/functions/_shared/smsOrderEvents";
import { FRAME_DISPLAY_TAB_LABELS, resolveFrameTab } from "@/lib/smsFrameTabs";
import { SmsServiceList, SmsServicePicker, serviceLabel, type SmsServiceOption } from "@/components/ceo/SmsServicePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, MessageSquare, Save, RefreshCw, Smartphone, Send, AlertCircle,
  CheckCircle2, XCircle, Lock, RotateCcw, Wallet, Clock, Settings2,
  Search, X, Layers, Globe2, Plus, Trash2, Filter, AlertTriangle,
  MessageSquarePlus, Users, ArrowLeftRight, Pencil,
} from "lucide-react";

const SAMPLE_EVENT_VARS = sampleEventVars();

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
  stage_key: string;
  service_subcategory_ids: string[];
  excluded_subcategory_ids: string[];
  recipient_kinds?: string[] | null;
  recipient_roles?: string[] | null;
  recipient_phones?: string[] | null;
  display_tab?: string | null;
}

type TplKindFilter = "all" | "general" | "specific" | "frames";

const isFrame = (t: SmsTemplate) => t.scope === "custom";
type TplStatusFilter = "all" | "enabled" | "disabled";

interface SmsLog {
  id: string;
  recipient: string;
  message: string;
  status: string;
  template_key: string | null;
  order_code: string | null;
  provider_response: string | null;
  created_at: string;
  attempts?: number | null;
  last_attempt_at?: string | null;
  customer_name?: string | null;
  address?: string | null;
  detailed_address?: string | null;
  subcategory_id?: string | null;
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
  { token: "{rentalStartDate}", label: "تاریخ شروع کرایه" },
  { token: "{executionDate}", label: "تاریخ اجرای سفارش" },
  { token: "{collectionDate}", label: "تاریخ درخواست جمع‌آوری" },
  { token: "{completionDate}", label: "تاریخ اتمام سفارش" },
  { token: "{paymentDate}", label: "تاریخ واریز آخرین پرداخت (همان تاریخی که در ثبت پرداخت انتخاب شده)" },
  { token: "{paidAmount}", label: "مبلغ همین پرداخت" },
  { token: "{totalPaid}", label: "مجموع پرداخت‌شده" },
  { token: "{remainingAmount}", label: "مانده سفارش" },

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
  const [customVars, setCustomVars] = useState<SmsCustomVariableRow[]>([]);
  const [queuePreviews, setQueuePreviews] = useState<Record<string, { message?: string; note?: string }>>({});
  const [queuePreviewLoading, setQueuePreviewLoading] = useState(false);
  const requestedPreviewIds = useRef<Set<string>>(new Set());
  const [services, setServices] = useState<SmsServiceOption[]>([]);
  const [tplKind, setTplKind] = useState<TplKindFilter>("all");
  const [tplService, setTplService] = useState<string>("all");
  const [tplStatus, setTplStatus] = useState<TplStatusFilter>("all");
  const [tplSearch, setTplSearch] = useState("");
  const [variantBase, setVariantBase] = useState<SmsTemplate | null>(null);
  const [variantServices, setVariantServices] = useState<string[]>([]);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [logService, setLogService] = useState<string>("all");
  // تب فعال پس از بارگذاری مجدد (مثلاً بعد از ذخیره قاب) حفظ می‌شود
  const [activeTab, setActiveTab] = useState("customer");
  // درخواست باز کردن ویرایش کامل قاب (گیرندگان و مرحله) از تب مشتری/مدیریت
  const [frameEditRequest, setFrameEditRequest] = useState<string | null>(null);
  const [frameReturnTab, setFrameReturnTab] = useState<string | null>(null);

  const loadServices = async () => {
    const { data } = await supabase
      .from("subcategories")
      .select("id, name, is_active, sort_order, service_types_v3:service_type_id(name, sort_order)")
      .order("sort_order");
    const rows = ((data || []) as any[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      // نوع خدمتِ غیرفعال برای نقش‌های غیر مدیرعامل قابل خواندن نیست
      typeName: (r.service_types_v3?.name as string) || "خدمات غیرفعال در سایت",
      active: r.is_active !== false && !!r.service_types_v3,
      typeSort: Number(r.service_types_v3?.sort_order ?? 999),
      sort: Number(r.sort_order ?? 999),
    }));
    rows.sort((a, b) => a.typeSort - b.typeSort || a.typeName.localeCompare(b.typeName, "fa") || a.sort - b.sort);
    setServices(rows.map(({ typeSort, sort, ...r }) => r));
  };
  useEffect(() => { loadServices(); }, []);
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const loadCustomVars = async () => {
    const { data, error } = await supabase.from("sms_custom_variables").select("*").order("created_at");
    if (!error) setCustomVars((data || []) as SmsCustomVariableRow[]);
  };
  useEffect(() => { loadCustomVars(); }, []);

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
          // ارسال مجدد پیام ناموفق همان ردیف را به‌روز می‌کند و ردیف تکراری نمی‌سازد
          ...(l.status === "failed" ? { logId: l.id } : {}),
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
    if (!logsRes.error) {
      const rawLogs = (logsRes.data || []) as any[];
      const orderCodes = rawLogs.map((l) => l.order_code).filter(Boolean);
      let projectByCode: Record<string, { customer_name?: string | null; address?: string | null; detailed_address?: string | null; subcategory_id?: string | null }> = {};
      if (orderCodes.length) {
        const { data: projects } = await supabase
          .from("projects_v3")
          .select("code, customer_name, address, detailed_address, subcategory_id")
          .in("code", orderCodes);
        (projects || []).forEach((p: any) => {
          if (p.code) projectByCode[p.code] = p;
        });
      }
      setLogs(rawLogs.map((l) => ({
        ...l,
        customer_name: l.order_code ? projectByCode[l.order_code]?.customer_name || null : null,
        address: l.order_code ? projectByCode[l.order_code]?.address || null : null,
        detailed_address: l.order_code ? projectByCode[l.order_code]?.detailed_address || null : null,
        subcategory_id: l.order_code ? projectByCode[l.order_code]?.subcategory_id || null : null,
      })) as SmsLog[]);
    }
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
    const rows = (data || []) as unknown as ScheduledSms[];
    if (!error) setQueue(rows);
    return error ? [] : rows;
  };

  useEffect(() => { load(); }, []);

  // به‌روزرسانی خودکار صف ارسال (برای دیدن تلاش‌های مجدد رندوم)
  useEffect(() => {
    const t = setInterval(() => { refreshQueue(); }, 20000);
    return () => clearInterval(t);
  }, []);

  const getQueueMessage = (row: ScheduledSms): string => {
    const p = row.payload || {};
    return queuePreviews[row.id]?.message || p.message || p.text || p.body || p.resendMessage || "";
  };

  // متن نهایی پیامک‌های در صف (همان متنی که هنگام ارسال ساخته می‌شود) از سرور گرفته می‌شود
  const loadQueuePreviews = async (rows: ScheduledSms[], force = false) => {
    const ids = rows
      .map((r) => r.id)
      .filter((id) => force || !requestedPreviewIds.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => requestedPreviewIds.current.add(id));
    setQueuePreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-order-sms", {
        body: { previewScheduledIds: ids },
      });
      if (error) throw error;
      const previews = ((data as any)?.previews || {}) as Record<string, { message?: string; note?: string }>;
      setQueuePreviews((prev) => ({ ...prev, ...previews }));
    } catch {
      ids.forEach((id) => requestedPreviewIds.current.delete(id));
    } finally {
      setQueuePreviewLoading(false);
    }
  };

  useEffect(() => { loadQueuePreviews(queue); }, [queue]);


  const merged = (item: SmsTemplate): SmsTemplate => ({ ...item, ...(drafts[item.id] || {}) });
  const setDraft = (id: string, patch: Partial<SmsTemplate>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const previewText = (item: SmsTemplate) => {
    const m = merged(item);
    const sampleService = serviceById.get(targetsOf(m)[0] || (tplService !== "all" ? tplService : ""))?.name || "داربست نما";
    const body = (m.template || "")
      .replace(/\{code\}/g, "1000123")
      .replace(/\{serviceType\}/g, `${sampleService} (ثبت شد)`)
      .replace(/\{address\}/g, "تهران، خیابان نمونه")
      .replace(/\{customerName\}/g, "علی رضایی")
      .replace(/\{dateTime\}/g, "1404/04/08 ساعت 14:30")
      .replace(/\{amount\}/g, "۲٬۵۰۰٬۰۰۰")
      .replace(/\{orderLink\}/g, "https://ahrom.ir/orders/123")
      .replace(/\{description\}/g, "اجرای داربست نما ۱۲ متر طول × ۶ متر ارتفاع")
      .replace(/\{paymentLink\}/g, "https://ahrom.ir/user/orders/123?pay=1")
      .replace(/\{rentalStartDate\}/g, "1405/07/20")
      .replace(/\{executionDate\}/g, "1405/07/20")
      .replace(/\{collectionDate\}/g, "1405/09/20")
      .replace(/\{completionDate\}/g, "1405/09/22")
      .replace(/\{paymentDate\}/g, "1405/08/12")
      .replace(/\{paidAmount\}/g, "۵٬۰۰۰٬۰۰۰ تومان")
      .replace(/\{totalPaid\}/g, "۱۵٬۰۰۰٬۰۰۰ تومان")
      .replace(/\{remainingAmount\}/g, "۱۰٬۰۰۰٬۰۰۰ تومان");
    const bodyWithCustom = applySmsCustomVariables(
      isFrame(m) ? applyEventVariables(body, SAMPLE_EVENT_VARS) : body, customVars, SAMPLE_SMS_SNAPSHOT,
    );

    const footer = (m.footer || BRAND_FOOTER).trim() || BRAND_FOOTER;
    const header = "خدمات ساختمانی و منزل اهرم";
    const withHeader = bodyWithCustom.startsWith(header) ? bodyWithCustom : `${header}\n${bodyWithCustom}`;
    return withHeader + (m.append_footer ? `\n${footer}` : "") + (!withHeader.includes("ahrom.ir") && !m.append_footer ? `\n${BRAND_FOOTER}` : "");
  };

  const save = async (item: SmsTemplate) => {
    const m = merged(item);
    if (isFrame(item)) {
      if (!(m.title || "").trim()) { toast.error("عنوان قاب را وارد کنید"); return; }
      if (!(m.template || "").trim()) { toast.error("متن پیام خالی است"); return; }
      const targets = targetsOf(m);
      setSaving(item.id);
      const { data, error } = await supabase.from("sms_templates").update({
        template: m.template,
        default_template: m.template,
        description: m.description,
        title: m.title.trim(),
        enabled: m.enabled,
        delay_minutes: Math.min(5, Math.max(0, Number(m.delay_minutes) || 0)),
        conditions: m.conditions || {},
        footer: (m.footer || BRAND_FOOTER).trim() || BRAND_FOOTER,
        append_footer: m.append_footer !== false,
        service_subcategory_ids: targets,
        excluded_subcategory_ids: targets.length ? [] : (m.excluded_subcategory_ids || []),
      }).eq("id", item.id).eq("scope", "custom").select("id");
      setSaving(null);
      if (error) { toast.error("خطا در ذخیره: " + error.message); return; }
      if (!data || data.length === 0) { toast.error("ذخیره انجام نشد — دسترسی مدیریت پیامک برای حساب شما وجود ندارد"); return; }
      toast.success("قاب پیام ذخیره شد");
      await load();
      return;
    }
    if (!isGeneralTemplate(item) && targetsOf(m).length === 0) {
      toast.error("برای پیام تخصصی حداقل یک خدمت انتخاب کنید (یا آن را حذف کنید)");
      return;
    }
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
      service_subcategory_ids: isGeneralTemplate(item) ? [] : targetsOf(m),
      excluded_subcategory_ids: isGeneralTemplate(item) ? (m.excluded_subcategory_ids || []) : [],
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


  // خدماتی که در هر مرحله قبلاً پیام تخصصی فعال دارند
  const takenByStage = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const t of items) {
      if (isFrame(t) || isGeneralTemplate(t) || !t.enabled) continue;
      const rec = map.get(stageOf(t)) || {};
      targetsOf(t).forEach((id) => { rec[id] = `پیام تخصصی «${t.title}» دارد`; });
      map.set(stageOf(t), rec);
    }
    return map;
  }, [items]);

  const conflicts = useMemo(() => findServiceConflicts(items.filter((t) => !isFrame(t))), [items]);

  const openVariantDialog = (base: SmsTemplate) => {
    setVariantBase(base);
    setVariantServices(tplService !== "all" && !takenByStage.get(stageOf(base))?.[tplService] ? [tplService] : []);
  };

  const createVariant = async () => {
    if (!variantBase || variantServices.length === 0) return;
    const base = merged(variantBase);
    const stage = stageOf(variantBase);
    const names = variantServices.map((id) => serviceById.get(id)?.name).filter(Boolean);
    const shortNames = names.length > 2 ? `${names.slice(0, 2).join("، ")} و ${names.length - 2} خدمت دیگر` : names.join("، ");
    const baseTitle = (variantBase.title || "").split(" — ")[0];
    setCreatingVariant(true);
    const { error } = await supabase.from("sms_templates").insert({
      key: makeVariantKey(stage),
      stage_key: stage,
      scope: variantBase.scope,
      title: `${baseTitle} — ${shortNames}`,
      description: `نسخه تخصصی «${baseTitle}» برای: ${names.join("، ")}`,
      template: base.template,
      default_template: variantBase.default_template || base.template,
      enabled: true,
      delay_minutes: Number(base.delay_minutes) || 0,
      conditions: base.conditions || {},
      footer: (base.footer || BRAND_FOOTER).trim() || BRAND_FOOTER,
      append_footer: base.append_footer !== false,
      service_subcategory_ids: variantServices,
      excluded_subcategory_ids: [],
    });
    setCreatingVariant(false);
    if (error) { toast.error("ساخت پیام تخصصی ناموفق بود: " + error.message); return; }
    toast.success("پیام تخصصی ساخته شد — متن آن را ویرایش و ذخیره کنید");
    setVariantBase(null);
    setTplKind("all");
    await load();
  };

  const deleteVariant = async (item: SmsTemplate) => {
    if (isGeneralTemplate(item)) return;
    if (!window.confirm(`پیام تخصصی «${item.title}» حذف شود؟ سفارش‌های این خدمات از این پس پیام عمومی همان مرحله را می‌گیرند.`)) return;
    setSaving(item.id);
    const { data, error } = await supabase.from("sms_templates").delete().eq("id", item.id).select("id");
    setSaving(null);
    if (error) { toast.error("خطا در حذف: " + error.message); return; }
    if (!data || data.length === 0) { toast.error("حذف انجام نشد — دسترسی کافی ندارید"); return; }
    toast.success("پیام تخصصی حذف شد");
    load();
  };

  // عنوان قاب‌های پیام سفارشی برای نمایش در گزارش ارسال و صف
  const frameTitleByKey = useMemo(
    () => new Map(items.filter((t) => t.scope === "custom").map((t) => [t.key, t.title])),
    [items],
  );
  const renderFramePreview = (template: string, serviceId?: string) => previewText({
    id: "__custom_frame__", key: "__custom_frame__", title: "", description: null, scope: "custom",
    template, default_template: null, enabled: true, delay_minutes: 0, conditions: {},
    footer: BRAND_FOOTER, append_footer: true, updated_at: "", stage_key: "",
    service_subcategory_ids: serviceId ? [serviceId] : [], excluded_subcategory_ids: [],
  });

  const groups: Record<string, SmsTemplate[]> = useMemo(() => {
    const g: Record<string, SmsTemplate[]> = { customer: [], ceo: [] };
    for (const it of items) (g[it.scope] || (g[it.scope] = [])).push(it);
    return g;
  }, [items]);

  // قاب‌هایی که به تب مشتری یا مدیریت اهرم برده شده‌اند (همچنان در تب قاب‌ها هم هستند)
  const framesByTab = useMemo(() => {
    const g: Record<string, SmsTemplate[]> = { customer: [], ceo: [] };
    for (const it of items) {
      if (!isFrame(it)) continue;
      const tab = resolveFrameTab(it.display_tab, it.recipient_kinds);
      if (tab) g[tab].push(it);
    }
    return g;
  }, [items]);

  const openFrameFullEditor = (item: SmsTemplate) => {
    setFrameReturnTab(activeTab);
    setFrameEditRequest(item.id);
    setActiveTab("custom-frames");
  };

  const moveFrame = async (item: SmsTemplate, tab: "customer" | "ceo" | null) => {
    setSaving(item.id);
    const ok = await setFrameDisplayTab(item.id, tab);
    setSaving(null);
    if (ok) await load();
  };

  const deleteFrame = async (item: SmsTemplate) => {
    if (!window.confirm(`قاب پیام «${item.title}» حذف شود؟ از این پس این پیام ارسال نمی‌شود.`)) return;
    setSaving(item.id);
    const { data, error } = await supabase.from("sms_templates").delete().eq("id", item.id).eq("scope", "custom").select("id");
    setSaving(null);
    if (error || !data?.length) { toast.error("حذف انجام نشد" + (error ? ": " + error.message : " — دسترسی کافی ندارید")); return; }
    toast.success("قاب پیام حذف شد");
    await load();
  };

  // پیام‌های ناموفقی که تلاش مجدد خودکارشان هنوز در صف است
  const retryingLogIds = useMemo(
    () => new Set(queue.map((q) => q.payload?.logId).filter((v): v is string => typeof v === "string")),
    [queue],
  );

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim();
    const byService = logService === "all" ? logs : logs.filter((l) => l.subcategory_id === logService);
    if (!q) return byService;
    const lower = q.toLowerCase();
    return byService.filter((l) => {
      const fullAddress = [l.address, l.detailed_address].filter(Boolean).join(" ");
      return [
        l.recipient,
        l.customer_name,
        fullAddress,
        l.message,
        l.order_code,
        l.template_key,
        l.provider_response,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(lower));
    });
  }, [logs, logSearch, logService]);

  const filteredQueue = useMemo(() => {
    const q = queueSearch.trim();
    if (!q) return queue;
    const lower = q.toLowerCase();
    return queue.filter((r) => {
      const p = r.payload || {};
      const payloadText = [queuePreviews[r.id]?.message, p.message, p.text, p.body, p.customerName, p.address, p.description].filter(Boolean).join(" ");
      return [
        r.phone,
        r.order_code,
        r.status_key,
        payloadText,
        r.last_error,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(lower));
    });
  }, [queue, queueSearch, queuePreviews]);

  const renderItem = (item: SmsTemplate) => {
    if (isFrame(item)) return renderFrameItem(item);
    const m = merged(item);
    const dirty = !!drafts[item.id];
    const cond = (m.conditions || {}) as Record<string, any>;
    const general = isGeneralTemplate(item);
    const stage = stageOf(item);
    const stageTaken = takenByStage.get(stage) || {};
    const specificServicesOfStage = Object.keys(stageTaken);
    const ownTargets = targetsOf(m);
    const blockedForThis: Record<string, string> = {};
    Object.entries(stageTaken).forEach(([id, why]) => { if (!targetsOf(item).includes(id)) blockedForThis[id] = why; });
    const conflictNames = ownTargets.filter((id) => (conflicts.get(`${stage}|${id}`) || []).length > 1)
      .map((id) => serviceById.get(id)?.name).filter(Boolean);
    const overriddenHere = general && tplService !== "all" && !!stageTaken[tplService];
    const excludedHere = general && tplService !== "all" && (m.excluded_subcategory_ids || []).includes(tplService);
    return (
      <Card key={item.id} className={dirty ? "border-amber-400 shadow-md" : "shadow-sm"}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <MessageSquare className="h-4 w-4 text-primary" />
                {m.title}
                <Badge variant="outline" className="text-xs font-mono">{stage}</Badge>
                {general ? (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <Globe2 className="h-3 w-3" />عمومی · همه خدمات
                    {(m.excluded_subcategory_ids || []).length > 0 && ` (به‌جز ${(m.excluded_subcategory_ids || []).length.toLocaleString("fa-IR")} خدمت)`}
                  </Badge>
                ) : (
                  <Badge className="gap-1 text-[11px]">
                    <Layers className="h-3 w-3" />تخصصی · {ownTargets.length.toLocaleString("fa-IR")} خدمت
                  </Badge>
                )}
                {overriddenHere && <Badge variant="outline" className="text-[11px]">برای این خدمت، پیام تخصصی جایگزین است</Badge>}
                {excludedHere && <Badge variant="destructive" className="text-[11px]">این خدمت استثنا شده است</Badge>}
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
                  {customVars.filter((v) => v.enabled).map((v) => (
                    <Button
                      key={v.id}
                      type="button" size="sm" variant="secondary" className="h-7 text-xs border border-primary/40"
                      title={`المان سفارشی: ${v.label}`}
                      onClick={() => setDraft(item.id, { template: (m.template || "") + " {" + v.token + "}" })}
                    >
                      {`{${v.token}}`}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-5 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  متن باید مطابق الگوی تایید شده پارس‌گرین باشد تا فیلتر نشود. تغییرات عمده ممکن است نیاز به تایید مجدد الگو داشته باشند.
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" />خدماتی که این پیام برای سفارش‌هایشان ارسال می‌شود
                </Label>
                {general ? (
                  <>
                    <p className="text-[11px] text-muted-foreground leading-5">
                      این پیام عمومی است و برای سفارش همه خدمات ارسال می‌شود؛ مگر خدماتی که در همین مرحله پیام تخصصی دارند یا در زیر استثنا شده‌اند.
                    </p>
                    {specificServicesOfStage.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="text-muted-foreground">دارای پیام تخصصی:</span>
                        {specificServicesOfStage.map((id) => (
                          <Badge key={id} variant="outline" className="font-normal text-[11px]">{serviceLabel(serviceById.get(id))}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-[200px]">
                        <SmsServicePicker
                          services={services}
                          value={m.excluded_subcategory_ids || []}
                          onChange={(ids) => setDraft(item.id, { excluded_subcategory_ids: ids })}
                          placeholder="استثنا کردن خدمات (این پیام را نگیرند)"
                          tone="exclude"
                        />
                      </div>
                      <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={() => openVariantDialog(item)}>
                        <Plus className="h-3.5 w-3.5 ml-1" />افزودن پیام تخصصی برای خدمات
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <SmsServicePicker
                      services={services}
                      value={ownTargets}
                      onChange={(ids) => setDraft(item.id, { service_subcategory_ids: ids })}
                      blocked={blockedForThis}
                      placeholder="انتخاب خدمات این پیام"
                    />
                    {ownTargets.length === 0 && (
                      <p className="text-[11px] text-destructive">حداقل یک خدمت انتخاب کنید.</p>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-5">
                      سفارش‌های این خدمات در مرحله «{stage}» به‌جای پیام عمومی این متن را دریافت می‌کنند. اگر این پیام غیرفعال شود، پیام عمومی ارسال می‌شود.
                    </p>
                  </>
                )}
                {conflictNames.length > 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    خدمات «{conflictNames.join("، ")}» در بیش از یک پیام تخصصی این مرحله انتخاب شده‌اند؛ آخرین پیام ویرایش‌شده ارسال می‌شود.
                  </p>
                )}
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
            <div className="flex gap-2 flex-wrap">
              {!general && (
                <Button size="sm" variant="ghost" className="text-destructive" disabled={saving === item.id} onClick={() => deleteVariant(item)}>
                  <Trash2 className="h-4 w-4 ml-1" />حذف پیام تخصصی
                </Button>
              )}
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

  // قاب پیام سفارشی که به تب مشتری/مدیریت برده شده: همان کارت ویرایش پیامک‌های این تب + امکانات قاب
  const renderFrameItem = (item: SmsTemplate) => {
    const m = merged(item);
    const dirty = !!drafts[item.id];
    const cond = (m.conditions || {}) as Record<string, any>;
    const stageInfo = customFrameStage(item.stage_key);
    const targets = targetsOf(m);
    const recipients = describeRecipients(item as any);
    const tab = resolveFrameTab(item.display_tab, item.recipient_kinds);
    const otherTab = tab === "customer" ? "ceo" : "customer";
    const canOther = resolveFrameTab(otherTab, item.recipient_kinds) === otherTab;
    const addToken = (token: string) => setDraft(item.id, { template: (m.template || "") + " " + token });
    return (
      <Card key={item.id} className={(dirty ? "border-amber-400 shadow-md" : "shadow-sm") + " border-primary/30"}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px] space-y-1.5">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                {m.title}
                <Badge className="text-[11px] gap-1"><MessageSquarePlus className="h-3 w-3" />قاب پیام سفارشی</Badge>
                <Badge variant="outline" className="text-xs">{customFrameStageLabel(item.stage_key)}</Badge>
                {targets.length ? (
                  <Badge variant="secondary" className="gap-1 text-[11px]"><Layers className="h-3 w-3" />{targets.length.toLocaleString("fa-IR")} خدمت</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <Globe2 className="h-3 w-3" />همه خدمات
                    {(m.excluded_subcategory_ids || []).length > 0 && ` (به‌جز ${(m.excluded_subcategory_ids || []).length.toLocaleString("fa-IR")} خدمت)`}
                  </Badge>
                )}
                {!m.enabled && <Badge variant="destructive">غیرفعال</Badge>}
                {m.delay_minutes > 0 && (
                  <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{m.delay_minutes} دقیقه تأخیر</Badge>
                )}
                {cond.respectWindow === false && <Badge variant="secondary" className="text-[11px]">ارسال در هر ساعت</Badge>}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">گیرندگان:</span>
                {recipients.map((l) => <Badge key={l} variant="secondary" className="font-normal text-[11px]">{l}</Badge>)}
              </div>
              {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">فعال</Label>
              <Switch checked={!!m.enabled} disabled={saving === item.id} onCheckedChange={(v) => toggleEnabled(item, v)} />
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
                <Input value={m.description || ""} onChange={(e) => setDraft(item.id, { description: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  متن پیامک
                  <span className="text-[10px] text-muted-foreground">— متغیرها را با کلیک اضافه کنید</span>
                </Label>
                <Textarea dir="rtl" rows={4} value={m.template} onChange={(e) => setDraft(item.id, { template: e.target.value })} />
                <div className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">پابرگ اجباری برند:</span>
                  <code className="font-mono text-primary">{BRAND_FOOTER}</code>
                  <span className="text-muted-foreground">— به‌صورت خودکار در انتهای هر پیامک افزوده می‌شود</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {PLACEHOLDERS.map((p) => (
                    <Button key={p.token} type="button" size="sm" variant="outline" className="h-7 text-xs" title={p.label} onClick={() => addToken(p.token)}>{p.token}</Button>
                  ))}
                  {eventVariablesFor(stageInfo?.group).map((v) => (
                    <Button key={v.token} type="button" size="sm" variant="secondary" className="h-7 text-xs" title={v.label} onClick={() => addToken(v.token)}>{v.token}</Button>
                  ))}
                  {customVars.filter((v) => v.enabled).map((v) => (
                    <Button key={v.id} type="button" size="sm" variant="secondary" className="h-7 text-xs border border-primary/40" title={`المان سفارشی: ${v.label}`} onClick={() => addToken("{" + v.token + "}")}>{`{${v.token}}`}</Button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" />خدماتی که این قاب برای سفارش‌هایشان ارسال می‌شود
                </Label>
                <SmsServicePicker
                  services={services}
                  value={targets}
                  onChange={(ids) => setDraft(item.id, { service_subcategory_ids: ids })}
                  placeholder="همه خدمات (برای محدود کردن، خدمات را انتخاب کنید)"
                />
                {targets.length === 0 && (
                  <SmsServicePicker
                    services={services}
                    value={m.excluded_subcategory_ids || []}
                    onChange={(ids) => setDraft(item.id, { excluded_subcategory_ids: ids })}
                    placeholder="استثنا کردن خدمات (این قاب را نگیرند)"
                    tone="exclude"
                  />
                )}
                <p className="text-[11px] text-muted-foreground leading-5">
                  این قاب علاوه بر پیامک پیش‌فرض مرحله «{customFrameStageLabel(item.stage_key)}» ارسال می‌شود و هر رویداد برای هر گیرنده فقط یک بار پیام می‌فرستد.
                </p>
              </div>

              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <Label className="text-xs flex items-center gap-1"><MessageSquarePlus className="h-3.5 w-3.5" />امکانات قاب</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={() => openFrameFullEditor(item)}>
                    <Pencil className="h-3.5 w-3.5 ml-1" />ویرایش گیرندگان و مرحله
                  </Button>
                  {canOther && (
                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={saving === item.id} onClick={() => moveFrame(item, otherTab)}>
                      <ArrowLeftRight className="h-3.5 w-3.5 ml-1" />بردن به تب {FRAME_DISPLAY_TAB_LABELS[otherTab]}
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled={saving === item.id} onClick={() => moveFrame(item, null)}>
                    <RotateCcw className="h-3.5 w-3.5 ml-1" />برگرداندن به تب قاب‌ها
                  </Button>
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="adv" className="border rounded-md">
                  <AccordionTrigger className="px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" />تنظیمات پیشرفته (شرط‌ها، ساعت و تأخیر)</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-3">
                    <label className="flex items-center justify-between gap-2 text-xs">
                      <span>فقط در ساعات مجاز ارسال پیامک بفرست (خارج از آن، در صف می‌ماند)</span>
                      <Switch checked={cond.respectWindow !== false} onCheckedChange={(v) => setDraft(item.id, { conditions: { ...cond, respectWindow: v } })} />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">تأخیر ارسال (۰ تا ۵ دقیقه)</Label>
                        <Input type="number" min={0} max={5} value={m.delay_minutes ?? 0}
                          onChange={(e) => setDraft(item.id, { delay_minutes: Math.min(5, Math.max(0, Number(e.target.value) || 0)) })} />
                      </div>
                      <div>
                        <Label className="text-xs">حداقل مبلغ سفارش (تومان)</Label>
                        <Input type="number" min={0} value={cond.minAmount ?? ""}
                          onChange={(e) => setDraft(item.id, { conditions: { ...cond, minAmount: e.target.value === "" ? undefined : Number(e.target.value) } })} />
                      </div>
                      <div>
                        <Label className="text-xs">حداکثر مبلغ سفارش (تومان)</Label>
                        <Input type="number" min={0} value={cond.maxAmount ?? ""}
                          onChange={(e) => setDraft(item.id, { conditions: { ...cond, maxAmount: e.target.value === "" ? undefined : Number(e.target.value) } })} />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" />پیش‌نمایش روی موبایل</Label>
              <MobilePreview text={previewText(m)} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
            <span className="text-[11px] text-muted-foreground">آخرین ویرایش: {new Date(item.updated_at).toLocaleString("fa-IR")}</span>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="ghost" className="text-destructive" disabled={saving === item.id} onClick={() => deleteFrame(item)}>
                <Trash2 className="h-4 w-4 ml-1" />حذف قاب
              </Button>
              {dirty && (
                <Button size="sm" variant="ghost" onClick={() => setDrafts((d) => { const c = { ...d }; delete c[item.id]; return c; })}>لغو</Button>
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

  const stageTitle = (scoped: SmsTemplate[], stage: string) => {
    const g = scoped.find((t) => stageOf(t) === stage && isGeneralTemplate(t)) || scoped.find((t) => stageOf(t) === stage);
    return (g?.title || stage).split(" — ")[0];
  };

  const renderTemplateList = (scope: string) => {
    const scoped = items.filter((t) => t.scope === scope);
    const stages = [...new Set(scoped.filter(isGeneralTemplate).map(stageOf)), ...new Set(scoped.map(stageOf))]
      .filter((v, i, a) => a.indexOf(v) === i);
    const q = tplSearch.trim();
    const visible = scoped.filter((t) => {
      const m = merged(t);
      const gen = isGeneralTemplate(t);
      if (tplKind === "general" && !gen) return false;
      if (tplKind === "specific" && gen) return false;
      if (tplStatus === "enabled" && !m.enabled) return false;
      if (tplStatus === "disabled" && m.enabled) return false;
      if (tplService !== "all") {
        if (gen && (m.excluded_subcategory_ids || []).includes(tplService) && tplKind !== "general") return false;
        if (!gen && !targetsOf(t).includes(tplService)) return false;
      }
      if (q && ![m.title, m.template, m.description, stageOf(t)].filter(Boolean).some((v) => String(v).includes(q))) return false;
      return true;
    });
    const tabFrames = framesByTab[scope] || [];
    const visibleFrames = tabFrames.filter((t) => {
      const m = merged(t);
      if (tplKind === "general" || tplKind === "specific") return false;
      if (tplStatus === "enabled" && !m.enabled) return false;
      if (tplStatus === "disabled" && m.enabled) return false;
      if (tplService !== "all") {
        const targets = targetsOf(m);
        if (targets.length > 0 && !targets.includes(tplService)) return false;
        if ((m.excluded_subcategory_ids || []).includes(tplService)) return false;
      }
      if (q && ![m.title, m.template, m.description, customFrameStageLabel(t.stage_key), ...describeRecipients(t as any)]
        .filter(Boolean).some((v) => String(v).includes(q))) return false;
      return true;
    });
    const stageOrder = (k: string) => {
      const i = CUSTOM_FRAME_STAGES.findIndex((s) => s.key === k);
      return i < 0 ? 999 : i;
    };
    const extraFrameStages = [...new Set(visibleFrames.map((f) => f.stage_key))]
      .filter((k) => !stages.includes(k))
      .sort((a, b) => stageOrder(a) - stageOrder(b));
    const enabledFramesForStage = (st: string) => tabFrames.filter((f) => {
      if (f.stage_key !== st || !f.enabled) return false;
      const targets = targetsOf(f);
      if (targets.length > 0 && !targets.includes(tplService)) return false;
      return !(f.excluded_subcategory_ids || []).includes(tplService);
    }).length;
    const specificCount = scoped.filter((t) => !isGeneralTemplate(t)).length;
    const coveredServices = new Set(scoped.filter((t) => !isGeneralTemplate(t) && t.enabled).flatMap(targetsOf));
    const filtersActive = tplKind !== "all" || tplService !== "all" || tplStatus !== "all" || !!q;

    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
                {([
                  ["all", "همه پیام‌ها", MessageSquare],
                  ["general", "پیام‌های عمومی سایت", Globe2],
                  ["specific", "پیام‌های تخصصی خدمات", Layers],
                  ...(tabFrames.length > 0 ? [["frames", `قاب‌های سفارشی (${tabFrames.length.toLocaleString("fa-IR")})`, MessageSquarePlus] as const] : []),
                ] as const).map(([k, label, Icon]) => (
                  <Button
                    key={k} type="button" size="sm" className="h-8 text-xs gap-1"
                    variant={tplKind === k ? "default" : "ghost"}
                    onClick={() => setTplKind(k)}
                  >
                    <Icon className="h-3.5 w-3.5" />{label}
                  </Button>
                ))}
              </div>
              <Select value={tplService} onValueChange={setTplService}>
                <SelectTrigger className="h-9 w-[260px] text-xs"><SelectValue placeholder="نوع خدمت" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه خدمات</SelectItem>
                  {services.map((sv) => (
                    <SelectItem key={sv.id} value={sv.id} className="text-xs">{serviceLabel(sv)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tplStatus} onValueChange={(v) => setTplStatus(v as TplStatusFilter)}>
                <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="enabled">فقط فعال</SelectItem>
                  <SelectItem value="disabled">فقط غیرفعال</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-9 pr-9 text-xs" placeholder="جستجو در عنوان و متن پیام..." value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} />
              </div>
              {filtersActive && (
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setTplKind("all"); setTplService("all"); setTplStatus("all"); setTplSearch(""); }}>
                  <X className="h-3.5 w-3.5 ml-1" />حذف فیلترها
                </Button>
              )}
            </div>

            {tplService === "all" ? (
              <p className="text-[11px] text-muted-foreground">
                {scoped.filter(isGeneralTemplate).length.toLocaleString("fa-IR")} پیام عمومی ·{" "}
                {specificCount.toLocaleString("fa-IR")} پیام تخصصی ·{" "}
                {coveredServices.size.toLocaleString("fa-IR")} خدمت دارای پیام اختصاصی
                {tabFrames.length > 0 && ` · ${tabFrames.length.toLocaleString("fa-IR")} قاب پیام سفارشی`}.
                برای دیدن اینکه مشتریان هر خدمت در هر مرحله کدام پیام را می‌گیرند، یک خدمت را انتخاب کنید.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">
                  پیام‌هایی که مشتریان «{serviceLabel(serviceById.get(tplService))}» در هر مرحله دریافت می‌کنند:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {stages.map((st) => {
                    const r = selectSmsTemplate(scoped.map(merged), st, tplService);
                    const title = stageTitle(scoped, st);
                    const nf = enabledFramesForStage(st);
                    const extra = nf ? ` + ${nf.toLocaleString("fa-IR")} قاب` : "";
                    if (r.kind === "specific") return <Badge key={st} className="text-[11px] font-normal gap-1"><Layers className="h-3 w-3" />{title}: تخصصی{extra}</Badge>;
                    if (r.kind === "general") return <Badge key={st} variant="secondary" className="text-[11px] font-normal gap-1"><Globe2 className="h-3 w-3" />{title}: عمومی{extra}</Badge>;
                    return <Badge key={st} variant={nf ? "outline" : "destructive"} className="text-[11px] font-normal">{title}: {nf ? `فقط ${nf.toLocaleString("fa-IR")} قاب` : "ارسال نمی‌شود"}</Badge>;
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {stages.map((st) => {
          const list = (tplKind === "frames" ? [] : visible.filter((t) => stageOf(t) === st))
            .sort((a, b) => Number(!isGeneralTemplate(a)) - Number(!isGeneralTemplate(b)));
          const frameList = visibleFrames.filter((f) => f.stage_key === st);
          if (list.length === 0 && frameList.length === 0) return null;
          return (
            <div key={st} className="space-y-3">
              {list.map(renderItem)}
              {frameList.map(renderFrameItem)}
            </div>
          );
        })}
        {extraFrameStages.map((st) => {
          const info = customFrameStage(st);
          return (
            <div key={st} className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 pt-2">
                <MessageSquarePlus className="h-3.5 w-3.5" />
                {info ? `${FRAME_STAGE_GROUP_LABELS[info.group]} · ${info.label}` : customFrameStageLabel(st)}
              </p>
              {visibleFrames.filter((f) => f.stage_key === st).map(renderFrameItem)}
            </div>
          );
        })}
        {(tplKind === "frames" ? 0 : visible.length) + visibleFrames.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {filtersActive ? "پیامی با این فیلترها یافت نشد." : "قالبی یافت نشد."}
          </p>
        )}
      </div>
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
            متن، شرط‌ها و تأخیر ارسال پیامک‌ها به مشتری و مدیریت اهرم را کنترل کنید. پابرگ <code className="font-mono">ahrom.ir</code> در همه پیامک‌ها اجباری است.
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="customer">پیامک‌های مشتری ({(groups.customer?.length || 0) + framesByTab.customer.length})</TabsTrigger>
            <TabsTrigger value="ceo">پیامک‌های مدیریت اهرم ({(groups.ceo?.length || 0) + framesByTab.ceo.length})</TabsTrigger>
            <TabsTrigger value="custom-frames">قاب‌های پیام سفارشی ({groups.custom?.length || 0})</TabsTrigger>
            <TabsTrigger value="logs">گزارش ارسال ({logs.length})</TabsTrigger>
            <TabsTrigger value="queue">در انتظار ارسال ({queue.length})</TabsTrigger>
            <TabsTrigger value="bale">پیامرسان بله</TabsTrigger>
            <TabsTrigger value="custom-vars">المان‌های سفارشی ({customVars.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="custom-frames" className="mt-4">
            <SmsCustomFramesTab
              frames={(groups.custom || []) as unknown as CustomFrameRow[]}
              services={services}
              placeholders={PLACEHOLDERS}
              customVars={customVars}
              renderPreview={renderFramePreview}
              onChanged={load}
              requestEditId={frameEditRequest}
              onEditRequestHandled={() => setFrameEditRequest(null)}
              onRequestedEditorClosed={() => {
                if (frameReturnTab) setActiveTab(frameReturnTab);
                setFrameReturnTab(null);
              }}
            />
          </TabsContent>
          <TabsContent value="custom-vars" className="mt-4">
            <SmsCustomVariablesTab variables={customVars} onChanged={loadCustomVars} />
          </TabsContent>
          <TabsContent value="bale" className="mt-4">
            <BaleMessengerTab />
          </TabsContent>
          <TabsContent value="queue" className="mt-4">
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">پیامک‌های در انتظار ارسال</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={async () => { const rows = await refreshQueue(); loadQueuePreviews(rows, true); }}
                >
                  <RefreshCw className="h-3.5 w-3.5 ml-1" /> بارگذاری مجدد
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="relative mb-3">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="rounded-xl pr-9"
                    placeholder="جستجو در نام کارفرما، آدرس و شماره تماس..."
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                  />
                  {queueSearch && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2"
                      onClick={() => setQueueSearch("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  پیامک‌های ناموفق به‌صورت خودکار با یک زمان تصادفی بین ۵ تا ۱۲۰ ثانیه دوباره ارسال می‌شوند (حداکثر ۵ تلاش).
                  در صورت انصراف می‌توانید ارسال را لغو کنید. متن نمایش داده‌شده همان متنی است که با اطلاعات فعلی سفارش ارسال خواهد شد.
                  {queuePreviewLoading && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان ارسال</TableHead>
                      <TableHead>گیرنده</TableHead>
                      <TableHead>کارفرما</TableHead>
                      <TableHead>کلید</TableHead>
                      <TableHead>کد سفارش</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="min-w-[260px]">متن پیامک</TableHead>
                      <TableHead>تلاش</TableHead>
                      <TableHead>آخرین خطا</TableHead>
                      <TableHead>لغو</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQueue.length === 0 && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {queueSearch.trim() ? "موردی با این جستجو یافت نشد." : "پیامکی در انتظار ارسال نیست."}
                      </TableCell></TableRow>
                    )}
                    {filteredQueue.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(row.send_after).toLocaleString("fa-IR")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.phone}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate" title={row.payload?.address || ""}>
                          {row.payload?.customerName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">{row.status_key}</Badge>
                          {row.payload?.templateKey && frameTitleByKey.get(row.payload.templateKey) && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">قاب: {frameTitleByKey.get(row.payload.templateKey)}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.order_code || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="whitespace-nowrap">در انتظار ارسال</Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap max-w-[320px]">
                          {getQueueMessage(row) || (
                            <span className="text-muted-foreground">
                              {queuePreviews[row.id]?.note || (queuePreviewLoading ? "در حال آماده‌سازی متن..." : "—")}
                            </span>
                          )}
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

          <TabsContent value="customer" className="mt-4">
            {renderTemplateList("customer")}
          </TabsContent>
          <TabsContent value="ceo" className="mt-4">
            {renderTemplateList("ceo")}
          </TabsContent>
          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">آخرین ارسال‌ها</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="relative mb-3">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="rounded-xl pr-9"
                    placeholder="جستجو در نام کارفرما، آدرس و شماره تماس..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                  />
                  {logSearch && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2"
                      onClick={() => setLogSearch("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={logService} onValueChange={setLogService}>
                    <SelectTrigger className="h-8 w-[280px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">پیامک‌های همه خدمات</SelectItem>
                      {services.map((sv) => (
                        <SelectItem key={sv.id} value={sv.id} className="text-xs">{serviceLabel(sv)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>زمان</TableHead>
                      <TableHead>گیرنده</TableHead>
                      <TableHead>کارفرما</TableHead>
                      <TableHead>کلید</TableHead>
                      <TableHead>کد سفارش</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="min-w-[260px]">متن پیامک</TableHead>
                      <TableHead>پاسخ سرویس‌دهنده</TableHead>
                      <TableHead>ارسال مجدد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        {logSearch.trim() ? "موردی با این جستجو یافت نشد." : "گزارشی ثبت نشده است."}
                      </TableCell></TableRow>
                    )}
                    {filteredLogs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString("fa-IR")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.recipient}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate" title={l.address ? `${l.address}${l.detailed_address ? ` - ${l.detailed_address}` : ""}` : ""}>
                          {l.customer_name || "—"}
                        </TableCell>
                        <TableCell>
                          {l.template_key && frameTitleByKey.has(l.template_key)
                            ? <Badge variant="secondary" className="text-[10px]">قاب: {frameTitleByKey.get(l.template_key)}</Badge>
                            : l.template_key === "manual_message"
                              ? <Badge variant="secondary" className="text-[10px]">پیام دستی سفارش</Badge>
                              : <Badge variant="outline" className="font-mono text-[10px]">{l.template_key}</Badge>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.order_code || "—"}</TableCell>
                        <TableCell>
                          {l.status === "sent" && <Badge className="bg-green-600 hover:bg-green-600">ارسال شد</Badge>}
                          {l.status === "failed" && (
                            <Badge variant="destructive" className="whitespace-nowrap">
                              {retryingLogIds.has(l.id) ? "در حال تلاش مجدد" : "ناموفق"}
                            </Badge>
                          )}
                          {Number(l.attempts ?? 1) > 1 && (
                            <div className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                              {Number(l.attempts).toLocaleString("fa-IR")} تلاش
                              {l.last_attempt_at && <> · آخرین {new Date(l.last_attempt_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</>}
                            </div>
                          )}
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

      <Dialog open={!!variantBase} onOpenChange={(o) => { if (!o) setVariantBase(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>پیام تخصصی برای «{variantBase ? stageTitle(items, stageOf(variantBase)) : ""}»</DialogTitle>
            <DialogDescription>
              خدماتی را انتخاب کنید که مشتریانشان در این مرحله متن جداگانه بگیرند. متن فعلی کپی می‌شود تا آن را برای این خدمات ویرایش کنید.
            </DialogDescription>
          </DialogHeader>
          {variantBase && (
            <SmsServiceList
              services={services}
              value={variantServices}
              onChange={setVariantServices}
              blocked={takenByStage.get(stageOf(variantBase)) || {}}
            />
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setVariantBase(null)}>انصراف</Button>
            <Button disabled={variantServices.length === 0 || creatingVariant} onClick={createVariant}>
              {creatingVariant ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Plus className="h-4 w-4 ml-1" />}
              ساخت پیام تخصصی ({variantServices.length.toLocaleString("fa-IR")} خدمت)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
