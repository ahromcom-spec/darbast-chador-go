create or replace function public.log_auth_event(_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pr record;
  ttl text;
  sid uuid;
  imp record;
begin
  if uid is null or _kind not in ('login','logout') then return; end if;

  -- session id of the current token (to detect tunnel/impersonation sessions)
  begin
    sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when others then
    sid := null;
  end;

  if sid is not null then
    select s.admin_user_id, p.full_name as admin_name
      into imp
      from public.impersonation_sessions s
      left join public.profiles p on p.user_id = s.admin_user_id
     where s.session_id = sid;
  end if;

  if imp.admin_user_id is not null then
    ttl := case when _kind = 'login' then 'ورود مدیر به حساب کاربر' else 'خروج مدیر از حساب کاربر' end;
  else
    ttl := case when _kind = 'login' then 'ورود کاربر به حساب' else 'خروج کاربر از حساب' end;
  end if;

  if exists (select 1 from public.site_notifications
              where actor_user_id = uid and title = ttl
                and created_at > now() - interval '30 seconds') then
    return;
  end if;

  select full_name, phone_number into pr from public.profiles where user_id = uid;

  if imp.admin_user_id is not null then
    insert into public.site_notifications
      (event_type, title, body, customer_name, customer_phone, actor_user_id, actor_name, actor_source, impersonator_user_id, impersonator_name, source_table)
    values (
      case when _kind='login' then 'impersonation_login' else 'impersonation_logout' end,
      ttl,
      coalesce(imp.admin_name,'مدیر') || ' از ماژول مدیریت ' || case when _kind='login' then 'وارد حساب ' else 'از حساب ' end || coalesce(pr.full_name,'کاربر') || case when _kind='login' then ' شد' else ' خارج شد' end,
      pr.full_name, pr.phone_number, uid, pr.full_name, 'impersonation', imp.admin_user_id, imp.admin_name, 'auth');
  else
    insert into public.site_notifications
      (event_type, title, body, customer_name, customer_phone, actor_user_id, source_table)
    values (
      case when _kind='login' then 'user_login' else 'user_logout' end,
      ttl,
      coalesce(pr.full_name,'کاربر') || ' ' || case when _kind='login' then 'وارد حساب خود شد' else 'از حساب خود خارج شد' end,
      pr.full_name, pr.phone_number, uid, 'auth');
  end if;
end;
$$;