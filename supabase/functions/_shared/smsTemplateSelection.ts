// انتخاب قالب پیامک برای هر سفارش بر اساس نوع خدمت (زیرشاخه) سفارش.
// قاعده: پیام تخصصیِ فعالِ همان خدمت ← در غیر این صورت پیام عمومیِ فعالی که این خدمت را استثنا نکرده ← در غیر این صورت ارسال نمی‌شود.

export interface SelectableSmsTemplate {
  id?: string;
  key: string;
  stage_key?: string | null;
  enabled: boolean;
  service_subcategory_ids?: string[] | null;
  excluded_subcategory_ids?: string[] | null;
  updated_at?: string | null;
}

export type SmsTemplateSelection<T> =
  | { kind: "specific"; template: T }
  | { kind: "general"; template: T }
  | { kind: "excluded"; template: T }
  | { kind: "disabled"; template: T }
  | { kind: "none" };

export const stageOf = (t: SelectableSmsTemplate): string => (t.stage_key || t.key);
export const targetsOf = (t: SelectableSmsTemplate): string[] => (t.service_subcategory_ids || []).filter(Boolean);
export const isGeneralTemplate = (t: SelectableSmsTemplate): boolean => targetsOf(t).length === 0;

const newestFirst = <T extends SelectableSmsTemplate>(a: T, b: T) =>
  String(b.updated_at || "").localeCompare(String(a.updated_at || ""));

export function selectSmsTemplate<T extends SelectableSmsTemplate>(
  templates: T[],
  stage: string,
  subcategoryId?: string | null,
): SmsTemplateSelection<T> {
  const ofStage = templates.filter((t) => stageOf(t) === stage);
  if (ofStage.length === 0) return { kind: "none" };

  if (subcategoryId) {
    const specific = ofStage
      .filter((t) => t.enabled && !isGeneralTemplate(t) && targetsOf(t).includes(subcategoryId))
      .sort(newestFirst)[0];
    if (specific) return { kind: "specific", template: specific };
  }

  // پیام عمومی اصلی همین مرحله (کلید برابر مرحله) مقدم است
  const generals = ofStage.filter(isGeneralTemplate).sort((a, b) =>
    (a.key === stage ? -1 : 0) - (b.key === stage ? -1 : 0) || newestFirst(a, b));
  const enabledGeneral = generals.find((t) => t.enabled);
  if (enabledGeneral) {
    if (subcategoryId && (enabledGeneral.excluded_subcategory_ids || []).includes(subcategoryId)) {
      return { kind: "excluded", template: enabledGeneral };
    }
    return { kind: "general", template: enabledGeneral };
  }
  if (generals[0]) return { kind: "disabled", template: generals[0] };
  // فقط پیام‌های تخصصی وجود دارند و هیچ‌کدام برای این خدمت نیست
  return { kind: "none" };
}

/** خدماتی که در بیش از یک پیام تخصصیِ فعالِ یک مرحله انتخاب شده‌اند (تداخل). */
export function findServiceConflicts<T extends SelectableSmsTemplate>(templates: T[]): Map<string, string[]> {
  const byStageService = new Map<string, string[]>();
  for (const t of templates) {
    if (!t.enabled || isGeneralTemplate(t)) continue;
    for (const s of targetsOf(t)) {
      const k = `${stageOf(t)}|${s}`;
      byStageService.set(k, [...(byStageService.get(k) || []), t.key]);
    }
  }
  const conflicts = new Map<string, string[]>();
  for (const [k, keys] of byStageService) if (keys.length > 1) conflicts.set(k, keys);
  return conflicts;
}

/** کلید یکتا برای نسخه تخصصی یک مرحله */
export const makeVariantKey = (stage: string, rand: string = Math.random().toString(36).slice(2, 8)) =>
  `${stage}__svc_${rand}`;
