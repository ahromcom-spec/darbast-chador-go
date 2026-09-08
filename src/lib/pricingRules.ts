/**
 * موتور «شرط‌های ساختاریافته قیمت‌گذاری»
 *
 * مدیر ارشد در ماژول قیمت‌گذاری، شرط‌ها را مرحله‌ای می‌سازد
 * (مثلاً: اگر ارتفاع بیشتر از ۲ برابر طول بود و طول ≥ ۶ متر بود → ۳۰٪ افزایش)
 * و این شرط‌ها هنگام محاسبه قیمت در فرم سفارش داربست اعمال می‌شوند.
 */

export type RuleOperator = '>' | '>=' | '<' | '<=' | '=' | '!=';

export type RuleMetric =
  | 'length'
  | 'width'
  | 'height'
  | 'area'
  | 'total_length'
  | 'pipe_length'
  | 'platform_height'
  | 'scaffold_height'
  | 'vehicle_distance'
  | 'distance_km'
  | 'months'
  | 'unit_fee'
  | 'base_price';

export type RuleActionType =
  | 'increase_percent'
  | 'decrease_percent'
  | 'add_amount'
  | 'min_price'
  | 'set_price'
  | 'add_formula';

export interface RuleCondition {
  /** متغیر سمت راست شرط (چیزی که سنجیده می‌شود) */
  left: RuleMetric;
  operator: RuleOperator;
  /** مقایسه با یک عدد ثابت یا با ضریبی از یک متغیر دیگر */
  rightKind: 'number' | 'metric';
  /** وقتی rightKind = number */
  number?: number;
  /** وقتی rightKind = metric */
  metric?: RuleMetric;
  /** ضریب متغیر مقایسه‌ای (مثلاً ۲ برابر طول) */
  factor?: number;
}

export interface PricingRule {
  id: string;
  config_table: string;
  category: string;
  title: string;
  is_enabled: boolean;
  conditions: RuleCondition[];
  action_type: RuleActionType;
  action_value: number;
  /** فرمول محاسباتی (وقتی action_type = add_formula) مثل: ((height - 2*length) * length) * 0.3 * unit_fee */
  action_formula?: string | null;
  sort_order: number;
}

export type RuleMetrics = Partial<Record<RuleMetric, number>>;

export const METRIC_LABELS: Record<RuleMetric, string> = {
  length: 'طول داربست (متر)',
  width: 'عرض داربست (متر)',
  height: 'ارتفاع داربست (متر)',
  area: 'مجموع متراژ محاسبه‌شده',
  total_length: 'مجموع طول‌ها (متر)',
  pipe_length: 'طول لوله مصرفی (متر)',
  platform_height: 'ارتفاع پای کار (متر)',
  scaffold_height: 'ارتفاع داربست از پای کار (متر)',
  vehicle_distance: 'فاصله خودرو تا محل اجرا (متر)',
  distance_km: 'فاصله از مرکز شهر (کیلومتر)',
  months: 'تعداد ماه اجاره',
  unit_fee: 'فی هر متر (تومان)',
  base_price: 'قیمت پایه محاسبه‌شده (تومان)',
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  '>': 'بیشتر از',
  '>=': 'بیشتر یا مساوی',
  '<': 'کمتر از',
  '<=': 'کمتر یا مساوی',
  '=': 'مساوی',
  '!=': 'مساوی نباشد با',
};

export const ACTION_LABELS: Record<RuleActionType, string> = {
  increase_percent: 'افزایش قیمت (درصد)',
  decrease_percent: 'تخفیف قیمت (درصد)',
  add_amount: 'افزودن مبلغ ثابت (تومان)',
  min_price: 'حداقل قیمت (تومان)',
  set_price: 'قیمت ثابت نهایی (تومان)',
  add_formula: 'افزودن نتیجه فرمول محاسباتی (تومان)',
};

/* ==========================================================================
 * ارزیاب فرمول‌های محاسباتی مدیر
 * پشتیبانی: + - * / ( ) درصد به‌صورت عدد اعشاری، و متغیرهای METRIC_LABELS
 * ========================================================================== */

const toEnDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/** ارزیابی امن یک عبارت ریاضی با متغیرها. در صورت خطا null برمی‌گرداند. */
export const evaluateFormula = (
  expression: string | null | undefined,
  metrics: RuleMetrics,
): number | null => {
  if (!expression || !expression.trim()) return null;
  const src = toEnDigits(expression)
    .replace(/[×✕✖xX]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/[٫]/g, '.')
    .replace(/\s+/g, '');

  let i = 0;
  const eof = () => i >= src.length;
  const peek = () => src[i];

  const parseExpr = (): number => {
    let value = parseTerm();
    while (!eof() && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    while (!eof() && (peek() === '*' || peek() === '/' || peek() === '%')) {
      const op = src[i++];
      if (op === '%') {
        // درصد به‌صورت پسوندی: 30% => 0.3
        value = value / 100;
        continue;
      }
      const rhs = parseUnary();
      value = op === '*' ? value * rhs : rhs === 0 ? 0 : value / rhs;
    }
    return value;
  };

  const parseUnary = (): number => {
    if (!eof() && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const v = parseUnary();
      return op === '-' ? -v : v;
    }
    return parseAtom();
  };

  const parseAtom = (): number => {
    if (eof()) throw new Error('پایان نامنتظره');
    if (peek() === '(') {
      i++;
      const v = parseExpr();
      if (peek() !== ')') throw new Error('پرانتز بسته نشده');
      i++;
      return applyPercentSuffix(v);
    }
    const numMatch = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
    if (numMatch) {
      i += numMatch[0].length;
      return applyPercentSuffix(Number(numMatch[0]));
    }
    const idMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i));
    if (idMatch) {
      i += idMatch[0].length;
      const key = idMatch[0] as RuleMetric;
      if (!(key in METRIC_LABELS)) throw new Error(`متغیر ناشناخته: ${idMatch[0]}`);
      return applyPercentSuffix(Number(metrics[key]) || 0);
    }
    throw new Error(`نویسه نامعتبر: ${peek()}`);
  };

  const applyPercentSuffix = (v: number): number => {
    if (!eof() && peek() === '%' && src[i + 1] !== undefined && /[*/+\-)]/.test(src[i + 1])) {
      i++;
      return v / 100;
    }
    if (!eof() && peek() === '%' && i + 1 >= src.length) {
      i++;
      return v / 100;
    }
    return v;
  };

  try {
    const result = parseExpr();
    if (!eof()) return null;
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

/** بررسی معتبر بودن فرمول برای نمایش خطا به مدیر */
export const validateFormula = (expression: string): boolean =>
  evaluateFormula(expression, {
    length: 1, width: 1, height: 1, area: 1, total_length: 1, pipe_length: 1,
    platform_height: 1, scaffold_height: 1, vehicle_distance: 1, distance_km: 1,
    months: 1, unit_fee: 1, base_price: 1,
  }) !== null;

const compare = (a: number, op: RuleOperator, b: number): boolean => {
  switch (op) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return Math.abs(a - b) < 1e-9;
    case '!=': return Math.abs(a - b) >= 1e-9;
    default: return false;
  }
};

/** متن خوانا برای نمایش یک شرط به مدیر */
export const describeCondition = (c: RuleCondition): string => {
  const right =
    c.rightKind === 'metric'
      ? `${(c.factor ?? 1) === 1 ? '' : `${c.factor} برابر `}${METRIC_LABELS[c.metric || 'length']}`
      : `${(c.number ?? 0).toLocaleString('fa-IR')}`;
  return `${METRIC_LABELS[c.left]} ${OPERATOR_LABELS[c.operator]} ${right}`;
};

/** فرمول را برای مدیر به زبان فارسی بازنویسی می‌کند */
export const describeFormula = (formula: string): string => {
  let out = formula;
  (Object.keys(METRIC_LABELS) as RuleMetric[])
    .sort((a, b) => b.length - a.length)
    .forEach((m) => {
      out = out.split(m).join(`«${METRIC_LABELS[m]}»`);
    });
  return out;
};

export const describeAction = (
  type: RuleActionType,
  value: number,
  formula?: string | null,
): string => {
  const v = (value || 0).toLocaleString('fa-IR');
  switch (type) {
    case 'increase_percent': return `${v}٪ افزایش قیمت`;
    case 'decrease_percent': return `${v}٪ تخفیف`;
    case 'add_amount': return `${v} تومان افزوده شود`;
    case 'min_price': return `حداقل ${v} تومان`;
    case 'set_price': return `قیمت ثابت ${v} تومان`;
    case 'add_formula':
      return formula
        ? `نتیجه فرمول ${describeFormula(formula)} به قیمت افزوده شود`
        : 'نتیجه فرمول به قیمت افزوده شود';
    default: return '';
  }
};

export const describeRule = (rule: PricingRule): string => {
  const conds = (rule.conditions || []).map(describeCondition).join(' و ');
  const act = describeAction(rule.action_type, rule.action_value, rule.action_formula);
  return conds ? `اگر ${conds} ← ${act}` : act;
};

const conditionHolds = (c: RuleCondition, metrics: RuleMetrics): boolean => {
  const leftVal = metrics[c.left];
  if (leftVal === undefined || !Number.isFinite(leftVal)) return false;
  let rightVal: number;
  if (c.rightKind === 'metric') {
    const mv = metrics[c.metric || 'length'];
    if (mv === undefined || !Number.isFinite(mv)) return false;
    rightVal = mv * (c.factor ?? 1);
  } else {
    rightVal = Number(c.number) || 0;
  }
  return compare(leftVal, c.operator, rightVal);
};

export const ruleMatches = (rule: PricingRule, metrics: RuleMetrics): boolean => {
  if (!rule.is_enabled) return false;
  const conds = rule.conditions || [];
  if (!conds.length) return false;
  return conds.every((c) => conditionHolds(c, metrics));
};

export interface RulesResult {
  /** قیمت پس از اعمال شرط‌ها */
  price: number;
  /** خطوط توضیح برای نمایش در ریز محاسبات */
  lines: string[];
  /** آیا شرطی اعمال شد */
  applied: boolean;
}

/**
 * اعمال شرط‌ها روی قیمت پایه. ترتیب اعمال بر اساس sort_order است.
 * درصدها روی قیمت پایه (قبل از اعمال شرط‌ها) حساب می‌شوند تا نتیجه قابل پیش‌بینی بماند.
 */
export const applyPricingRules = (
  rules: PricingRule[],
  metrics: RuleMetrics,
  basePrice: number,
): RulesResult => {
  const lines: string[] = [];
  if (!rules?.length || !Number.isFinite(basePrice)) {
    return { price: basePrice, lines, applied: false };
  }

  const derivedUnitFee =
    metrics.unit_fee && metrics.unit_fee > 0
      ? metrics.unit_fee
      : metrics.area && metrics.area > 0
        ? basePrice / metrics.area
        : 0;
  const withBase: RuleMetrics = { ...metrics, base_price: basePrice, unit_fee: derivedUnitFee };
  const sorted = [...rules].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  let price = basePrice;
  let percentSum = 0;
  let addSum = 0;
  let minPrice: number | null = null;
  let fixedPrice: number | null = null;
  let applied = false;

  for (const rule of sorted) {
    if (!ruleMatches(rule, withBase)) continue;
    applied = true;
    const v = Number(rule.action_value) || 0;
    const name = rule.title?.trim() ? rule.title.trim() : 'شرط قیمت‌گذاری';
    switch (rule.action_type) {
      case 'increase_percent':
        percentSum += v;
        lines.push(`${name}: +${v.toLocaleString('fa-IR')}٪`);
        break;
      case 'decrease_percent':
        percentSum -= v;
        lines.push(`${name}: -${v.toLocaleString('fa-IR')}٪`);
        break;
      case 'add_amount':
        addSum += v;
        lines.push(`${name}: +${v.toLocaleString('fa-IR')} تومان`);
        break;
      case 'min_price':
        minPrice = Math.max(minPrice ?? 0, v);
        lines.push(`${name}: حداقل ${v.toLocaleString('fa-IR')} تومان`);
        break;
      case 'set_price':
        fixedPrice = v;
        lines.push(`${name}: قیمت ثابت ${v.toLocaleString('fa-IR')} تومان`);
        break;
    }
  }

  if (!applied) return { price: basePrice, lines, applied: false };

  if (fixedPrice !== null) {
    price = fixedPrice;
  } else {
    price = basePrice * (1 + percentSum / 100) + addSum;
    if (minPrice !== null && price < minPrice) price = minPrice;
  }

  return { price, lines, applied: true };
};

/** نگاشت نوع داربست انتخابی در فرم به بخش (category) ماژول قیمت‌گذاری */
export const serviceToRuleCategory = (activeService: string): string => {
  switch (activeService) {
    case 'facade': return 'facade';
    case 'formwork': return 'formwork';
    case 'ceiling-beam-yonolit':
    case 'ceiling-beam-ceramic': return 'ceiling_beam';
    case 'ceiling-slab': return 'ceiling_slab';
    case 'column': return 'column';
    case 'pipe-length': return 'pipe_length';
    default: return activeService || '';
  }
};
