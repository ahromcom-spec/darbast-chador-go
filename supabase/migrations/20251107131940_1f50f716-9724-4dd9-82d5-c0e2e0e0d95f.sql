-- إضافة نوع جديد لمراحل التنفيذ
CREATE TYPE execution_stage AS ENUM (
  'awaiting_payment',
  'order_executed',
  'awaiting_collection',
  'in_collection'
);

-- إضافة حقل مرحلة التنفيذ إلى جدول المشاريع
ALTER TABLE projects_v3
ADD COLUMN execution_stage execution_stage DEFAULT NULL;

-- إضافة تعليق للتوضيح
COMMENT ON COLUMN projects_v3.execution_stage IS 'مرحلة التنفيذ الفرعية للطلب (في انتظار الدفع، تم التنفيذ، في انتظار التجميع، جاري التجميع)';

-- إضافة حقل لتاريخ تحديث مرحلة التنفيذ
ALTER TABLE projects_v3
ADD COLUMN execution_stage_updated_at timestamp with time zone DEFAULT NULL;

-- إضافة تعليق
COMMENT ON COLUMN projects_v3.execution_stage_updated_at IS 'تاريخ آخر تحديث لمرحلة التنفيذ';