import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  SMS_FORMATS_BY_KIND, SMS_VARIABLE_SOURCES, getSmsVariableSource, normalizeSmsToken,
  resolveSmsCustomVariable, validateSmsToken, type SmsOrderSnapshot,
} from "../../../supabase/functions/_shared/smsCustomVariables";

export interface SmsCustomVariableRow {
  id: string;
  token: string;
  label: string;
  source_key: string;
  format: string;
  fallback: string;
  prefix: string;
  suffix: string;
  enabled: boolean;
  updated_at?: string;
}

// داده نمونه فقط برای پیش‌نمایش؛ هنگام ارسال واقعی، اطلاعات همان سفارش جایگزین می‌شود
const now = Date.now();
const day = 86400000;
export const SAMPLE_SMS_SNAPSHOT: SmsOrderSnapshot = {
  order: {
    created_at: new Date(now - 40 * day).toISOString(),
    approved_at: new Date(now - 39 * day).toISOString(),
    execution_start_date: new Date(now - 35 * day).toISOString(),
    execution_end_date: new Date(now - 33 * day).toISOString(),
    rental_start_date: new Date(now - 33 * day).toISOString(),
    rental_end_date: new Date(now + 27 * day).toISOString(),
    total_price: 25_000_000,
    total_paid: 15_000_000,
    discount_amount: 500_000,
    stage_note: "داربست نما طبقه دوم",
  },
  payments: [
    { amount: 10_000_000, payment_date: new Date(now - 30 * day).toISOString(), created_at: new Date(now - 30 * day).toISOString(), receipt_number: "48211" },
    { amount: 5_000_000, payment_date: new Date(now - 10 * day).toISOString(), created_at: new Date(now).toISOString(), receipt_number: "77310" },
  ],
  renewals: [
    { renewal_number: 1, new_start_date: new Date(now - 3 * day).toISOString(), new_end_date: new Date(now + 27 * day).toISOString(), renewal_price: 4_000_000, status: "approved" },
  ],
  collection: { requested_date: new Date(now + 28 * day).toISOString(), confirmed_date: null, completed_at: null },
};

const GROUPS = Array.from(new Set(SMS_VARIABLE_SOURCES.map((s) => s.group)));

type Draft = Omit<SmsCustomVariableRow, "id"> & { id?: string };
const emptyDraft = (): Draft => ({
  token: "", label: "", source_key: "payment_latest_deposit_date", format: "auto",
  fallback: "ثبت نشده", prefix: "", suffix: "", enabled: true,
});

export function SmsCustomVariablesTab({
  variables, onChanged,
}: { variables: SmsCustomVariableRow[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SmsCustomVariableRow | null>(null);

  const source = draft ? getSmsVariableSource(draft.source_key) : null;
  const formats = source ? SMS_FORMATS_BY_KIND[source.kind] : [];
  const tokenError = draft && draft.token ? validateSmsToken(draft.token) : null;
  const duplicate = useMemo(() => {
    if (!draft) return false;
    const t = normalizeSmsToken(draft.token).toLowerCase();
    return variables.some((v) => v.id !== draft.id && v.token.toLowerCase() === t);
  }, [draft, variables]);
  const preview = draft && source
    ? resolveSmsCustomVariable({ ...draft, token: normalizeSmsToken(draft.token) }, SAMPLE_SMS_SNAPSHOT)
    : "";

  const save = async () => {
    if (!draft) return;
    const token = normalizeSmsToken(draft.token);
    const err = validateSmsToken(token);
    if (err) { toast.error(err); return; }
    if (duplicate) { toast.error("المانی با همین نام وجود دارد"); return; }
    if (!source) { toast.error("داده‌ای که المان از سفارش برمی‌دارد را انتخاب کنید"); return; }
    const label = draft.label.trim() || source.label;
    const validFormat = formats.some((f) => f.value === draft.format) ? draft.format : formats[0]?.value || "auto";
    const payload = {
      token, label: label.slice(0, 80), source_key: draft.source_key, format: validFormat,
      fallback: draft.fallback.trim() || "ثبت نشده", prefix: draft.prefix, suffix: draft.suffix, enabled: draft.enabled,
    };
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const res = draft.id
      ? await supabase.from("sms_custom_variables").update(payload).eq("id", draft.id).select("id")
      : await supabase.from("sms_custom_variables").insert({ ...payload, created_by: auth.user?.id ?? null }).select("id");
    setSaving(false);
    if (res.error) { toast.error("خطا در ذخیره المان: " + res.error.message); return; }
    if (!res.data || res.data.length === 0) { toast.error("ذخیره انجام نشد — دسترسی کافی ندارید"); return; }
    toast.success(draft.id ? "المان به‌روز شد" : "المان ساخته شد — حالا می‌توانید آن را در متن پیامک‌ها قرار دهید");
    setDraft(null);
    onChanged();
  };

  const toggle = async (v: SmsCustomVariableRow, enabled: boolean) => {
    const { data, error } = await supabase.from("sms_custom_variables").update({ enabled }).eq("id", v.id).select("id");
    if (error || !data?.length) { toast.error("تغییر وضعیت انجام نشد"); return; }
    onChanged();
  };

  const remove = async () => {
    if (!deleting) return;
    const { data, error } = await supabase.from("sms_custom_variables").delete().eq("id", deleting.id).select("id");
    setDeleting(null);
    if (error || !data?.length) { toast.error("حذف انجام نشد"); return; }
    toast.success("المان حذف شد");
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />المان‌های سفارشی پیامک
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 leading-5">
            المان بسازید تا تاریخ یا مبلغ دلخواه از همان سفارش مشتری خودکار داخل پیامک قرار بگیرد. بعد از ساخت، المان در زیر متن همه پیامک‌ها قابل افزودن است.
          </p>
        </div>
        <Button size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-4 w-4 ml-1" />ساخت المان جدید
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {variables.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-lg">
            هنوز المانی ساخته نشده است. مثلاً یک المان «تاریخ واریز» بسازید تا تاریخی که هنگام ثبت پرداخت انتخاب کرده‌اید در پیامک بیاید.
          </div>
        )}
        {variables.map((v) => {
          const src = getSmsVariableSource(v.source_key);
          return (
            <div key={v.id} className="flex items-center gap-3 border rounded-lg p-3 flex-wrap">
              <div className="flex-1 min-w-[220px] space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{v.label}</span>
                  <Badge variant="outline" className="font-mono text-xs" dir="ltr">{`{${v.token}}`}</Badge>
                  {!v.enabled && <Badge variant="destructive">غیرفعال</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {src ? `${src.group} › ${src.label}` : "داده نامعتبر"} — نمونه: {resolveSmsCustomVariable(v, SAMPLE_SMS_SNAPSHOT)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={v.enabled} onCheckedChange={(c) => toggle(v, c)} aria-label="فعال" />
                <Button size="icon" variant="ghost" aria-label="ویرایش" onClick={() => setDraft({ ...v })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => setDeleting(v)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "ویرایش المان" : "ساخت المان جدید"}</DialogTitle>
            <DialogDescription>
              مشخص کنید این المان چه اطلاعاتی را از سفارش بردارد و در پیامک با چه شکلی نوشته شود.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">عنوان المان (اختیاری)</Label>
                <Input value={draft.label} placeholder="مثلاً: تاریخ واریز مشتری" maxLength={80}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">نام المان در متن پیامک</Label>
                <Input value={draft.token} placeholder="مثلاً: تاریخ_واریز" maxLength={42}
                  onChange={(e) => setDraft({ ...draft, token: e.target.value })} />
                <p className={"text-[11px] mt-1 " + (tokenError || duplicate ? "text-destructive" : "text-muted-foreground")}>
                  {tokenError || (duplicate ? "المانی با همین نام وجود دارد" :
                    `در متن پیامک به این شکل نوشته می‌شود: {${normalizeSmsToken(draft.token) || "نام"}}`)}
                </p>
              </div>
              <div>
                <Label className="text-xs">این المان چه چیزی را از سفارش بردارد؟</Label>
                <Select value={draft.source_key}
                  onValueChange={(val) => {
                    const s = getSmsVariableSource(val);
                    setDraft({ ...draft, source_key: val, format: s ? SMS_FORMATS_BY_KIND[s.kind][0].value : "auto",
                      label: draft.label || (s?.label ?? "") });
                  }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl" className="max-h-80">
                    {GROUPS.map((g) => (
                      <SelectGroup key={g}>
                        <SelectLabel>{g}</SelectLabel>
                        {SMS_VARIABLE_SOURCES.filter((s) => s.group === g).map((s) => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {source?.hint && <p className="text-[11px] text-muted-foreground mt-1">{source.hint}</p>}
              </div>
              {formats.length > 1 && (
                <div>
                  <Label className="text-xs">شکل نوشتن</Label>
                  <Select value={formats.some((f) => f.value === draft.format) ? draft.format : formats[0].value}
                    onValueChange={(val) => setDraft({ ...draft, format: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      {formats.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">متن قبل از مقدار (اختیاری)</Label>
                  <Input value={draft.prefix} maxLength={40} placeholder="مثلاً: روز "
                    onChange={(e) => setDraft({ ...draft, prefix: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">متن بعد از مقدار (اختیاری)</Label>
                  <Input value={draft.suffix} maxLength={40}
                    onChange={(e) => setDraft({ ...draft, suffix: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">اگر این اطلاعات در سفارش ثبت نشده بود بنویسد</Label>
                <Input value={draft.fallback} maxLength={60}
                  onChange={(e) => setDraft({ ...draft, fallback: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <Label className="text-xs">فعال</Label>
                <Switch checked={draft.enabled} onCheckedChange={(c) => setDraft({ ...draft, enabled: c })} />
              </div>
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="text-xs text-muted-foreground block mb-1">نمونه خروجی در پیامک (با اطلاعات نمونه):</span>
                {preview}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>انصراف</Button>
            <Button onClick={save} disabled={saving || !!tokenError || duplicate}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}ذخیره المان
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المان «{deleting?.label}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              اگر این المان در متن پیامکی استفاده شده باشد، بعد از حذف همان نام {deleting ? `{${deleting.token}}` : ""} بدون تغییر در پیامک ارسال می‌شود. ابتدا آن را از متن پیامک‌ها بردارید.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
