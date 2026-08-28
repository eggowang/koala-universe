create or replace function public.delete_template_task(
  p_template_task_id uuid,
  p_delete_upcoming boolean default true
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_deleted_templates integer := 0;
  v_deleted_upcoming integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select family_id into v_family_id
  from public.template_tasks
  where id = p_template_task_id;

  if not found or not public.is_parent(v_family_id) then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if p_delete_upcoming then
    delete from public.missions
    where family_id = v_family_id
      and template_task_id = p_template_task_id
      and scheduled_date >= public.app_current_date()
      and status in ('todo', 'rejected');
    get diagnostics v_deleted_upcoming = row_count;
  end if;

  delete from public.template_tasks
  where id = p_template_task_id
    and family_id = v_family_id;
  get diagnostics v_deleted_templates = row_count;

  if v_deleted_templates <> 1 then raise exception 'TASK_DELETE_NOT_APPLIED'; end if;

  return jsonb_build_object(
    'deleted_templates', v_deleted_templates,
    'deleted_upcoming_missions', v_deleted_upcoming
  );
end;
$$;

revoke all on function public.delete_template_task(uuid, boolean) from public;
grant execute on function public.delete_template_task(uuid, boolean) to authenticated;
