alter table public.families
  add column if not exists streak_3_bonus integer not null default 3 check (streak_3_bonus between 0 and 1000),
  add column if not exists streak_7_bonus integer not null default 7 check (streak_7_bonus between 0 and 1000),
  add column if not exists streak_30_bonus integer not null default 30 check (streak_30_bonus between 0 and 1000);

create table if not exists public.streak_awards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  milestone integer not null check (milestone in (3, 7, 30)),
  bonus_stars integer not null check (bonus_stars > 0),
  streak_end_date date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(child_id, milestone, streak_end_date)
);

alter table public.streak_awards enable row level security;
drop policy if exists "streak awards family read" on public.streak_awards;
create policy "streak awards family read" on public.streak_awards
  for select to authenticated using (public.is_family_member(family_id));

alter table public.star_ledger
  add column if not exists streak_award_id uuid unique
  references public.streak_awards(id) on delete restrict;

create or replace function public.task_streak_at(p_child_id uuid, p_through_date date)
returns integer
language sql stable
security definer set search_path = public
as $$
  with task_days as (
    select scheduled_date, bool_and(status = 'approved') as complete
    from public.missions
    where child_id = p_child_id and scheduled_date <= p_through_date
    group by scheduled_date
  ), ordered_days as (
    select scheduled_date, complete, row_number() over (order by scheduled_date desc) as row_number
    from task_days
  )
  select case
    when not exists (
      select 1 from public.children c
      where c.id = p_child_id and public.is_family_member(c.family_id)
    ) then 0
    else coalesce(
      (select (row_number - 1)::integer from ordered_days where not complete order by row_number limit 1),
      (select count(*)::integer from ordered_days),
      0
    )
  end;
$$;

create or replace function public.current_task_streak(p_child_id uuid)
returns integer
language plpgsql stable
security definer set search_path = public
as $$
declare
  v_through_date date := current_date;
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
    where child_id = p_child_id and scheduled_date = current_date;

  if v_has_today and not v_today_complete then v_through_date := current_date - 1; end if;
  return public.task_streak_at(p_child_id, v_through_date);
end;
$$;

create or replace function public.set_streak_rewards(
  p_family_id uuid,
  p_bonus_3 integer,
  p_bonus_7 integer,
  p_bonus_30 integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_parent(p_family_id) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;
  if p_bonus_3 not between 0 and 1000 or p_bonus_7 not between 0 and 1000 or p_bonus_30 not between 0 and 1000 then
    raise exception 'STREAK_BONUS_OUT_OF_RANGE';
  end if;
  update public.families
    set streak_3_bonus = p_bonus_3, streak_7_bonus = p_bonus_7, streak_30_bonus = p_bonus_30, updated_at = now()
    where id = p_family_id;
  return true;
end;
$$;

create or replace function public.adjust_child_points(
  p_child_id uuid,
  p_star_delta integer,
  p_diamond_delta integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_child public.children%rowtype;
  v_star_balance integer := 0;
  v_diamond_balance integer := 0;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then raise exception 'ADJUSTMENT_REASON_REQUIRED'; end if;
  if (coalesce(p_star_delta, 0) = 0 and coalesce(p_diamond_delta, 0) = 0)
    or (coalesce(p_star_delta, 0) <> 0 and coalesce(p_diamond_delta, 0) <> 0) then
    raise exception 'ADJUST_ONE_CURRENCY';
  end if;
  if abs(coalesce(p_star_delta, 0)) > 1000 or abs(coalesce(p_diamond_delta, 0)) > 1000 then
    raise exception 'ADJUSTMENT_OUT_OF_RANGE';
  end if;

  select * into v_child from public.children where id = p_child_id for update;
  if not found or not public.is_parent(v_child.family_id) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;

  select coalesce(sum(delta), 0)::integer into v_star_balance
    from public.star_ledger where child_id = v_child.id;
  select coalesce(sum(delta), 0)::integer into v_diamond_balance
    from public.diamond_ledger where child_id = v_child.id;

  if v_star_balance + coalesce(p_star_delta, 0) < 0 or v_diamond_balance + coalesce(p_diamond_delta, 0) < 0 then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  if coalesce(p_star_delta, 0) <> 0 then
    insert into public.star_ledger(family_id, child_id, delta, reason, created_by)
    values (v_child.family_id, v_child.id, p_star_delta, '家长调整：' || v_reason, auth.uid());
  else
    insert into public.diamond_ledger(family_id, child_id, delta, reason, created_by)
    values (v_child.family_id, v_child.id, p_diamond_delta, '家长调整：' || v_reason, auth.uid());
  end if;

  return jsonb_build_object(
    'stars', v_star_balance + coalesce(p_star_delta, 0),
    'diamonds', v_diamond_balance + coalesce(p_diamond_delta, 0)
  );
end;
$$;

create or replace function public.review_mission(p_mission_id uuid, p_approve boolean, p_reason text default null)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_streak integer := 0;
  v_bonus integer := 0;
  v_award_id uuid;
begin
  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found or not public.is_parent(v_mission.family_id) then raise exception 'MISSION_NOT_FOUND'; end if;
  if v_mission.status <> 'submitted' then raise exception 'MISSION_NOT_PENDING'; end if;

  if p_approve then
    update public.missions set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = null, updated_at = now() where id = p_mission_id;
    insert into public.star_ledger(family_id, child_id, delta, reason, mission_id, created_by)
    values (v_mission.family_id, v_mission.child_id, v_mission.stars, '完成任务：' || v_mission.title, v_mission.id, auth.uid())
    on conflict (mission_id) do nothing;

    if not exists (
      select 1 from public.missions
      where child_id = v_mission.child_id and scheduled_date = v_mission.scheduled_date and status <> 'approved'
    ) then
      v_streak := public.task_streak_at(v_mission.child_id, v_mission.scheduled_date);
      select case v_streak
        when 3 then streak_3_bonus
        when 7 then streak_7_bonus
        when 30 then streak_30_bonus
        else 0
      end into v_bonus
      from public.families where id = v_mission.family_id;

      if v_bonus > 0 then
        insert into public.streak_awards(family_id, child_id, milestone, bonus_stars, streak_end_date, created_by)
        values (v_mission.family_id, v_mission.child_id, v_streak, v_bonus, v_mission.scheduled_date, auth.uid())
        on conflict (child_id, milestone, streak_end_date) do nothing
        returning id into v_award_id;
        if v_award_id is not null then
          insert into public.star_ledger(family_id, child_id, delta, reason, streak_award_id, created_by)
          values (v_mission.family_id, v_mission.child_id, v_bonus, '连续打卡 ' || v_streak || ' 天奖励', v_award_id, auth.uid());
        end if;
      end if;
    end if;
  else
    update public.missions set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = coalesce(nullif(trim(p_reason), ''), '请重新完成'), updated_at = now() where id = p_mission_id;
  end if;
  return true;
end;
$$;

revoke all on function public.task_streak_at(uuid, date) from public;
revoke all on function public.current_task_streak(uuid) from public;
revoke all on function public.set_streak_rewards(uuid, integer, integer, integer) from public;
revoke all on function public.adjust_child_points(uuid, integer, integer, text) from public;
grant execute on function public.current_task_streak(uuid) to authenticated;
grant execute on function public.set_streak_rewards(uuid, integer, integer, integer) to authenticated;
grant execute on function public.adjust_child_points(uuid, integer, integer, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.streak_awards;
exception when duplicate_object then null;
end $$;
