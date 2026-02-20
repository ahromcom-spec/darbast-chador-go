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

/** Default color + bg for each module key */
const COLOR_MAP: Record<string, { color: string; bgColor: string }> = {
  scaffold_execution_with_materials: { color: 'text-orange-600', bgColor: 'bg-orange-100' },
  daily_report:                      { color: 'text-blue-600',   bgColor: 'bg-blue-100' },
  hr_management:                     { color: 'text-teal-600',   bgColor: 'bg-teal-100' },
  personnel_accounting:              { color: 'text-purple-600', bgColor: 'bg-purple-100' },
  my_invoice:                        { color: 'text-rose-600',   bgColor: 'bg-rose-100' },
  bank_cards:                        { color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  site_registration:                 { color: 'text-green-600',  bgColor: 'bg-green-100' },
  comprehensive_accounting:          { color: 'text-amber-600',  bgColor: 'bg-amber-100' },
  customer_comprehensive_invoice:    { color: 'text-cyan-600',   bgColor: 'bg-cyan-100' },
  site_analytics:                    { color: 'text-sky-600',    bgColor: 'bg-sky-100' },
  media_approval:                    { color: 'text-pink-600',   bgColor: 'bg-pink-100' },
};

const NAME_COLOR_PATTERNS: [RegExp, { color: string; bgColor: string }][] = [
  [/گزارش روزانه/, { color: 'text-blue-600', bgColor: 'bg-blue-100' }],
  [/منابع انسانی/, { color: 'text-teal-600', bgColor: 'bg-teal-100' }],
  [/حسابکتاب|کارکرد/, { color: 'text-purple-600', bgColor: 'bg-purple-100' }],
  [/صورتحساب جامع مشتری/, { color: 'text-cyan-600', bgColor: 'bg-cyan-100' }],
  [/صورتحساب/, { color: 'text-rose-600', bgColor: 'bg-rose-100' }],
  [/کارت.*بانک|بانک.*کارت/, { color: 'text-indigo-600', bgColor: 'bg-indigo-100' }],
  [/ثبت[‌ ]?نام/, { color: 'text-green-600', bgColor: 'bg-green-100' }],
  [/حسابداری جامع/, { color: 'text-amber-600', bgColor: 'bg-amber-100' }],
  [/آمار|بازدید/, { color: 'text-sky-600', bgColor: 'bg-sky-100' }],
  [/رسانه/, { color: 'text-pink-600', bgColor: 'bg-pink-100' }],
  [/داربست|اجرایی|سفارش/, { color: 'text-orange-600', bgColor: 'bg-orange-100' }],
];

export function getModuleColors(moduleKey: string, moduleName?: string): { color: string; bgColor: string } {
  if (COLOR_MAP[moduleKey]) return COLOR_MAP[moduleKey];
  if (moduleName) {
    for (const [pattern, colors] of NAME_COLOR_PATTERNS) {
      if (pattern.test(moduleName)) return colors;
    }
  }
  return { color: 'text-gray-600', bgColor: 'bg-gray-100' };
}

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
