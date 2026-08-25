create or replace function public.publish_template_task(
  p_template_task_id uuid,
  p_scheduled_date date default current_date,
  p_days integer default 1
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_task record;
  v_child_id uuid;
  v_day date;
  v_inserted integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_scheduled_date < current_date then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  if p_days < 1 or p_days > 30 then raise exception 'DAYS_OUT_OF_RANGE'; end if;

  select
    tt.id, tt.family_id, tt.title, tt.stars, tt.requires_photo, tt.icon_type,
    tt.sort_order as task_sort_order, ts.name as section_name,
    ts.reminder_time, ts.sort_order as section_sort_order
  into v_task
  from public.template_tasks tt
  join public.template_sections ts on ts.id = tt.section_id
  where tt.id = p_template_task_id and tt.active = true;

  if not found or not public.is_parent(v_task.family_id) then
    raise exception 'TEMPLATE_TASK_NOT_FOUND';
  end if;

  select id into v_child_id from public.children where family_id = v_task.family_id limit 1;
  if v_child_id is null then raise exception 'CHILD_NOT_FOUND'; end if;

  for i in 0..p_days - 1 loop
    v_day := p_scheduled_date + i;
    if not exists (
      select 1 from public.missions
      where family_id = v_task.family_id
        and template_task_id = v_task.id
        and scheduled_date = v_day
    ) then
      insert into public.missions(
        family_id, child_id, template_task_id, scheduled_date, section_name, reminder_time,
        title, stars, requires_photo, icon_type, sort_order, created_by
      ) values (
        v_task.family_id, v_child_id, v_task.id, v_day, v_task.section_name,
        v_task.reminder_time, v_task.title, v_task.stars, v_task.requires_photo,
        v_task.icon_type, (v_task.section_sort_order * 1000 + v_task.task_sort_order), auth.uid()
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.publish_template_task(uuid, date, integer) from public;
grant execute on function public.publish_template_task(uuid, date, integer) to authenticated;
