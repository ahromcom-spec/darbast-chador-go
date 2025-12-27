-- Add missing order_approvals for executive_manager_scaffold_execution_with_materials
INSERT INTO public.order_approvals (order_id, approver_role, subcategory_id)
SELECT 
  p.id,
  'executive_manager_scaffold_execution_with_materials',
  p.subcategory_id
FROM public.projects_v3 p
WHERE p.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_approvals oa 
    WHERE oa.order_id = p.id 
      AND oa.approver_role = 'executive_manager_scaffold_execution_with_materials'
  );

-- Add missing order_approvals for scaffold_executive_manager
INSERT INTO public.order_approvals (order_id, approver_role, subcategory_id)
SELECT 
  p.id,
  'scaffold_executive_manager',
  p.subcategory_id
FROM public.projects_v3 p
WHERE p.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_approvals oa 
    WHERE oa.order_id = p.id 
      AND oa.approver_role = 'scaffold_executive_manager'
  );

-- Add missing order_approvals for sales_manager
INSERT INTO public.order_approvals (order_id, approver_role, subcategory_id)
SELECT 
  p.id,
  'sales_manager',
  p.subcategory_id
FROM public.projects_v3 p
WHERE p.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_approvals oa 
    WHERE oa.order_id = p.id 
      AND oa.approver_role = 'sales_manager'
  );

-- Add missing order_approvals for ceo
INSERT INTO public.order_approvals (order_id, approver_role, subcategory_id)
SELECT 
  p.id,
  'ceo',
  p.subcategory_id
FROM public.projects_v3 p
WHERE p.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_approvals oa 
    WHERE oa.order_id = p.id 
      AND oa.approver_role = 'ceo'
  );