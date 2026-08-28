create or replace function public.app_current_date()
returns date
language sql stable
set search_path = public
as $$
  select (now() at time zone 'Asia/Shanghai')::date;
$$;

drop policy if exists "missions parents delete future" on public.missions;
create policy "missions parents delete future" on public.missions for delete to authenticated
using (
  public.is_parent(family_id)
  and scheduled_date >= public.app_current_date()
  and status in ('todo', 'rejected')
);

create or replace function public.current_task_streak(p_child_id uuid)
returns integer
language plpgsql stable
security definer set search_path = public
as $$
declare
  v_today date := public.app_current_date();
  v_through_date date := v_today;
  v_has_today boolean := false;
  v_today_complete boolean := false;
begin
  if not exists (
    select 1 from public.children c
    where c.id = p_child_id and public.is_family_member(c.family_id)
  ) then return 0; end if;

  select count(*) > 0, coalesce(bool_and(status = 'approved'), false)
    into v_has_today, v_today_complete
    from public.missions
    where child_id = p_child_id and scheduled_date = v_today;

  if v_has_today and not v_today_complete then v_through_date := v_today - 1; end if;
  return public.task_streak_at(p_child_id, v_through_date);
end;
$$;

create or replace function public.publish_template_task(
  p_template_task_id uuid,
  p_scheduled_date date default public.app_current_date(),
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
  if p_scheduled_date < public.app_current_date() then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
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

create or replace function public.publish_template_selection(
  p_template_id uuid,
  p_task_ids uuid[],
  p_start_date date,
  p_days integer,
  p_collision text default 'append'
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_child_id uuid;
  v_day date;
  v_inserted integer := 0;
  v_count integer;
  v_requested_count integer;
  v_selected_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_start_date < public.app_current_date() then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  if p_days < 1 or p_days > 30 then raise exception 'DAYS_OUT_OF_RANGE'; end if;
  if p_task_ids is null or cardinality(p_task_ids) = 0 then raise exception 'NO_TASKS_SELECTED'; end if;

  select family_id into v_family_id
  from public.task_templates
  where id = p_template_id and active = true;
  if not found or not public.is_parent(v_family_id) then raise exception 'TEMPLATE_NOT_FOUND'; end if;

  select count(distinct task_id) into v_requested_count from unnest(p_task_ids) as selected(task_id);
  select count(*) into v_selected_count
  from public.template_tasks tt
  join public.template_sections ts on ts.id = tt.section_id
  where tt.id = any(p_task_ids)
    and tt.active = true
    and tt.family_id = v_family_id
    and ts.template_id = p_template_id;
  if v_selected_count <> v_requested_count then raise exception 'INVALID_TASK_SELECTION'; end if;

  select id into v_child_id from public.children where family_id = v_family_id limit 1;
  if v_child_id is null then raise exception 'CHILD_NOT_FOUND'; end if;

  for i in 0..p_days - 1 loop
    v_day := p_start_date + i;
    if p_collision = 'replace' then
      delete from public.missions
      where family_id = v_family_id
        and scheduled_date = v_day
        and status in ('todo', 'rejected');
    elsif p_collision <> 'append' then
      raise exception 'INVALID_COLLISION_MODE';
    end if;

    insert into public.missions(
      family_id, child_id, template_task_id, scheduled_date, section_name, reminder_time,
      title, stars, requires_photo, icon_type, sort_order, created_by
    )
    select v_family_id, v_child_id, tt.id, v_day, ts.name, ts.reminder_time,
      tt.title, tt.stars, tt.requires_photo, tt.icon_type,
      (ts.sort_order * 1000 + tt.sort_order), auth.uid()
    from public.template_tasks tt
    join public.template_sections ts on ts.id = tt.section_id
    where ts.template_id = p_template_id
      and tt.id = any(p_task_ids)
      and tt.active = true
      and not exists (
        select 1 from public.missions existing
        where existing.family_id = v_family_id
          and existing.template_task_id = tt.id
          and existing.scheduled_date = v_day
      )
    order by ts.sort_order, tt.sort_order;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.publish_template(
  p_template_id uuid,
  p_start_date date,
  p_days integer,
  p_collision text default 'append'
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_child_id uuid;
  v_day date;
  v_inserted integer := 0;
  v_count integer;
begin
  if p_days < 1 or p_days > 30 then raise exception 'DAYS_OUT_OF_RANGE'; end if;
  if p_start_date < public.app_current_date() then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
  select family_id into v_family_id from public.task_templates where id = p_template_id and active = true;
  if not found or not public.is_parent(v_family_id) then raise exception 'TEMPLATE_NOT_FOUND'; end if;
  select id into v_child_id from public.children where family_id = v_family_id;
  for i in 0..p_days - 1 loop
    v_day := p_start_date + i;
    if p_collision = 'replace' then
      delete from public.missions where family_id = v_family_id and scheduled_date = v_day and status in ('todo', 'rejected');
    elsif p_collision <> 'append' then
      raise exception 'INVALID_COLLISION_MODE';
    end if;
    insert into public.missions(
      family_id, child_id, template_task_id, scheduled_date, section_name, reminder_time,
      title, stars, requires_photo, icon_type, sort_order, created_by
    )
    select v_family_id, v_child_id, tt.id, v_day, ts.name, ts.reminder_time,
      tt.title, tt.stars, tt.requires_photo, tt.icon_type, (ts.sort_order * 1000 + tt.sort_order), auth.uid()
    from public.template_tasks tt
    join public.template_sections ts on ts.id = tt.section_id
    where ts.template_id = p_template_id
      and tt.active = true
      and not exists (
        select 1 from public.missions existing
        where existing.family_id = v_family_id
          and existing.template_task_id = tt.id
          and existing.scheduled_date = v_day
      )
    order by ts.sort_order, tt.sort_order;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;
  return v_inserted;
end;
$$;

revoke all on function public.publish_template_task(uuid, date, integer) from public;
grant execute on function public.publish_template_task(uuid, date, integer) to authenticated;
revoke all on function public.publish_template_selection(uuid, uuid[], date, integer, text) from public;
grant execute on function public.publish_template_selection(uuid, uuid[], date, integer, text) to authenticated;
revoke all on function public.publish_template(uuid, date, integer, text) from public;
grant execute on function public.publish_template(uuid, date, integer, text) to authenticated;
