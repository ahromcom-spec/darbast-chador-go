export interface PageGuide {
  path: string;
  customer?: string;
  contractor?: string;
  admin?: string;
  ceo?: string;
  general_manager?: string;
  sales_manager?: string;
  finance_manager?: string;
  executive_manager?: string;
}

export const pageGuides: PageGuide[] = [
  {
    path: '/',
    customer: 'خانه اصلی: برای شروع، پروژه جدید ایجاد کنید یا سفارشات قبلی را مشاهده کنید.',
    contractor: 'خانه: پروژه‌های محول شده به شما را ببینید و روی آن‌ها کار کنید.',
    admin: 'داشبورد مدیریت: کاربران و سفارشات سیستم را مدیریت کنید.',
    ceo: 'داشبورد مدیرعامل: گزارش‌های کلی و تصمیمات استراتژیک را بررسی کنید.',
  },
  {
    path: '/user/profile',
    customer: 'پروفایل: اطلاعات شخصی خود را ویرایش کنید، سفارشات را مشاهده کنید و تیکت پشتیبانی ثبت کنید.',
    contractor: 'پروفایل: مشخصات پیمانکاری، امتیازات و پروژه‌های خود را مدیریت کنید.',
    admin: 'پروفایل: تنظیمات حساب مدیریتی و دسترسی‌ها را کنترل کنید.',
    ceo: 'پروفایل: اطلاعات کاربری و گزارش‌های خلاصه فعالیت‌های مدیریتی.',
  },
  {
    path: '/user/create-project',
    customer: 'ایجاد پروژه: آدرس پروژه را وارد کنید و خدمات مورد نیاز را انتخاب کنید.',
  },
  {
    path: '/user/projects',
    customer: 'پروژه‌های من: لیست پروژه‌ها و وضعیت هر پروژه را ببینید.',
  },
  {
    path: '/profile',
    customer: 'پروفایل کاربری: مشاهده سفارشات، صورتحساب و اطلاعات حساب کاربری.',
  },
  {
    path: '/contractor/dashboard',
    contractor: 'داشبورد پیمانکار: پروژه‌های محول شده و وضعیت کاری خود را مشاهده کنید.',
  },
  {
    path: '/admin/dashboard',
    admin: 'داشبورد مدیر: کاربران، سفارشات و درخواست‌های پیمانکاران را بررسی کنید.',
  },
  {
    path: '/admin/orders',
    admin: 'سفارشات: سفارشات را تایید، رد یا پیگیری کنید.',
  },
  {
    path: '/admin/users',
    admin: 'کاربران: لیست کاربران، نقش‌ها و دسترسی‌ها را مدیریت کنید.',
  },
  {
    path: '/admin/contractors',
    admin: 'پیمانکاران: وضعیت تایید پیمانکاران و اختصاص پروژه‌ها.',
  },
  {
    path: '/ceo/dashboard',
    ceo: 'داشبورد مدیرعامل: نمای کلی سفارشات، آمار روزانه و نمودارهای تحلیلی را ببینید.',
  },
  {
    path: '/ceo/orders',
    ceo: 'سفارشات CEO: سفارشات نیازمند تایید نهایی شما و روند تاییدات مدیران را بررسی کنید.',
  },
  {
    path: '/ceo/staff-verifications',
    ceo: 'تایید پرسنل: درخواست‌های پرسنلی را بررسی و تایید کنید.',
  },
  {
    path: '/ceo/contractor-verifications',
    ceo: 'تایید پیمانکاران: درخواست‌های پیمانکاری را تایید یا رد کنید.',
  },
  {
    path: '/ceo/phone-whitelist',
    ceo: 'لیست سفید: شماره‌های مجاز ثبت‌نام را مدیریت کنید.',
  },
  {
    path: '/general-manager/dashboard',
    general_manager: 'داشبورد مدیرکل: سفارشات و وظایف مدیریتی کلی را پیگیری کنید.',
  },
  {
    path: '/sales/orders',
    sales_manager: 'سفارشات فروش: سفارشات جدید را بررسی و تایید اولیه کنید.',
  },
  {
    path: '/finance/orders',
    finance_manager: 'سفارشات مالی: جنبه‌های مالی سفارشات و تایید بودجه را بررسی کنید.',
  },
  {
    path: '/executive/dashboard',
    executive_manager: 'داشبورد اجرایی: وضعیت اجرای پروژه‌ها و هماهنگی عملیاتی.',
  },
  {
    path: '/executive/orders',
    executive_manager: 'سفارشات اجرایی: سفارشات در حال اجرا و اختصاص پیمانکار.',
  },
  {
    path: '/tickets',
    customer: 'تیکت‌ها: پیام‌های پشتیبانی خود را پیگیری کنید.',
    contractor: 'تیکت‌ها: مشکلات فنی و پشتیبانی را گزارش دهید.',
    admin: 'تیکت‌ها: درخواست‌های پشتیبانی را پاسخ دهید.',
  },
];

export const getGuideForPage = (
  path: string, 
  roles: { 
    isCustomer?: boolean;
    isContractor?: boolean;
    isAdmin?: boolean;
    isCEO?: boolean;
    isGeneralManager?: boolean;
    isSalesManager?: boolean;
    isFinanceManager?: boolean;
    isExecutiveManager?: boolean;
  }
): string | null => {
  const guide = pageGuides.find(g => g.path === path);
  if (!guide) return null;

  if (roles.isCEO && guide.ceo) return guide.ceo;
  if (roles.isGeneralManager && guide.general_manager) return guide.general_manager;
  if (roles.isSalesManager && guide.sales_manager) return guide.sales_manager;
  if (roles.isFinanceManager && guide.finance_manager) return guide.finance_manager;
  if (roles.isExecutiveManager && guide.executive_manager) return guide.executive_manager;
  if (roles.isAdmin && guide.admin) return guide.admin;
  if (roles.isContractor && guide.contractor) return guide.contractor;
  if (roles.isCustomer && guide.customer) return guide.customer;

  return null;
};
