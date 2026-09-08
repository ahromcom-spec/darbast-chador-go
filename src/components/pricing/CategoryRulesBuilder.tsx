import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Loader2, Pencil, Plus, Trash2, Wand2, X, Sigma } from 'lucide-react';
import { toast } from 'sonner';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { Textarea } from '@/components/ui/textarea';
import {
  ACTION_LABELS,
  METRIC_LABELS,
  OPERATOR_LABELS,
  describeAction,
  describeCondition,
  validateFormula,
  evaluateFormula,
  type PricingRule,
  type RuleActionType,
  type RuleCondition,
  type RuleMetric,
  type RuleOperator,
} from '@/lib/pricingRules';

interface Props {
  category: string;
  categoryLabel: string;
  rules: PricingRule[];
  onCreate: (input: Omit<PricingRule, 'id' | 'config_table'>) => Promise<void>;
  onUpdate: (id: string, patch: Partial<PricingRule>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const emptyCondition = (): RuleCondition => ({
  left: 'height',
  operator: '>',
  rightKind: 'number',
  number: 0,
  metric: 'length',
  factor: 2,
});

const numInput = (v: number | undefined) =>
  v === undefined || v === null || Number.isNaN(v) ? '' : String(v);

export const CategoryRulesBuilder = ({
  category,
  categoryLabel,
  rules,
  onCreate,
  onUpdate,
  onDelete,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([emptyCondition()]);
  const [actionType, setActionType] = useState<RuleActionType>('increase_percent');
  const [actionValue, setActionValue] = useState<number>(0);
  const [formula, setFormula] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const isFormula = actionType === 'add_formula';
  const formulaValid = isFormula && formula.trim() ? validateFormula(formula) : false;
  /** نمونه محاسبه با اعداد فرضی تا مدیر نتیجه فرمول را ببیند */
  const samplePreview =
    isFormula && formulaValid
      ? evaluateFormula(formula, {
          length: 6, width: 1, height: 20, area: 120, total_length: 6, pipe_length: 6,
          platform_height: 0, scaffold_height: 20, vehicle_distance: 0, distance_km: 0,
          months: 1, unit_fee: 30000, base_price: 3600000,
        })
      : null;

  const reset = () => {
    setTitle('');
    setConditions([emptyCondition()]);
    setActionType('increase_percent');
    setActionValue(0);
    setFormula('');
    setEditingId(null);
  };

  const startEditing = (rule: PricingRule) => {
    setEditingId(rule.id);
    setTitle(rule.title || '');
    setConditions(rule.conditions?.length ? rule.conditions : [emptyCondition()]);
    setActionType(rule.action_type);
    setActionValue(rule.action_value || 0);
    setFormula(rule.action_formula || '');
    setOpen(true);
  };

  const patchCondition = (i: number, patch: Partial<RuleCondition>) =>
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const handleSave = async () => {
    if (!conditions.length) return;
    if (isFormula) {
      if (!formula.trim()) {
        toast.error('فرمول محاسبه را وارد کنید');
        return;
      }
      if (!formulaValid) {
        toast.error('فرمول معتبر نیست؛ فقط از متغیرهای مجاز و + - × ÷ و پرانتز استفاده کنید');
        return;
      }
    } else if (!actionValue) {
      toast.error('مقدار اثر شرط روی قیمت را وارد کنید');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category,
        title: title.trim() || `شرط ${categoryLabel}`,
        is_enabled: true,
        conditions,
        action_type: actionType,
        action_value: isFormula ? 0 : actionValue,
        action_formula: isFormula ? formula.trim() : null,
        sort_order: rules.length,
      };
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      toast.success(editingId
        ? 'شرط و فرمول ویرایش شد و از همین حالا روی قیمت اعمال می‌شود'
        : 'شرط قیمت‌گذاری ثبت شد و از همین حالا در فرم سفارش اعمال می‌شود');
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error('خطا در ثبت شرط: ' + (e?.message || 'نامشخص'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border-2 border-emerald-300 bg-emerald-50/40 p-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Sigma className="w-4 h-4 text-emerald-600" />
          شرط‌های مؤثر بر قیمت «{categoryLabel}» ({rules.length.toLocaleString('fa-IR')})
        </Label>
        <Button size="sm" variant={open ? 'ghost' : 'default'} onClick={() => setOpen((v) => !v)}>
          {open ? <X className="w-4 h-4 ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
          {open ? 'بستن' : 'ساخت شرط جدید'}
        </Button>
      </div>

      {!rules.length && !open && (
        <p className="text-xs text-muted-foreground">
          هنوز شرط مؤثری ساخته نشده. شرط‌هایی که اینجا می‌سازید مستقیماً قیمت فرم سفارش را تغییر می‌دهند.
        </p>
      )}

      {/* فهرست شرط‌های فعال */}
      {rules.length > 0 && (
        <ul className="space-y-2 mb-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className={`flex flex-wrap items-center gap-2 rounded-md border p-2 bg-background ${
                r.is_enabled ? 'border-emerald-300' : 'border-border opacity-60'
              }`}
            >
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-muted-foreground leading-6">
                  اگر {(r.conditions || []).map(describeCondition).join(' و ')} ←{' '}
                  <span className="text-emerald-700 font-bold">
                    {describeAction(r.action_type, r.action_value, r.action_formula)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{r.is_enabled ? 'فعال' : 'غیرفعال'}</span>
                <Switch
                  checked={r.is_enabled}
                  onCheckedChange={(v) => onUpdate(r.id, { is_enabled: v })}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  title="ویرایش شرط و فرمول"
                  onClick={() => startEditing(r)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (confirm(`حذف شرط «${r.title}»؟`)) onDelete(r.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* شرط‌ساز مرحله‌ای */}
      {open && (
        <div className="space-y-3 rounded-lg border border-emerald-300 bg-background p-3">
          <div>
            <Label className="text-xs mb-1 block">۱) نام شرط (برای خودتان و نمایش در ریز محاسبات)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: ارتفاع بلند نسبت به طول"
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block">۲) شرط‌ها (همه باید برقرار باشند)</Label>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="rounded-md border border-border p-2 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-2">
                    <Select
                      value={c.left}
                      onValueChange={(v) => patchCondition(i, { left: v as RuleMetric })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(METRIC_LABELS) as RuleMetric[]).map((m) => (
                          <SelectItem key={m} value={m}>{METRIC_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={c.operator}
                      onValueChange={(v) => patchCondition(i, { operator: v as RuleOperator })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(OPERATOR_LABELS) as RuleOperator[]).map((o) => (
                          <SelectItem key={o} value={o}>{OPERATOR_LABELS[o]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_40px] gap-2 items-center">
                    <Select
                      value={c.rightKind}
                      onValueChange={(v) => patchCondition(i, { rightKind: v as 'number' | 'metric' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">یک عدد ثابت</SelectItem>
                        <SelectItem value="metric">ضریبی از یک متغیر دیگر</SelectItem>
                      </SelectContent>
                    </Select>

                    {c.rightKind === 'number' ? (
                      <Input
                        value={numInput(c.number)}
                        onChange={(e) => {
                          const n = parseLocalizedNumber(e.target.value.replace(/,/g, ''));
                          patchCondition(i, { number: Number.isNaN(n) ? 0 : n });
                        }}
                        dir="ltr"
                        className="text-left"
                        placeholder="مقدار"
                      />
                    ) : (
                      <>
                        <Input
                          value={numInput(c.factor)}
                          onChange={(e) => {
                            const n = parseLocalizedNumber(e.target.value.replace(/,/g, ''));
                            patchCondition(i, { factor: Number.isNaN(n) ? 1 : n });
                          }}
                          dir="ltr"
                          className="text-left"
                          placeholder="ضریب (مثلاً ۲)"
                        />
                        <Select
                          value={c.metric || 'length'}
                          onValueChange={(v) => patchCondition(i, { metric: v as RuleMetric })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(METRIC_LABELS) as RuleMetric[]).map((m) => (
                              <SelectItem key={m} value={m}>{METRIC_LABELS[m]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}

                    {conditions.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive"
                        onClick={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-emerald-700">{describeCondition(c)}</p>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
            >
              <Plus className="w-4 h-4 ml-1" /> افزودن شرط دیگر (و)
            </Button>
          </div>

          <div>
            <Label className="text-xs mb-1 block">۳) اگر شرط برقرار بود، با قیمت چه کار شود؟</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
              {(Object.keys(ACTION_LABELS) as RuleActionType[]).map((a) => (
                <Button
                  key={a}
                  type="button"
                  variant={actionType === a ? 'default' : 'outline'}
                  className="h-auto min-h-10 whitespace-normal justify-start text-right"
                  onClick={() => setActionType(a)}
                >
                  {a === 'add_formula' && <Calculator className="w-4 h-4 ml-1 shrink-0" />}
                  {ACTION_LABELS[a]}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {!isFormula && (
                <Input
                  value={actionValue ? actionValue.toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const n = parseLocalizedNumber(e.target.value.replace(/,/g, ''));
                    setActionValue(Number.isNaN(n) ? 0 : n);
                  }}
                  dir="ltr"
                  className="text-left"
                  placeholder="مقدار"
                />
              )}
            </div>
          </div>

          {/* فرمول محاسباتی آزاد */}
          {isFormula && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50/40 p-2 space-y-2">
              <Label className="text-xs block">
                فرمول محاسبه مبلغی که به قیمت کل اضافه می‌شود
              </Label>
              <Textarea
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                dir="ltr"
                className="text-left font-mono text-sm min-h-[70px] bg-background"
                placeholder="((height - 2 * length) * length) * 0.30 * unit_fee"
              />
              <div className="flex flex-wrap gap-1">
                {(Object.keys(METRIC_LABELS) as RuleMetric[]).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setFormula((prev) => (prev ? `${prev} ${m}` : m))}
                    className="h-7 px-2 text-[11px]"
                  >
                    {METRIC_LABELS[m]} <span className="font-mono text-emerald-700">{m}</span>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {['(', ')', '+', '−', '×', '÷', '30%'].map((token) => (
                  <Button
                    key={token}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 min-w-9 px-2 font-mono"
                    onClick={() => setFormula((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${token} `)}
                  >
                    {token}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full whitespace-normal h-auto py-2"
                onClick={() => setFormula('((height - 2 * length) * length) * 30% * unit_fee')}
              >
                درج فرمول نمونه: مازاد ارتفاع × طول × ۳۰٪ × فی هر متر
              </Button>
              <p className="text-[11px] text-muted-foreground leading-6">
                مثال: «اگر شرط‌های بالا برقرار بود، (ارتفاع منهای ۲ برابر طول) ضرب در طول، ضرب در
                ۳۰٪ فی هر متر، به قیمت کل اضافه شود» ←{' '}
                <span className="font-mono" dir="ltr">((height - 2 * length) * length) * 0.30 * unit_fee</span>
                <br />
                عملگرهای مجاز: + − × ÷ و پرانتز. «فی هر متر» اگر جداگانه تعیین نشده باشد، از تقسیم
                قیمت پایه بر متراژ محاسبه می‌شود.
              </p>
              {formula.trim() && !formulaValid && (
                <p className="text-xs text-destructive">فرمول معتبر نیست؛ متغیرها یا پرانتزها را بررسی کنید.</p>
              )}
              {samplePreview !== null && (
                <p className="text-xs text-emerald-700">
                  نمونه محاسبه (طول ۶، ارتفاع ۲۰، متراژ ۱۲۰، فی ۳۰٬۰۰۰):{' '}
                  <b>{Math.round(samplePreview).toLocaleString('fa-IR')} تومان</b> به قیمت اضافه می‌شود
                </p>
              )}
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-2 text-xs leading-6">
            <Wand2 className="inline w-3.5 h-3.5 ml-1 text-emerald-600" />
            پیش‌نمایش: اگر {conditions.map(describeCondition).join(' و ')} ←{' '}
            <b className="text-emerald-700">
              {describeAction(actionType, actionValue, formula)}
            </b>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
              {editingId ? 'ذخیره ویرایش شرط و فرمول' : 'ثبت شرط مؤثر بر قیمت'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
