// Registry of all known contextual help video slots across the platform.
// contextKey values are stable identifiers stored in the help_videos table.

export interface HelpVideoContext {
  key: string;
  label: string;
  group: string;
  /** مسیر صفحه‌ای که این راهنما در آن نمایش داده می‌شود (برای پیش‌نمایش تصویری) */
  route?: string;
  /** توضیح محل دقیق دکمه راهنما در آن صفحه */
  spot?: string;
}

export const HELP_VIDEO_CONTEXTS: HelpVideoContext[] = [
  { key: 'home', label: 'صفحه نخست سایت', group: 'عمومی', route: '/', spot: 'کنار عنوان خدمات در صفحه نخست' },
  { key: 'globe-map', label: 'نقشه کره زمین (موقعیت پروژه)', group: 'عمومی', route: '/globe', spot: 'نوار بالای نقشه' },
  { key: 'select-location', label: 'انتخاب لوکیشن پروژه روی نقشه', group: 'عمومی', route: '/select-location', spot: 'بالای کادر انتخاب مکان' },

  { key: 'profile-overview', label: 'پروفایل - اطلاعات شخصی', group: 'پروفایل کاربری', route: '/profile?tab=overview', spot: 'بالای تب اطلاعات شخصی' },
  { key: 'profile-projects', label: 'پروفایل - پروژه‌های من', group: 'پروفایل کاربری', route: '/profile?tab=projects', spot: 'بالای تب پروژه‌های من' },
  { key: 'profile-orders', label: 'پروفایل - سفارشات من', group: 'پروفایل کاربری', route: '/profile?tab=orders', spot: 'بالای تب سفارشات من' },
  { key: 'profile-invoice', label: 'پروفایل - صورتحساب من', group: 'پروفایل کاربری', route: '/profile?tab=invoice', spot: 'بالای تب صورتحساب من' },
  { key: 'profile-modules', label: 'پروفایل - ماژول‌ها', group: 'پروفایل کاربری', route: '/profile?tab=modules', spot: 'بالای تب ماژول‌ها' },
  { key: 'profile-security', label: 'پروفایل - امنیت', group: 'پروفایل کاربری', route: '/profile?tab=security', spot: 'بالای تب امنیت' },
  { key: 'profile-actions', label: 'پروفایل - دسترسی سریع', group: 'پروفایل کاربری', route: '/profile?tab=actions', spot: 'بالای تب دسترسی سریع' },

  { key: 'order-form-scaffolding', label: 'فرم سفارش داربست فلزی', group: 'فرم‌های سفارش', route: '/scaffolding/form', spot: 'بالای فرم سفارش' },
  { key: 'order-form-scaffolding-facade', label: 'فرم داربست نما', group: 'فرم‌های سفارش', route: '/scaffolding/facade', spot: 'بالای فرم داربست نما' },
  { key: 'order-form-rental', label: 'فرم اجاره داربست', group: 'فرم‌های سفارش', route: '/scaffolding/rental-form', spot: 'بالای فرم اجاره' },
  { key: 'order-form-custom-service', label: 'فرم خدمات سفارشی', group: 'فرم‌های سفارش', route: '/custom-service/form', spot: 'بالای فرم خدمات سفارشی' },
  { key: 'order-form-carpet-cleaning', label: 'فرم قالیشویی', group: 'فرم‌های سفارش', route: '/carpet-cleaning/form', spot: 'بالای فرم قالیشویی' },

  { key: 'module-daily-report', label: 'ماژول گزارش روزانه', group: 'ماژول‌های مدیریتی', route: '/daily-report', spot: 'نوار بالای ماژول' },
  { key: 'module-sms-management', label: 'ماژول مدیریت پیامک', group: 'ماژول‌های مدیریتی', route: '/sms-management', spot: 'نوار بالای ماژول' },
  { key: 'module-scaffolding-pricing', label: 'ماژول قیمت‌گذاری داربست', group: 'ماژول‌های مدیریتی', route: '/scaffolding-pricing', spot: 'نوار بالای ماژول' },
  { key: 'module-media-approval', label: 'ماژول مدیریت رسانه‌ها', group: 'ماژول‌های مدیریتی', route: '/media-approval', spot: 'نوار بالای ماژول' },
  { key: 'module-accounting', label: 'ماژول حسابداری', group: 'ماژول‌های مدیریتی', route: '/comprehensive-accounting', spot: 'نوار بالای ماژول' },
  { key: 'module-bank-cards', label: 'ماژول کارت‌های بانکی', group: 'ماژول‌های مدیریتی', route: '/bank-cards', spot: 'نوار بالای ماژول' },
  { key: 'module-hr', label: 'ماژول منابع انسانی', group: 'ماژول‌های مدیریتی', route: '/hr-management', spot: 'نوار بالای ماژول' },
  { key: 'module-all-orders', label: 'ماژول مدیریت کل سفارشات', group: 'ماژول‌های مدیریتی', route: '/ceo/all-orders', spot: 'نوار بالای ماژول' },
];

export const HELP_VIDEO_GROUPS = Array.from(
  new Set(HELP_VIDEO_CONTEXTS.map((c) => c.group))
);

/** کلید راهنمای شناور (محل آزاد روی صفحه) */
export const isFreeContextKey = (key: string) => key.startsWith('free:');

export const freeContextRoute = (key: string) =>
  isFreeContextKey(key) ? key.slice('free:'.length).split('#')[0] : '';

export const makeFreeContextKey = (route: string) =>
  `free:${route}#${Date.now().toString(36)}`;

export const getContextLabel = (key: string) => {
  const found = HELP_VIDEO_CONTEXTS.find((c) => c.key === key)?.label;
  if (found) return found;
  if (isFreeContextKey(key)) {
    const route = freeContextRoute(key);
    const page = HELP_VIDEO_PAGES.find((p) => p.route === route);
    return `محل آزاد در ${page?.title || route}`;
  }
  return key;
};

export const getContext = (key: string) =>
  HELP_VIDEO_CONTEXTS.find((c) => c.key === key);

/** گروه‌بندی محل‌های راهنما بر اساس صفحه (برای انتخاب تصویری) */
export interface HelpVideoPage {
  route: string;
  title: string;
  group: string;
  spots: HelpVideoContext[];
}

export const HELP_VIDEO_PAGES: HelpVideoPage[] = (() => {
  const map = new Map<string, HelpVideoPage>();
  HELP_VIDEO_CONTEXTS.forEach((c) => {
    const route = c.route || '/';
    const existing = map.get(route);
    if (existing) {
      existing.spots.push(c);
    } else {
      map.set(route, { route, title: c.label, group: c.group, spots: [c] });
    }
  });
  return Array.from(map.values());
})();
