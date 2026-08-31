create or replace function public.publish_weekly_plan(
  p_template_id uuid,
  p_plan jsonb,
  p_collision text default 'append'
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_child_id uuid;
  v_entry jsonb;
  v_day date;
  v_task_ids uuid[];
  v_selected_count integer;
  v_inserted integer := 0;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'array' then raise exception 'WEEKLY_PLAN_INVALID'; end if;
  if jsonb_array_length(p_plan) = 0 then raise exception 'WEEKLY_PLAN_INVALID'; end if;
  if jsonb_array_length(p_plan) > 56 then raise exception 'WEEKLY_PLAN_OUT_OF_RANGE'; end if;
  if p_collision not in ('append', 'replace') then raise exception 'INVALID_COLLISION_MODE'; end if;

  select family_id into v_family_id
  from public.task_templates
  where id = p_template_id and active = true;
  if not found or not public.is_parent(v_family_id) then raise exception 'TEMPLATE_NOT_FOUND'; end if;

  select id into v_child_id from public.children where family_id = v_family_id limit 1;
  if v_child_id is null then raise exception 'CHILD_NOT_FOUND'; end if;

  for v_entry in select value from jsonb_array_elements(p_plan) loop
    if jsonb_typeof(v_entry) <> 'object' then raise exception 'WEEKLY_PLAN_INVALID'; end if;
    if coalesce(v_entry ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'WEEKLY_PLAN_INVALID'; end if;
    if jsonb_typeof(v_entry -> 'taskIds') <> 'array' then raise exception 'WEEKLY_PLAN_INVALID'; end if;
    if jsonb_array_length(v_entry -> 'taskIds') = 0 then raise exception 'WEEKLY_PLAN_INVALID'; end if;
    begin
      v_day := (v_entry ->> 'date')::date;
    exception when others then
      raise exception 'WEEKLY_PLAN_INVALID';
    end;
    if v_day < public.app_current_date() or v_day > public.app_current_date() + 55 then
      raise exception 'WEEKLY_PLAN_OUT_OF_RANGE';
    end if;
    begin
      select array_agg(distinct item.value::uuid) into v_task_ids
      from jsonb_array_elements_text(v_entry -> 'taskIds') as item(value);
    exception when invalid_text_representation then
      raise exception 'WEEKLY_PLAN_INVALID';
    end;
    if v_task_ids is null or cardinality(v_task_ids) = 0 then raise exception 'WEEKLY_PLAN_INVALID'; end if;

    select count(*) into v_selected_count
    from public.template_tasks tt
    join public.template_sections ts on ts.id = tt.section_id
    where tt.id = any(v_task_ids)
      and tt.active = true
      and tt.family_id = v_family_id
      and ts.template_id = p_template_id;
    if v_selected_count <> cardinality(v_task_ids) then raise exception 'WEEKLY_PLAN_INVALID'; end if;

    if p_collision = 'replace' then
      delete from public.missions
      where family_id = v_family_id
        and scheduled_date = v_day
        and template_task_id = any(v_task_ids)
        and status in ('todo', 'rejected');
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
    where tt.id = any(v_task_ids)
      and tt.active = true
      and tt.family_id = v_family_id
      and ts.template_id = p_template_id
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

revoke all on function public.publish_weekly_plan(uuid, jsonb, text) from public;
grant execute on function public.publish_weekly_plan(uuid, jsonb, text) to authenticated;
