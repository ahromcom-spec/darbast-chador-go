-- Allow executive and sales managers to view pending orders that await their approval
drop policy if exists "Exec can view pending awaiting their approval" on public.projects_v3;
drop policy if exists "Sales can view pending awaiting their approval" on public.projects_v3;

create policy "Exec can view pending awaiting their approval"
on public.projects_v3
for select
to authenticated
using (
  has_role(auth.uid(), 'scaffold_executive_manager')
  and exists (
    select 1 from public.order_approvals oa
    where oa.order_id = id
      and oa.approver_role = 'scaffold_executive_manager'
      and oa.approved_at is null
  )
);

create policy "Sales can view pending awaiting their approval"
on public.projects_v3
for select
to authenticated
using (
  has_role(auth.uid(), 'sales_manager')
  and exists (
    select 1 from public.order_approvals oa
    where oa.order_id = id
      and oa.approver_role = 'sales_manager'
      and oa.approved_at is null
  )
);
