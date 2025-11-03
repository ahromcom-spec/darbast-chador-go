-- Update RLS policies for executive managers to see orders awaiting their approval
-- including both regular scaffolding and scaffolding with materials

drop policy if exists "Exec can view pending awaiting their approval" on public.projects_v3;

create policy "Exec can view pending awaiting their approval"
on public.projects_v3
for select
to authenticated
using (
  has_role(auth.uid(), 'scaffold_executive_manager')
  and exists (
    select 1 from public.order_approvals oa
    where oa.order_id = id
      and (
        oa.approver_role = 'scaffold_executive_manager'
        or oa.approver_role = 'executive_manager_scaffold_execution_with_materials'
      )
      and oa.approved_at is null
  )
);