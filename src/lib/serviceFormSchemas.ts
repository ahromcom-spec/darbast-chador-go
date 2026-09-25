export type FieldType = 'number' | 'select' | 'boolean' | 'text';

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  required?: boolean;
  /** number fields: multiplies the rest of the priced total (e.g. months / days) */
  multiplier?: boolean;
  /** not priced (informational only) */
  info?: boolean;
}

const months: FormField = { key: 'months', label: 'مدت کرایه', type: 'number', unit: 'ماه', multiplier: true };
const days: FormField = { key: 'days', label: 'مدت کرایه', type: 'number', unit: 'روز', multiplier: true };
const transport: FormField = { key: 'transport', label: 'نیاز به حمل و نقل', type: 'boolean' };
const floor: FormField = { key: 'floor', label: 'طبقه محل کار', type: 'number', info: true };

const bySubName: Array<[RegExp, FormField[]]> = [
  [/چادر.*(اجناس|گرایه چادر برزنتی به همراه)/, [
    { key: 'area', label: 'متراژ چادر', type: 'number', unit: 'متر مربع', required: true },
    { key: 'height', label: 'ارتفاع نصب', type: 'number', unit: 'متر', info: true },
    months, transport,
  ]],
  [/چادر.*بدون/, [
    { key: 'area', label: 'متراژ اجرای چادر', type: 'number', unit: 'متر مربع', required: true },
    { key: 'height', label: 'ارتفاع نصب', type: 'number', unit: 'متر', info: true },
  ]],
  [/گرایه چادر|کرایه چادر/, [
    { key: 'area', label: 'متراژ چادر', type: 'number', unit: 'متر مربع', required: true },
    months, transport,
  ]],
  [/(خرید|فروش|تولید)/, [
    { key: 'item', label: 'نوع جنس', type: 'text', required: true },
    { key: 'quantity', label: 'تعداد / متراژ', type: 'number', required: true },
    transport,
  ]],
  [/فنس/, [
    { key: 'length', label: 'طول فنس', type: 'number', unit: 'متر', required: true },
    { key: 'height', label: 'ارتفاع فنس', type: 'select', options: ['۱.۵ متر', '۲ متر', '۲.۵ متر'] },
    { key: 'mesh', label: 'نوع توری', type: 'select', options: ['توری مرغی', 'توری حصاری', 'توری گالوانیزه'] },
    { key: 'posts', label: 'تعداد پایه', type: 'number', unit: 'عدد' },
    { key: 'install', label: 'با نصب', type: 'boolean' },
  ]],
];

const byTypeName: Array<[RegExp, FormField[]]> = [
  [/ارماتور|آرماتور/, [
    { key: 'weight', label: 'وزن تقریبی آرماتور', type: 'number', unit: 'تن', required: true },
    { key: 'structure', label: 'نوع سازه', type: 'select', options: ['فونداسیون', 'سقف', 'ستون', 'دیوار'] },
    floor,
  ]],
  [/ابزار/, [
    { key: 'tool', label: 'نوع ابزار', type: 'select', options: ['بالابر', 'میکسر', 'ویبراتور', 'جک', 'سایر'] },
    { key: 'quantity', label: 'تعداد', type: 'number', unit: 'عدد', required: true },
    days, transport,
  ]],
  [/سیمان/, [
    { key: 'area', label: 'متراژ کار', type: 'number', unit: 'متر مربع', required: true },
    { key: 'work', label: 'نوع کار', type: 'select', options: ['کف', 'دیوار', 'نما', 'سقف'] },
    { key: 'height', label: 'ارتفاع کار', type: 'number', unit: 'متر', info: true },
  ]],
  [/فنس/, bySubName[4][1]],
  [/چادر/, bySubName[0][1]],
];

const fallback: FormField[] = [
  { key: 'area', label: 'متراژ / مقدار کار', type: 'number', required: true },
  { key: 'quantity', label: 'تعداد', type: 'number', unit: 'عدد' },
  transport,
];

export function getFormSchema(serviceName: string, subName: string, stored?: unknown): FormField[] {
  if (Array.isArray(stored) && stored.length) return stored as FormField[];
  const s = subName || '';
  const t = serviceName || '';
  // type-specific first for "خدمات عمومی" style subcategories
  const typeHit = byTypeName.find(([r]) => r.test(t));
  if (typeHit && !/چادر/.test(t)) return typeHit[1];
  const subHit = bySubName.find(([r]) => r.test(s));
  if (subHit) return subHit[1];
  return typeHit?.[1] || fallback;
}

export interface Rate { field_key: string; option_value: string; unit_price: number }
export const BASE_KEY = '__base';

export interface EstimateLine { label: string; amount: number }

export function computeEstimate(fields: FormField[], values: Record<string, any>, rates: Rate[]) {
  const rate = (k: string, o = '') => Number(rates.find(r => r.field_key === k && r.option_value === o)?.unit_price || 0);
  const lines: EstimateLine[] = [];
  let mult = 1;
  for (const f of fields) {
    if (f.info) continue;
    const v = values[f.key];
    if (f.type === 'number') {
      const n = Number(v) || 0;
      if (f.multiplier) { if (n > 0) mult *= n; continue; }
      const r = rate(f.key);
      if (n > 0 && r > 0) lines.push({ label: `${f.label} (${n} ${f.unit || ''} × ${r.toLocaleString('fa-IR')})`, amount: n * r });
    } else if (f.type === 'select' && v) {
      const r = rate(f.key, v);
      if (r > 0) lines.push({ label: `${f.label}: ${v}`, amount: r });
    } else if (f.type === 'boolean' && v) {
      const r = rate(f.key);
      if (r > 0) lines.push({ label: f.label, amount: r });
    }
  }
  const base = rate(BASE_KEY);
  if (base > 0) lines.unshift({ label: 'هزینه پایه', amount: base });
  let total = lines.reduce((a, l) => a + l.amount, 0);
  if (mult > 1) total *= mult;
  const hasPricing = rates.some(r => Number(r.unit_price) > 0);
  return { lines, multiplier: mult, total, hasPricing };
}
