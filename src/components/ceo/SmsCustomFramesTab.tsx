import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Pencil, Copy, Trash2, Loader2, Users, User, Building2, Phone, Search, X, Layers, Globe2,
  Clock, Sparkles, LayoutGrid, AlertTriangle, MessageSquarePlus, UserCheck, ArrowLeftRight,
} from "lucide-react";
import { FRAME_DISPLAY_TAB_LABELS, allowedFrameTabs, resolveFrameTab, type FrameDisplayTab } from "@/lib/smsFrameTabs";
import { SmsServicePicker, serviceLabel, type SmsServiceOption } from "@/components/ceo/SmsServicePicker";
import {
  CUSTOM_FRAME_SCOPE, CUSTOM_FRAME_STAGES, FRAME_STAGE_GROUP_LABELS, RECIPIENT_KIND_LABELS, RECIPIENT_ROLE_LABELS,
  customFrameStage, customFrameStageLabel, describeRecipients, frameKinds, makeCustomFrameKey, parseCustomPhones,
  recipientKindLabel, stageHasEventPerson, validateCustomFrame, type FrameStageGroup, type RecipientKind,
} from "../../../supabase/functions/_shared/smsCustomFrames";
import { applyEventVariables, sampleEventVars } from "../../../supabase/functions/_shared/smsOrderEvents";
import { smsElementsFor } from "../../../supabase/functions/_shared/smsCustomVariables";

const STAGE_GROUPS = Object.keys(FRAME_STAGE_GROUP_LABELS) as FrameStageGroup[];
const SAMPLE_EVENT_VARS = sampleEventVars();

export interface CustomFrameRow {
  id: string;
  key: string;
  title: string;
  description: string | null;
  scope: string;
  stage_key: string;
  template: string;
  enabled: boolean;
  delay_minutes: number;
  conditions: Record<string, any> | null;
  footer: string;
  append_footer: boolean;
  service_subcategory_ids: string[];
  excluded_subcategory_ids: string[];
  recipient_kinds: string[];
  recipient_roles: string[];
  recipient_phones: string[];
  display_tab?: string | null;
  updated_at: string;
}

interface Props {
  frames: CustomFrameRow[];
  services: SmsServiceOption[];
  /** همه المان‌های پیامک (پایه، رویداد و ساخته‌شده) به ترتیب نمایش */
  customVars: { id: string; token: string; label: string; enabled: boolean; source_key: string; is_system?: boolean | null }[];
  renderPreview: (template: string, serviceId?: string) => string;
  onChanged: () => void | Promise<void>;
  /** قابی که از تب مشتری/مدیریت برای ویرایش کامل (گیرندگان و مرحله) درخواست شده */
  requestEditId?: string | null;
  onEditRequestHandled?: () => void;
  /** پس از بستن پنجره‌ای که از تب دیگر باز شده بود (برای بازگشت به همان تب) */
  onRequestedEditorClosed?: () => void;
}

/** نمایش قاب در تب پیامک‌های مشتری یا مدیریت اهرم (فقط نمایش؛ ارسال تغییری نمی‌کند). */
export async function setFrameDisplayTab(id: string, tab: FrameDisplayTab | null): Promise<boolean> {
  const { data, error } = await supabase.from("sms_templates").update({ display_tab: tab } as any)
    .eq("id", id).eq("scope", CUSTOM_FRAME_SCOPE).select("id");
  if (error || !data?.length) {
    toast.error("جابجایی قاب انجام نشد" + (error ? ": " + error.message : " — دسترسی کافی ندارید"));
    return false;
  }
  toast.success(tab ? `قاب به تب «${FRAME_DISPLAY_TAB_LABELS[tab]}» برده شد` : "قاب فقط در تب قاب‌های پیام سفارشی نمایش داده می‌شود");
  return true;
}

type Draft = Omit<CustomFrameRow, "id" | "key" | "updated_at" | "scope"> & { id?: string; key?: string; phonesText: string };

const KIND_ICONS: Record<RecipientKind, typeof User> = { customer: User, collaborators: Users, roles: Building2, phones: Phone, event_person: UserCheck };

const emptyDraft = (stage = "submitted"): Draft => ({
  title: "",
  description: "",
  stage_key: stage,
  template: "سفارش کد {کد} - {نوع_خدمات} - مشتری: {نام_مشتری} - آدرس: {آدرس} - تاریخ: {تاریخ_و_ساعت}",
  enabled: true,
  delay_minutes: 0,
  conditions: { respectWindow: true },
  footer: "ahrom.ir",
  append_footer: true,
  service_subcategory_ids: [],
  excluded_subcategory_ids: [],
  recipient_kinds: [],
  recipient_roles: [],
  recipient_phones: [],
  display_tab: null,
  phonesText: "",
});

/** الگوهای آماده برای شروع سریع (قابل ویرایش پس از انتخاب) */
const PRESETS: Array<{ label: string; draft: Partial<Draft> }> = [
  {
    label: "اطلاع سفارش جدید به مدیر اجرایی",
    draft: {
      title: "سفارش جدید — مدیر اجرایی", stage_key: "submitted", recipient_kinds: ["roles"],
      recipient_roles: ["scaffold_executive_manager"], conditions: { respectWindow: false },
      template: "سفارش جدید ثبت شد: کد {کد} - {نوع_خدمات} - مشتری: {نام_مشتری} - آدرس: {آدرس} - مبلغ: {مبلغ} تومان - تاریخ: {تاریخ_و_ساعت}",
    },
  },
  {
    label: "اطلاع پرداخت به مدیر مالی",
    draft: {
      title: "ثبت پرداخت — مدیر مالی", stage_key: "paid", recipient_kinds: ["roles"],
      recipient_roles: ["finance_manager", "ceo"], conditions: { respectWindow: false },
      template: "پرداخت سفارش کد {کد} - {نام_مشتری}: مبلغ {مبلغ_پرداخت} - مجموع پرداخت: {مجموع_پرداخت_شده} - مانده: {مانده_سفارش} - تاریخ واریز: {تاریخ_واریز}",
    },
  },
  {
    label: "اطلاع رد سفارش به مشتری",
    draft: {
      title: "رد سفارش — مشتری", stage_key: "rejected", recipient_kinds: ["customer"], conditions: { respectWindow: true },
      template: "سفارش کد {کد} - {نوع_خدمات} - آدرس: {آدرس} - تاریخ: {تاریخ_و_ساعت} - برای پیگیری: {لینک_سفارش}",
    },
  },
  {
    label: "یادآوری جمع‌آوری به همکاران سفارش",
    draft: {
      title: "جمع‌آوری — همکاران سفارش", stage_key: "awaiting_collection", recipient_kinds: ["collaborators", "customer"],
      conditions: { respectWindow: true },
      template: "سفارش کد {کد} - {نوع_خدمات} - آدرس: {آدرس} - تاریخ جمع‌آوری: {تاریخ_جمع_آوری}",
    },
  },
  {
    label: "تایید تمدید به مشتری",
    draft: {
      title: "تایید تمدید — مشتری", stage_key: "renewal_approved", recipient_kinds: ["customer"], conditions: { respectWindow: true },
      template: "سفارش کد {کد} - {نوع_خدمات} - تمدید {ماه_تمدید} از {تاریخ_شروع_تمدید} تا {تاریخ_پایان_تمدید} - مبلغ تمدید: {مبلغ_تمدید} - پرداخت: {لینک_پرداخت}",
    },
  },
  {
    label: "تعمیر انجام شد به مشتری",
    draft: {
      title: "تعمیر انجام شد — مشتری", stage_key: "repair_completed", recipient_kinds: ["customer"], conditions: { respectWindow: true },
      template: "سفارش کد {کد} - {نوع_خدمات} - آدرس: {آدرس} - شرح تعمیر: {شرح_تعمیر} - هزینه تعمیر: {هزینه_تعمیر} - تاریخ: {تاریخ_و_ساعت}",
    },
  },
  {
    label: "اعمال تخفیف به مشتری",
    draft: {
      title: "اعمال تخفیف — مشتری", stage_key: "discount_applied", recipient_kinds: ["customer"], conditions: { respectWindow: true },
      template: "سفارش کد {کد} - {نوع_خدمات} - تخفیف: {مبلغ_تخفیف} - مبلغ پس از تخفیف: {مبلغ_پس_از_تخفیف} - تاریخ: {تاریخ_و_ساعت}",
    },
  },
  {
    label: "همکار جدید به همکار",
    draft: {
      title: "افزودن همکار — همکار", stage_key: "collaborator_added", recipient_kinds: ["event_person"], conditions: { respectWindow: true },
      template: "سفارش کد {کد} - {نوع_خدمات} - {نام_شخص} عزیز، سفارش پروژه {نام_پروژه} از کاربر {نام_مالک_سفارش} برای همکاری به شما اضافه شد - {لینک_سفارش}",
    },
  },
];

export function SmsCustomFramesTab({
  frames, services, customVars, renderPreview, onChanged,
  requestEditId, onEditRequestHandled, onRequestedEditorClosed,
}: Props) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [fromRequest, setFromRequest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | RecipientKind>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const byStage = useMemo(() => {
    const m = new Map<string, CustomFrameRow[]>();
    frames.forEach((f) => m.set(f.stage_key, [...(m.get(f.stage_key) || []), f]));
    return m;
  }, [frames]);

  const visible = useMemo(() => {
    const q = search.trim();
    return frames.filter((f) => {
      if (stageFilter !== "all" && f.stage_key !== stageFilter) return false;
      if (kindFilter !== "all" && !frameKinds(f).includes(kindFilter)) return false;
      if (serviceFilter !== "all") {
        const targets = f.service_subcategory_ids || [];
        if (targets.length > 0 && !targets.includes(serviceFilter)) return false;
        if ((f.excluded_subcategory_ids || []).includes(serviceFilter)) return false;
      }
      if (q && ![f.title, f.template, f.description, ...describeRecipients(f)].filter(Boolean).some((v) => String(v).includes(q))) return false;
      return true;
    }).sort((a, b) =>
      CUSTOM_FRAME_STAGES.findIndex((s) => s.key === a.stage_key) - CUSTOM_FRAME_STAGES.findIndex((s) => s.key === b.stage_key)
      || a.title.localeCompare(b.title, "fa"));
  }, [frames, stageFilter, kindFilter, serviceFilter, search]);

  const filtersActive = stageFilter !== "all" || kindFilter !== "all" || serviceFilter !== "all" || !!search.trim();

  const openNew = (preset?: Partial<Draft>) => {
    const base = emptyDraft(stageFilter !== "all" ? stageFilter : "submitted");
    setEditing({ ...base, ...(preset || {}), phonesText: "" });
  };
  const openEdit = (f: CustomFrameRow, copy = false) => {
    setEditing({
      ...f,
      id: copy ? undefined : f.id,
      key: copy ? undefined : f.key,
      title: copy ? `${f.title} (کپی)` : f.title,
      conditions: { respectWindow: true, ...(f.conditions || {}) },
      phonesText: (f.recipient_phones || []).join("\n"),
    });
  };

  useEffect(() => {
    if (!requestEditId) return;
    const f = frames.find((x) => x.id === requestEditId);
    if (f) { openEdit(f); setFromRequest(true); }
    onEditRequestHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestEditId, frames]);

  const closeEditor = () => {
    setEditing(null);
    if (fromRequest) { setFromRequest(false); onRequestedEditorClosed?.(); }
  };

  const moveFrame = async (f: CustomFrameRow, tab: FrameDisplayTab | null) => {
    setBusyId(f.id);
    const ok = await setFrameDisplayTab(f.id, tab);
    setBusyId(null);
    if (ok) await onChanged();
  };

  const patch = (p: Partial<Draft>) => setEditing((d) => (d ? { ...d, ...p } : d));
  const toggleKind = (k: RecipientKind, on: boolean) => {
    if (!editing) return;
    const set = new Set(editing.recipient_kinds);
    on ? set.add(k) : set.delete(k);
    patch({ recipient_kinds: [...set] });
  };
  const toggleRole = (r: string, on: boolean) => {
    if (!editing) return;
    const set = new Set(editing.recipient_roles);
    on ? set.add(r) : set.delete(r);
    patch({ recipient_roles: [...set] });
  };

  const phoneParse = useMemo(() => parseCustomPhones(editing?.phonesText || ""), [editing?.phonesText]);
  const draftForValidation = editing && {
    ...editing,
    key: editing.key || "custom_new",
    recipient_phones: phoneParse.valid,
  };
  const errors = draftForValidation ? validateCustomFrame(draftForValidation) : [];

  const save = async () => {
    if (!editing) return;
    if (errors.length) { toast.error(errors[0]); return; }
    setSaving(true);
    const kinds = editing.recipient_kinds;
    const row = {
      title: editing.title.trim(),
      description: (editing.description || "").trim() || null,
      stage_key: editing.stage_key,
      scope: CUSTOM_FRAME_SCOPE,
      template: editing.template,
      default_template: editing.template,
      enabled: editing.enabled,
      delay_minutes: Math.min(5, Math.max(0, Number(editing.delay_minutes) || 0)),
      conditions: editing.conditions || {},
      footer: (editing.footer || "ahrom.ir").trim() || "ahrom.ir",
      append_footer: editing.append_footer !== false,
      service_subcategory_ids: editing.service_subcategory_ids,
      excluded_subcategory_ids: editing.service_subcategory_ids.length ? [] : editing.excluded_subcategory_ids,
      recipient_kinds: kinds,
      recipient_roles: kinds.includes("roles") ? editing.recipient_roles : [],
      recipient_phones: kinds.includes("phones") ? phoneParse.valid : [],
      display_tab: resolveFrameTab(editing.display_tab, kinds),
    };
    const res = editing.id
      ? await supabase.from("sms_templates").update(row as any).eq("id", editing.id).select("id")
      : await supabase.from("sms_templates").insert({ ...row, key: makeCustomFrameKey() } as any).select("id");
    setSaving(false);
    if (res.error) { toast.error("ذخیره قاب ناموفق بود: " + res.error.message); return; }
    if (!res.data || res.data.length === 0) { toast.error("ذخیره انجام نشد — دسترسی مدیریت پیامک برای حساب شما وجود ندارد"); return; }
    toast.success(editing.id ? "قاب پیام ذخیره شد" : "قاب پیام ساخته شد");
    closeEditor();
    await onChanged();
  };

  const toggleEnabled = async (f: CustomFrameRow, value: boolean) => {
    setBusyId(f.id);
    const { data, error } = await supabase.from("sms_templates").update({ enabled: value }).eq("id", f.id).select("id");
    setBusyId(null);
    if (error || !data?.length) { toast.error("تغییر وضعیت انجام نشد" + (error ? ": " + error.message : " — دسترسی کافی ندارید")); return; }
    toast.success(value ? "قاب فعال شد" : "قاب غیرفعال شد");
    await onChanged();
  };

  const remove = async (f: CustomFrameRow) => {
    if (!window.confirm(`قاب پیام «${f.title}» حذف شود؟ از این پس این پیام ارسال نمی‌شود.`)) return;
    setBusyId(f.id);
    const { data, error } = await supabase.from("sms_templates").delete().eq("id", f.id).eq("scope", CUSTOM_FRAME_SCOPE).select("id");
    setBusyId(null);
    if (error || !data?.length) { toast.error("حذف انجام نشد" + (error ? ": " + error.message : " — دسترسی کافی ندارید")); return; }
    toast.success("قاب پیام حذف شد");
    await onChanged();
  };

  const servicesSummary = (f: { service_subcategory_ids: string[]; excluded_subcategory_ids: string[] }) => {
    const t = f.service_subcategory_ids || [];
    if (t.length === 0) {
      const ex = (f.excluded_subcategory_ids || []).length;
      return ex ? `همه خدمات به‌جز ${ex.toLocaleString("fa-IR")} خدمت` : "همه خدمات";
    }
    const names = t.map((id) => serviceById.get(id)?.name || "خدمت حذف‌شده");
    return names.length > 3 ? `${names.slice(0, 3).join("، ")} و ${(names.length - 3).toLocaleString("fa-IR")} خدمت دیگر` : names.join("، ");
  };

  const editingStage = customFrameStage(editing?.stage_key);

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5 text-primary" />قاب‌های پیام سفارشی
              </h2>
              <p className="text-xs text-muted-foreground leading-6">
                پیام دلخواه بسازید، مشخص کنید در کدام مرحله سفارش و برای کدام خدمات ارسال شود و چه کسانی آن را بگیرند:
                مشتری سفارش، همکاران سفارش، هر بخش مدیریتی یا شماره‌های دلخواه. این قاب‌ها علاوه بر پیامک‌های پیش‌فرض ارسال می‌شوند
                و هر رویداد برای هر گیرنده فقط یک بار پیام می‌فرستد.
              </p>
            </div>
            <Button onClick={() => openNew()} className="gap-1">
              <Plus className="h-4 w-4" />افزودن قاب پیام
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />شروع سریع:</span>
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNew(p.draft)}>{p.label}</Button>
            ))}
          </div>

          <div>
            <p className="text-xs font-medium mb-2 flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" />پوشش مراحل سفارش، تمدید، تعمیرات، تخفیف، انتقال و همکاران</p>
            <div className="space-y-3">
            {STAGE_GROUPS.map((g) => (
            <div key={g}>
            <p className="text-[11px] text-muted-foreground mb-1">{FRAME_STAGE_GROUP_LABELS[g]}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {CUSTOM_FRAME_STAGES.filter((s) => s.group === g).map((s) => {
                const list = byStage.get(s.key) || [];
                const active = list.filter((f) => f.enabled).length;
                const selected = stageFilter === s.key;
                return (
                  <button
                    key={s.key} type="button" title={s.hint}
                    onClick={() => setStageFilter(selected ? "all" : s.key)}
                    className={"rounded-md border p-2 text-right transition-colors " + (selected ? "border-primary bg-primary/10" : "hover:bg-muted/60")}
                  >
                    <div className="text-xs font-medium">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {list.length === 0 ? "بدون قاب" : `${active.toLocaleString("fa-IR")} فعال${list.length > active ? ` · ${(list.length - active).toLocaleString("fa-IR")} خاموش` : ""}`}
                    </div>
                  </button>
                );
              })}
            </div>
            </div>
            ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه مراحل</SelectItem>
                {STAGE_GROUPS.map((g) => (
                  <SelectGroup key={g}>
                    <SelectLabel className="text-[11px]">{FRAME_STAGE_GROUP_LABELS[g]}</SelectLabel>
                    {CUSTOM_FRAME_STAGES.filter((s) => s.group === g).map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
              <SelectTrigger className="h-9 w-[190px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه گیرندگان</SelectItem>
                {(Object.keys(RECIPIENT_KIND_LABELS) as RecipientKind[]).map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">{RECIPIENT_KIND_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="h-9 w-[240px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه خدمات</SelectItem>
                {services.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{serviceLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 pr-9 text-xs" placeholder="جستجو در عنوان، متن و گیرندگان..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {filtersActive && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setStageFilter("all"); setKindFilter("all"); setServiceFilter("all"); setSearch(""); }}>
                <X className="h-3.5 w-3.5 ml-1" />حذف فیلترها
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {visible.map((f) => (
        <Card key={f.id} className={f.enabled ? "shadow-sm" : "opacity-75"}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-[240px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm">{f.title}</span>
                  <Badge variant="outline" className="text-[11px]">{customFrameStageLabel(f.stage_key)}</Badge>
                  {!f.enabled && <Badge variant="destructive" className="text-[11px]">غیرفعال</Badge>}
                  {f.delay_minutes > 0 && <Badge variant="secondary" className="text-[11px] gap-1"><Clock className="h-3 w-3" />{f.delay_minutes.toLocaleString("fa-IR")} دقیقه تأخیر</Badge>}
                  {(f.conditions as any)?.respectWindow === false && <Badge variant="secondary" className="text-[11px]">ارسال در هر ساعت</Badge>}
                  {resolveFrameTab(f.display_tab, f.recipient_kinds) && (
                    <Badge className="text-[11px] gap-1"><ArrowLeftRight className="h-3 w-3" />در تب {FRAME_DISPLAY_TAB_LABELS[resolveFrameTab(f.display_tab, f.recipient_kinds)!]}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="text-muted-foreground">گیرندگان:</span>
                  {describeRecipients(f).map((l) => <Badge key={l} variant="secondary" className="font-normal text-[11px]">{l}</Badge>)}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {(f.service_subcategory_ids || []).length ? <Layers className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
                  {servicesSummary(f)}
                </div>
                {f.description && <p className="text-[11px] text-muted-foreground">{f.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">فعال</Label>
                <Switch checked={f.enabled} disabled={busyId === f.id} onCheckedChange={(v) => toggleEnabled(f, v)} />
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-2 text-xs leading-6 whitespace-pre-wrap">{f.template}</div>
            <div className="flex flex-wrap justify-end items-center gap-2">
              {allowedFrameTabs(f.recipient_kinds).length > 0 && (
                <Select
                  value={resolveFrameTab(f.display_tab, f.recipient_kinds) || "frames"}
                  onValueChange={(v) => moveFrame(f, v === "frames" ? null : (v as FrameDisplayTab))}
                  disabled={busyId === f.id}
                >
                  <SelectTrigger className="h-9 w-[230px] text-xs gap-1">
                    <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frames" className="text-xs">فقط در تب قاب‌ها</SelectItem>
                    {allowedFrameTabs(f.recipient_kinds).map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">بردن به تب {FRAME_DISPLAY_TAB_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === f.id} onClick={() => remove(f)}>
                <Trash2 className="h-4 w-4 ml-1" />حذف
              </Button>
              <Button size="sm" variant="outline" onClick={() => openEdit(f, true)}><Copy className="h-4 w-4 ml-1" />کپی</Button>
              <Button size="sm" onClick={() => openEdit(f)}><Pencil className="h-4 w-4 ml-1" />ویرایش</Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {filtersActive ? "قابی با این فیلترها یافت نشد." : "هنوز قاب پیامی نساخته‌اید. با «افزودن قاب پیام» یا یکی از الگوهای شروع سریع شروع کنید."}
        </p>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEditor()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "ویرایش قاب پیام" : "قاب پیام جدید"}</DialogTitle>
            <DialogDescription>مرحله، خدمات، گیرندگان و متن پیام را مشخص کنید.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">عنوان قاب</Label>
                  <Input value={editing.title} placeholder="مثلاً: اطلاع پرداخت به مدیر مالی" onChange={(e) => patch({ title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">مرحله سفارش</Label>
                  <Select value={editing.stage_key} onValueChange={(v) => patch({
                    stage_key: v,
                    // «شخص مرتبط با رویداد» فقط در مراحل انتقال و همکاران معنا دارد
                    recipient_kinds: stageHasEventPerson(v) ? editing.recipient_kinds : editing.recipient_kinds.filter((k) => k !== "event_person"),
                  })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[60vh]">
                      {STAGE_GROUPS.map((g) => (
                        <SelectGroup key={g}>
                          <SelectLabel className="text-[11px]">{FRAME_STAGE_GROUP_LABELS[g]}</SelectLabel>
                          {CUSTOM_FRAME_STAGES.filter((s) => s.group === g).map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {editingStage && <p className="text-[11px] text-muted-foreground mt-1">{editingStage.hint}</p>}
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <Label className="text-xs font-semibold">گیرندگان پیام</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(RECIPIENT_KIND_LABELS) as RecipientKind[])
                    .filter((k) => k !== "event_person" || stageHasEventPerson(editing.stage_key))
                    .map((k) => {
                    const Icon = KIND_ICONS[k];
                    const on = editing.recipient_kinds.includes(k);
                    return (
                      <label key={k} className={"flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer " + (on ? "border-primary bg-primary/5" : "")}>
                        <Checkbox checked={on} onCheckedChange={(v) => toggleKind(k, !!v)} />
                        <Icon className="h-4 w-4 text-muted-foreground" />{recipientKindLabel(k, editing.stage_key)}
                      </label>
                    );
                  })}
                </div>
                {editing.recipient_kinds.includes("customer") && (
                  <p className="text-[11px] text-muted-foreground">مشتریانی که پیامک را در حساب خود خاموش کرده‌اند این پیام را نمی‌گیرند.</p>
                )}
                {editing.recipient_kinds.includes("event_person") && (
                  <p className="text-[11px] text-muted-foreground">
                    {editingStage?.group === "transfer"
                      ? "شماره‌ای که سفارش به آن منتقل می‌شود این پیام را می‌گیرد، حتی اگر هنوز در سایت ثبت‌نام نکرده باشد."
                      : "همان همکاری که به این سفارش اضافه یا دعوت شده این پیام را می‌گیرد."}
                  </p>
                )}
                {editing.recipient_kinds.includes("roles") && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">همه کسانی که این نقش‌ها را دارند (با شماره ثبت‌شده در حسابشان) پیام می‌گیرند:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {Object.entries(RECIPIENT_ROLE_LABELS).map(([r, label]) => (
                        <label key={r} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox checked={editing.recipient_roles.includes(r)} onCheckedChange={(v) => toggleRole(r, !!v)} />{label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {editing.recipient_kinds.includes("phones") && (
                  <div className="space-y-1">
                    <Textarea dir="ltr" rows={3} className="font-mono text-xs" placeholder={"09121234567\n09351234567"} value={editing.phonesText} onChange={(e) => patch({ phonesText: e.target.value })} />
                    <p className="text-[11px] text-muted-foreground">
                      هر شماره در یک خط (حداکثر ۲۰ شماره). {phoneParse.valid.length.toLocaleString("fa-IR")} شماره معتبر
                      {phoneParse.invalid.length > 0 && <span className="text-destructive"> · نامعتبر: {phoneParse.invalid.join("، ")}</span>}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1"><ArrowLeftRight className="h-3.5 w-3.5" />محل نمایش قاب در مدیریت پیامک‌ها</Label>
                <div className="flex flex-wrap gap-2">
                  {([null, "customer", "ceo"] as (FrameDisplayTab | null)[]).map((t) => {
                    const allowed = t === null || allowedFrameTabs(editing.recipient_kinds).includes(t);
                    const current = resolveFrameTab(editing.display_tab, editing.recipient_kinds);
                    return (
                      <Button key={t || "frames"} type="button" size="sm" className="h-8 text-xs"
                        variant={current === t ? "default" : "outline"} disabled={!allowed}
                        onClick={() => patch({ display_tab: t })}>
                        {t ? `تب ${FRAME_DISPLAY_TAB_LABELS[t]}` : "فقط تب قاب‌ها"}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground leading-5">
                  قاب‌هایی که برای مشتری، همکاران یا شخص مرتبط هستند به تب پیامک‌های مشتری، و قاب‌هایی که برای بخش‌های مدیریتی یا شماره‌های دلخواه هستند به تب پیامک‌های مدیریت اهرم برده می‌شوند.
                  قاب در آن تب کنار پیامک‌های همان مرحله و با همان امکانات ویرایش نمایش داده می‌شود؛ گیرندگان و زمان ارسال تغییری نمی‌کنند.
                </p>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <Label className="text-xs font-semibold">خدماتی که این پیام برای سفارش‌هایشان ارسال می‌شود</Label>
                <SmsServicePicker
                  services={services}
                  value={editing.service_subcategory_ids}
                  onChange={(ids) => patch({ service_subcategory_ids: ids })}
                  placeholder="همه خدمات (برای محدود کردن، خدمات را انتخاب کنید)"
                />
                {editing.service_subcategory_ids.length === 0 && (
                  <SmsServicePicker
                    services={services}
                    value={editing.excluded_subcategory_ids}
                    onChange={(ids) => patch({ excluded_subcategory_ids: ids })}
                    placeholder="استثنا کردن خدمات (این پیام را نگیرند)"
                    tone="exclude"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">متن پیام — متغیرها را با کلیک اضافه کنید</Label>
                  <Textarea dir="rtl" rows={5} value={editing.template} onChange={(e) => patch({ template: e.target.value })} />
                  <div className="flex flex-wrap gap-1">
                    {smsElementsFor(customVars, editingStage?.group).map((v) => (
                      <Button key={v.id} type="button" size="sm" variant="outline" className={"h-7 text-xs" + (v.is_system ? "" : " border-primary/40")} title={v.label}
                        onClick={() => patch({ template: `${editing.template || ""} {${v.token}}` })}>{`{${v.token}}`}</Button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    سربرگ «خدمات ساختمانی و منزل اهرم» و پابرگ ahrom.ir خودکار افزوده می‌شوند. متن باید با الگوی تاییدشده پنل پیامک سازگار باشد.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">پیش‌نمایش</Label>
                  <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-6 whitespace-pre-wrap min-h-[160px]">
                    {renderPreview(applyEventVariables(editing.template, SAMPLE_EVENT_VARS), editing.service_subcategory_ids[0])}
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between gap-2 text-xs sm:col-span-2">
                  <span>فقط در ساعات مجاز ارسال پیامک بفرست (خارج از آن، در صف می‌ماند)</span>
                  <Switch checked={(editing.conditions as any)?.respectWindow !== false}
                    onCheckedChange={(v) => patch({ conditions: { ...(editing.conditions || {}), respectWindow: v } })} />
                </label>
                <div>
                  <Label className="text-xs">تأخیر ارسال (۰ تا ۵ دقیقه)</Label>
                  <Input type="number" min={0} max={5} value={editing.delay_minutes}
                    onChange={(e) => patch({ delay_minutes: Math.min(5, Math.max(0, Number(e.target.value) || 0)) })} />
                </div>
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span>قاب فعال باشد</span>
                  <Switch checked={editing.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
                </label>
                <div>
                  <Label className="text-xs">حداقل مبلغ سفارش (تومان)</Label>
                  <Input type="number" min={0} value={(editing.conditions as any)?.minAmount ?? ""}
                    onChange={(e) => patch({ conditions: { ...(editing.conditions || {}), minAmount: e.target.value === "" ? undefined : Number(e.target.value) } })} />
                </div>
                <div>
                  <Label className="text-xs">حداکثر مبلغ سفارش (تومان)</Label>
                  <Input type="number" min={0} value={(editing.conditions as any)?.maxAmount ?? ""}
                    onChange={(e) => patch({ conditions: { ...(editing.conditions || {}), maxAmount: e.target.value === "" ? undefined : Number(e.target.value) } })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">توضیحات (فقط برای مدیران)</Label>
                  <Input value={editing.description || ""} onChange={(e) => patch({ description: e.target.value })} />
                </div>
              </div>

              {errors.length > 0 && (
                <ul className="text-[11px] text-destructive list-disc pr-4 space-y-0.5">
                  {errors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeEditor}>انصراف</Button>
            <Button onClick={save} disabled={saving || errors.length > 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}ذخیره قاب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
