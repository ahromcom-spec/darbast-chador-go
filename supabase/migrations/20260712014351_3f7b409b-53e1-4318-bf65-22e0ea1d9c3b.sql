UPDATE public.module_hierarchy_states
SET hierarchy = hierarchy || jsonb_build_array(jsonb_build_object(
  'id', 'service_geo_availability',
  'key', 'service_geo_availability',
  'type', 'module',
  'name', 'ماژول مدیریت خدمات طبق شهرها',
  'description', 'فعال/غیرفعال کردن هر خدمت در استان‌ها و شهرهای مشخص و جلوگیری از سفارش‌گیری خارج از محدوده',
  'href', '/ceo/service-geo-availability',
  'color', 'text-emerald-600',
  'bgColor', 'bg-emerald-50'
))
WHERE type = 'available'
  AND NOT (hierarchy::text LIKE '%"key": "service_geo_availability"%' OR hierarchy::text LIKE '%"key":"service_geo_availability"%');