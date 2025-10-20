import { z } from 'zod';
import { sanitizeHtml } from './security';

// Phone validation schemas
export const phoneSchema = z.object({
  phone: z.string()
    .trim()
    .length(11, { message: 'شماره موبایل باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'فرمت صحیح: 09123456789' })
});

// OTP validation schema
export const otpSchema = z.object({
  code: z.string()
    .trim()
    .length(5, { message: 'کد تایید باید 5 رقم باشد' })
    .regex(/^\d{5}$/, { message: 'کد تایید فقط باید شامل اعداد باشد' })
});

// User profile validation
export const profileSchema = z.object({
  full_name: z.string()
    .trim()
    .min(3, { message: 'نام باید حداقل 3 کاراکتر باشد' })
    .max(100, { message: 'نام نباید بیش از 100 کاراکتر باشد' })
    .regex(/^[\u0600-\u06FF\s]+$/, { message: 'لطفاً فقط از حروف فارسی استفاده کنید' }),
  phone_number: z.string()
    .trim()
    .length(11, { message: 'شماره موبایل باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'فرمت صحیح: 09123456789' })
    .optional()
});

// Comprehensive order/project validation schema
export const orderDimensionSchema = z.object({
  length: z.number()
    .positive({ message: 'طول باید بیشتر از صفر باشد' })
    .max(1000, { message: 'طول نباید بیش از 1000 متر باشد' }),
  width: z.number()
    .positive({ message: 'عرض باید بیشتر از صفر باشد' })
    .max(1000, { message: 'عرض نباید بیش از 1000 متر باشد' }),
  height: z.number()
    .positive({ message: 'ارتفاع باید بیشتر از صفر باشد' })
    .max(500, { message: 'ارتفاع نباید بیش از 500 متر باشد' }),
  area: z.number().positive().optional()
});

export const orderFormSchema = z.object({
  address: z.string()
    .trim()
    .min(10, { message: 'آدرس باید حداقل 10 کاراکتر باشد' })
    .max(500, { message: 'آدرس نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml),
  detailed_address: z.string()
    .trim()
    .max(500, { message: 'آدرس تکمیلی نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional(),
  dimensions: z.array(orderDimensionSchema)
    .min(1, { message: 'حداقل یک ابعاد باید وارد شود' })
    .max(50, { message: 'حداکثر 50 ابعاد مجاز است' }),
  notes: z.string()
    .max(2000, { message: 'یادداشت‌ها نباید بیش از 2000 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional()
});

// Service request validation
export const serviceRequestSchema = z.object({
  service_type: z.enum(['scaffolding', 'tarpaulin'], {
    errorMap: () => ({ message: 'نوع خدمات نامعتبر است' })
  }),
  sub_type: z.string().optional(),
  length: z.number()
    .positive({ message: 'طول باید عدد مثبت باشد' })
    .max(1000, { message: 'طول نباید بیش از 1000 متر باشد' }),
  width: z.number()
    .positive({ message: 'عرض باید عدد مثبت باشد' })
    .max(1000, { message: 'عرض نباید بیش از 1000 متر باشد' }),
  height: z.number()
    .positive({ message: 'ارتفاع باید عدد مثبت باشد' })
    .max(500, { message: 'ارتفاع نباید بیش از 500 متر باشد' }),
  location_address: z.string()
    .trim()
    .min(10, { message: 'آدرس باید حداقل 10 کاراکتر باشد' })
    .max(500, { message: 'آدرس نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional()
});

// Contractor registration validation
export const contractorSchema = z.object({
  company_name: z.string()
    .trim()
    .min(3, { message: 'نام شرکت باید حداقل 3 کاراکتر باشد' })
    .max(200, { message: 'نام شرکت نباید بیش از 200 کاراکتر باشد' })
    .transform(sanitizeHtml),
  contact_person: z.string()
    .trim()
    .min(3, { message: 'نام شخص تماس باید حداقل 3 کاراکتر باشد' })
    .max(100, { message: 'نام شخص تماس نباید بیش از 100 کاراکتر باشد' })
    .transform(sanitizeHtml),
  phone_number: z.string()
    .trim()
    .length(11, { message: 'شماره موبایل باید 11 رقم باشد' })
    .regex(/^09\d{9}$/, { message: 'فرمت صحیح: 09123456789' }),
  email: z.string()
    .trim()
    .email({ message: 'ایمیل نامعتبر است' })
    .max(255, { message: 'ایمیل نباید بیش از 255 کاراکتر باشد' }),
  address: z.string()
    .trim()
    .min(10, { message: 'آدرس باید حداقل 10 کاراکتر باشد' })
    .max(500, { message: 'آدرس نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional(),
  description: z.string()
    .trim()
    .max(1000, { message: 'توضیحات نباید بیش از 1000 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional(),
  experience_years: z.number()
    .int({ message: 'سابقه کار باید عدد صحیح باشد' })
    .min(0, { message: 'سابقه کار نمی‌تواند منفی باشد' })
    .max(100, { message: 'سابقه کار نباید بیش از 100 سال باشد' })
    .optional()
});

// Ticket validation
export const ticketSchema = z.object({
  subject: z.string()
    .trim()
    .min(5, { message: 'موضوع باید حداقل 5 کاراکتر باشد' })
    .max(200, { message: 'موضوع نباید بیش از 200 کاراکتر باشد' })
    .transform(sanitizeHtml),
  message: z.string()
    .trim()
    .min(10, { message: 'پیام باید حداقل 10 کاراکتر باشد' })
    .max(2000, { message: 'پیام نباید بیش از 2000 کاراکتر باشد' })
    .transform(sanitizeHtml),
  department: z.enum(['general', 'technical', 'financial', 'support'], {
    errorMap: () => ({ message: 'دپارتمان نامعتبر است' })
  })
});

// Assignment validation
export const assignmentSchema = z.object({
  title: z.string()
    .trim()
    .min(5, { message: 'عنوان باید حداقل 5 کاراکتر باشد' })
    .max(200, { message: 'عنوان نباید بیش از 200 کاراکتر باشد' })
    .transform(sanitizeHtml),
  description: z.string()
    .trim()
    .max(1000, { message: 'توضیحات نباید بیش از 1000 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional(),
  assignee_user_id: z.string().uuid({ message: 'شناسه کاربر نامعتبر است' }),
  project_id: z.string().uuid({ message: 'شناسه پروژه نامعتبر است' }),
  due_date: z.date().optional(),
  priority: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({ message: 'اولویت نامعتبر است' })
  }).optional()
});

// Location validation
export const locationSchema = z.object({
  title: z.string()
    .trim()
    .max(100, { message: 'عنوان نباید بیش از 100 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional(),
  province_id: z.string()
    .uuid({ message: 'استان الزامی است' }),
  district_id: z.string()
    .uuid({ message: 'شناسه شهرستان نامعتبر است' })
    .optional(),
  address_line: z.string()
    .trim()
    .min(5, { message: 'آدرس باید حداقل 5 کاراکتر باشد' })
    .max(500, { message: 'آدرس نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml),
  lat: z.number()
    .min(-90, { message: 'عرض جغرافیایی نامعتبر است' })
    .max(90, { message: 'عرض جغرافیایی نامعتبر است' }),
  lng: z.number()
    .min(-180, { message: 'طول جغرافیایی نامعتبر است' })
    .max(180, { message: 'طول جغرافیایی نامعتبر است' })
});

// Order edit validation (for projects_v3 table)
export const orderEditSchema = z.object({
  address: z.string()
    .trim()
    .min(10, { message: 'آدرس باید حداقل 10 کاراکتر باشد' })
    .max(500, { message: 'آدرس نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml),
  detailed_address: z.string()
    .trim()
    .max(500, { message: 'آدرس تکمیلی نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional(),
  notes: z.string()
    .max(5000, { message: 'یادداشت‌ها نباید بیش از 5000 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional(),
  province_id: z.string()
    .uuid({ message: 'شناسه استان نامعتبر است' }),
  district_id: z.string()
    .uuid({ message: 'شناسه شهرستان نامعتبر است' })
    .optional()
    .nullable(),
  subcategory_id: z.string()
    .uuid({ message: 'شناسه زیرمجموعه نامعتبر است' })
});

// Scaffolding-specific form validation
export const scaffoldingFormSchema = z.object({
  detailedAddress: z.string()
    .trim()
    .min(10, { message: 'آدرس باید حداقل 10 کاراکتر باشد' })
    .max(500, { message: 'آدرس نباید بیش از 500 کاراکتر باشد' })
    .transform(sanitizeHtml),
  dimensions: z.array(orderDimensionSchema)
    .min(1, { message: 'حداقل یک ابعاد باید وارد شود' })
    .max(50, { message: 'حداکثر 50 ابعاد مجاز است' }),
  notes: z.string()
    .max(2000, { message: 'یادداشت‌ها نباید بیش از 2000 کاراکتر باشد' })
    .transform(sanitizeHtml)
    .optional()
});
