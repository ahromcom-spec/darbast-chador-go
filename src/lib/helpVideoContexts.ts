// Registry of all known contextual help video slots across the platform.
// contextKey values are stable identifiers stored in the help_videos table.

export interface HelpVideoContext {
  key: string;
  label: string;
  group: string;
}

export const HELP_VIDEO_CONTEXTS: HelpVideoContext[] = [
  { key: 'home', label: 'صفحه نخست سایت', group: 'عمومی' },
  { key: 'globe-map', label: 'نقشه کره زمین (موقعیت پروژه)', group: 'عمومی' },
  { key: 'select-location', label: 'انتخاب لوکیشن پروژه روی نقشه', group: 'عمومی' },

  { key: 'profile-overview', label: 'پروفایل - اطلاعات شخصی', group: 'پروفایل کاربری' },
  { key: 'profile-projects', label: 'پروفایل - پروژه‌های من', group: 'پروفایل کاربری' },
  { key: 'profile-orders', label: 'پروفایل - سفارشات من', group: 'پروفایل کاربری' },
  { key: 'profile-invoice', label: 'پروفایل - صورتحساب من', group: 'پروفایل کاربری' },
  { key: 'profile-modules', label: 'پروفایل - ماژول‌ها', group: 'پروفایل کاربری' },
  { key: 'profile-security', label: 'پروفایل - امنیت', group: 'پروفایل کاربری' },
  { key: 'profile-actions', label: 'پروفایل - دسترسی سریع', group: 'پروفایل کاربری' },

  { key: 'order-form-scaffolding', label: 'فرم سفارش داربست فلزی', group: 'فرم‌های سفارش' },
  { key: 'order-form-scaffolding-facade', label: 'فرم داربست نما', group: 'فرم‌های سفارش' },
  { key: 'order-form-rental', label: 'فرم اجاره داربست', group: 'فرم‌های سفارش' },
  { key: 'order-form-custom-service', label: 'فرم خدمات سفارشی', group: 'فرم‌های سفارش' },
  { key: 'order-form-carpet-cleaning', label: 'فرم قالیشویی', group: 'فرم‌های سفارش' },

  { key: 'module-daily-report', label: 'ماژول گزارش روزانه', group: 'ماژول‌های مدیریتی' },
  { key: 'module-sms-management', label: 'ماژول مدیریت پیامک', group: 'ماژول‌های مدیریتی' },
  { key: 'module-scaffolding-pricing', label: 'ماژول قیمت‌گذاری داربست', group: 'ماژول‌های مدیریتی' },
  { key: 'module-media-approval', label: 'ماژول مدیریت رسانه‌ها', group: 'ماژول‌های مدیریتی' },
  { key: 'module-accounting', label: 'ماژول حسابداری', group: 'ماژول‌های مدیریتی' },
  { key: 'module-bank-cards', label: 'ماژول کارت‌های بانکی', group: 'ماژول‌های مدیریتی' },
  { key: 'module-hr', label: 'ماژول منابع انسانی', group: 'ماژول‌های مدیریتی' },
  { key: 'module-all-orders', label: 'ماژول مدیریت کل سفارشات', group: 'ماژول‌های مدیریتی' },
];

export const HELP_VIDEO_GROUPS = Array.from(
  new Set(HELP_VIDEO_CONTEXTS.map((c) => c.group))
);

export const getContextLabel = (key: string) =>
  HELP_VIDEO_CONTEXTS.find((c) => c.key === key)?.label || key;
