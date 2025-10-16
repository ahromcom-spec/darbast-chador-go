// داده‌های لیست‌های کشویی برای پرسنل و پیمانکاران
// استخراج شده از فایل Excel: list_peimani_persenel

export interface District {
  name: string;
  cities: string[];
}

export interface Province {
  name: string;
  code: string;
  districts: District[];
}

// محدوده - ساختار سه سطحی: استان > شهرستان > شهر/منطقه
export const regionsData: Province[] = [
  {
    name: 'استان قم',
    code: 'qom',
    districts: [
      {
        name: 'شهر قم',
        cities: ['جعفریه', 'سلفچگان', 'کهک']
      }
    ]
  },
  {
    name: 'استان تهران',
    code: 'tehran',
    districts: [
      {
        name: 'تهران',
        cities: ['تهران']
      },
      {
        name: 'ری',
        cities: ['ری']
      },
      {
        name: 'شمیرانات',
        cities: ['شمیرانات']
      },
      {
        name: 'اسلام‌شهر',
        cities: ['اسلام‌شهر']
      },
      {
        name: 'بهارستان',
        cities: ['بهارستان']
      },
      {
        name: 'قدس',
        cities: ['قدس']
      },
      {
        name: 'ملارد',
        cities: ['ملارد']
      },
      {
        name: 'رباط‌کریم',
        cities: ['رباط‌کریم']
      },
      {
        name: 'شهریار',
        cities: ['شهریار']
      },
      {
        name: 'پردیس',
        cities: ['پردیس']
      },
      {
        name: 'دماوند',
        cities: ['دماوند']
      },
      {
        name: 'فیروزکوه',
        cities: ['فیروزکوه']
      },
      {
        name: 'ورامین',
        cities: ['ورامین']
      },
      {
        name: 'پیشوا',
        cities: ['پیشوا']
      },
      {
        name: 'قرچک',
        cities: ['قرچک']
      },
      {
        name: 'پاکدشت',
        cities: ['پاکدشت']
      }
    ]
  },
  {
    name: 'استان البرز',
    code: 'alborz',
    districts: [
      {
        name: 'کرج',
        cities: ['کرج']
      },
      {
        name: 'فردیس',
        cities: ['فردیس']
      },
      {
        name: 'ساوجبلاغ',
        cities: ['ساوجبلاغ']
      },
      {
        name: 'نظرآباد',
        cities: ['نظرآباد']
      },
      {
        name: 'اشتهارد',
        cities: ['اشتهارد']
      },
      {
        name: 'چهارباغ',
        cities: ['چهارباغ']
      },
      {
        name: 'طالقان',
        cities: ['طالقان']
      }
    ]
  }
];

// نوع سمت پرسنل
export const staffPositions = [
  'مدیریت',
  'فروش',
  'اجرایی',
  'پشتیبانی',
  'حراست',
  'انبارداری',
  'مالی',
  'منابع انسانی',
  'ای‌تی',
  'سرپرست'
] as const;

export type StaffPosition = typeof staffPositions[number];

// نوع صنف خدمات (برای پیمانکاران)
export const serviceCategories = [
  'داربست فلزی',
  'چادر برزنتی',
  'فنس کشی',
  'ارماتوربندی',
  'ابزارآلات',
  'قالی شویی'
] as const;

export type ServiceCategory = typeof serviceCategories[number];

// نوع فعالیت خدمات (برای پیمانکاران)
export const activityTypes = [
  'اجراء با نیروهای اهرم و با اجناس، ابزارالات و ماشین آلات اهرم',
  'اجراء با نیروهای اهرم بدون اجناس، ابزارالات و ماشین آلات اهرم',
  'اجراء با نیروهای پیمانکاران و با اجناس، ابزارالات و ماشین آلات اهرم',
  'اجراء با نیروهای پیمانکاران و با اجناس، ابزارالات و ماشین آلات کاربر مشتری یا کارفرما',
  'خرید کالا و اجناس برای اهرم',
  'فروش از کالاها و اجناس اهرم',
  'کرایه دادن اهرم از اجناس یا موارد خدمات مشخص',
  'کرایه گرفتن اهرم از اجناس یا موارد خدمات مشخص',
  'تولید کالای خدمات مشخص',
  'تعمیر',
  'پورسانت واسطه گری اهرم برای پیمانکاران',
  'پورسانت واسطه گری پیمانکاران برای اهرم',
  'تأمین نیرو از طرف اهرم برای پیمانکاران',
  'تأمین نیرو از طرف پیمانکاران برای اهرم'
] as const;

export type ActivityType = typeof activityTypes[number];

// Helper functions
export const getProvinceName = (code: string): string => {
  const province = regionsData.find(p => p.code === code);
  return province?.name || code;
};

export const getDistrictsByProvince = (provinceCode: string): District[] => {
  const province = regionsData.find(p => p.code === provinceCode);
  return province?.districts || [];
};

export const getCitiesByDistrict = (provinceCode: string, districtName: string): string[] => {
  const province = regionsData.find(p => p.code === provinceCode);
  const district = province?.districts.find(d => d.name === districtName);
  return district?.cities || [];
};
