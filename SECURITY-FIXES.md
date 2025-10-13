# رفع مشکلات امنیتی - محافظت از اطلاعات تماس پیمانکاران

## 📋 خلاصه تغییرات

### ✅ مشکلات رفع شده

1. **حذف دسترسی عمومی به اطلاعات تماس پیمانکاران**
   - Policy `"Authenticated users can view non-sensitive contractor data"` حذف شد
   - اطلاعات حساس (email, phone_number, contact_person) دیگر برای همه در معرض دید نیست

2. **ایجاد تابع امن برای دسترسی عمومی**
   - تابع `get_public_contractors()` ایجاد شد
   - فقط اطلاعات غیرحساس را برمی‌گرداند:
     - نام شرکت
     - توضیحات
     - سال‌های تجربه
     - موقعیت جغرافیایی کلی (بدون جزئیات)
     - خدمات ارائه شده

3. **تابع امن برای دسترسی به اطلاعات تماس**
   - تابع `get_contractor_contact_info(contractor_id)` از قبل وجود داشت
   - فقط برای این افراد قابل دسترسی است:
     - ✅ ادمین‌ها
     - ✅ مدیران کل
     - ✅ خود پیمانکار
   - تمام دسترسی‌ها در `audit_log` ثبت می‌شوند

4. **حذف VIEW غیرایمن**
   - `public_contractors_directory` VIEW حذف شد
   - جایگزین: استفاده از تابع `get_public_contractors()`

## 🔐 چگونگی استفاده

### 1. نمایش لیست عمومی پیمانکاران (بدون اطلاعات تماس)

```typescript
import { getPublicContractors } from '@/lib/contractors';

// در کامپوننت
const contractors = await getPublicContractors();

// contractors شامل:
// - company_name
// - description
// - experience_years
// - general_location (فقط شهر، بدون آدرس کامل)
// - services[]

// ✅ امن - اطلاعات تماس نمایش داده نمی‌شود
```

### 2. دسترسی به اطلاعات تماس (فقط برای افراد مجاز)

```typescript
import { getContractorContactInfo } from '@/lib/contractors';

// فقط برای ادمین، مدیر کل، یا خود پیمانکار
const contactInfo = await getContractorContactInfo(contractorId);

// contactInfo شامل:
// - email
// - phone_number
// - contact_person

// ⚠️ این دسترسی در audit_log ثبت می‌شود
```

### 3. دسترسی مستقیم به جدول (فقط برای خود پیمانکار)

```typescript
// فقط خود پیمانکار می‌تواند پروفایل خودش را ببیند
const { data } = await supabase
  .from('contractors')
  .select('*')
  .eq('user_id', user.id)
  .single();
```

## 🚨 RLS Policies جدید

### جدول `contractors`

| Policy | دسترسی | شرایط |
|--------|--------|-------|
| `Contractors can view their own profile` | SELECT | `auth.uid() = user_id` |
| `Contractors can update their own profile` | UPDATE | `auth.uid() = user_id` |
| `Admins can view all contractors` | SELECT | `has_role(auth.uid(), 'admin')` |
| `Admins can update all contractors` | UPDATE | `has_role(auth.uid(), 'admin')` |
| `Block anonymous access to contractors` | SELECT (anon) | `false` |

### توابع امنیتی

```sql
-- تابع عمومی (بدون اطلاعات حساس)
get_public_contractors()
  ├── SECURITY DEFINER
  ├── بدون نیاز به احراز هویت خاص
  └── بازگشت: فقط اطلاعات غیرحساس

-- تابع محدود (اطلاعات تماس)
get_contractor_contact_info(contractor_id)
  ├── SECURITY DEFINER
  ├── بررسی دسترسی: admin OR general_manager OR owner
  ├── ثبت در audit_log
  └── بازگشت: email, phone_number, contact_person
```

## 📊 تأثیر بر کد موجود

### تغییرات لازم

1. **`useAutoAssignProjects.ts`** ✅ اصلاح شد
   - حذف `.select('contractor_id, contractors!inner(*)')`
   - استفاده از `.select('contractor_id')`
   - کاهش افشای اطلاعات

### کدهای نیاز به بررسی

- ❌ هیچ کد دیگری مستقیماً به جدول `contractors` دسترسی ندارد
- ✅ `ContractorDashboard` از RLS policies استفاده می‌کند

## 🎯 Best Practices

### ✅ کار درست

```typescript
// استفاده از تابع امن
const contractors = await getPublicContractors();

// یا استفاده از RLS برای خود پیمانکار
const { data } = await supabase
  .from('contractors')
  .select('*')
  .eq('user_id', auth.uid());
```

### ❌ کار اشتباه

```typescript
// ❌ دسترسی مستقیم به تمام فیلدها
const { data } = await supabase
  .from('contractors')
  .select('*');  // RLS این را مسدود می‌کند

// ❌ join با contractors بدون فیلتر
const { data } = await supabase
  .from('some_table')
  .select('*, contractors(*)'); // اطلاعات حساس افشا می‌شود
```

## 🔍 Audit Log

تمام دسترسی‌ها به اطلاعات تماس پیمانکاران ثبت می‌شوند:

```sql
SELECT 
  actor_user_id,
  action,
  entity_id,
  meta,
  created_at
FROM audit_log
WHERE action = 'view_contractor_contact'
ORDER BY created_at DESC;
```

## 📝 یادداشت‌های امنیتی

1. **Field-Level Security**: PostgreSQL از RLS سطح field پشتیبانی نمی‌کند، بنابراین از توابع `SECURITY DEFINER` استفاده کردیم
2. **Rate Limiting**: تابع `check_directory_rate_limit()` جلوی scraping را می‌گیرد
3. **Audit Trail**: تمام دسترسی‌های حساس logged می‌شوند
4. **Principle of Least Privilege**: هر role فقط به اطلاعاتی که نیاز دارد دسترسی دارد

## ✨ مزایای این تغییرات

- 🔒 **امنیت**: اطلاعات تماس از scraping محافظت می‌شوند
- 📊 **Audit**: تمام دسترسی‌ها قابل پیگیری هستند
- 🚀 **Performance**: کاهش data transfer با حذف فیلدهای غیرضروری
- 🎯 **Clean Code**: API واضح‌تر و قابل استفاده‌تر

## 🧪 تست

برای تست صحت تغییرات:

```typescript
// تست 1: دسترسی عمومی (باید موفق باشد)
const public = await getPublicContractors();
console.log(public[0].email); // undefined ✅

// تست 2: دسترسی به اطلاعات تماس (فقط برای افراد مجاز)
const contact = await getContractorContactInfo(contractorId);
// اگر مجاز نباشید: Error ✅
// اگر مجاز باشید: { email, phone_number, contact_person } ✅
```
