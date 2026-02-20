import {
  Building2,
  ClipboardList,
  Users,
  Calculator,
  Receipt,
  CreditCard,
  UserPlus,
  BarChart3,
  Image,
  Landmark,
  BookOpen,
  FileSpreadsheet,
  type LucideProps,
} from 'lucide-react';
import type { FC } from 'react';

/**
 * Maps module keys to relevant Lucide icons.
 * Falls back to name-based heuristics for custom/copied modules.
 */
const KEY_MAP: Record<string, FC<LucideProps>> = {
  scaffold_execution_with_materials: Landmark,        // داربست
  daily_report: ClipboardList,                         // گزارش روزانه
  hr_management: Users,                                // منابع انسانی
  personnel_accounting: Calculator,                    // حسابکتاب پرسنل
  my_invoice: Receipt,                                 // صورتحساب من
  bank_cards: CreditCard,                              // کارت بانکی
  site_registration: UserPlus,                         // ثبت‌نام
  comprehensive_accounting: BookOpen,                  // حسابداری جامع
  customer_comprehensive_invoice: FileSpreadsheet,     // صورتحساب جامع مشتریان
  site_analytics: BarChart3,                           // آمار بازدید
  media_approval: Image,                               // رسانه‌ها
};

const NAME_PATTERNS: [RegExp, FC<LucideProps>][] = [
  [/گزارش روزانه/, ClipboardList],
  [/منابع انسانی/, Users],
  [/حسابکتاب|کارکرد/, Calculator],
  [/صورتحساب/, Receipt],
  [/کارت.*بانک|بانک.*کارت/, CreditCard],
  [/ثبت[‌ ]?نام/, UserPlus],
  [/حسابداری جامع/, BookOpen],
  [/صورتحساب جامع مشتری/, FileSpreadsheet],
  [/آمار|بازدید/, BarChart3],
  [/رسانه/, Image],
  [/داربست|اجرایی|سفارش/, Landmark],
];

export function getModuleIconByKey(moduleKey: string, moduleName?: string): FC<LucideProps> {
  if (KEY_MAP[moduleKey]) return KEY_MAP[moduleKey];

  // For custom/copied modules, try matching by name
  if (moduleName) {
    for (const [pattern, icon] of NAME_PATTERNS) {
      if (pattern.test(moduleName)) return icon;
    }
  }

  return Building2;
}
