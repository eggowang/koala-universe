-- Star values are kept to one decimal place, but only .5 steps are accepted.
-- Diamonds remain whole numbers.
alter table public.template_tasks drop constraint if exists template_tasks_stars_check;
alter table public.missions drop constraint if exists missions_stars_check;
alter table public.rewards drop constraint if exists rewards_cost_check;
alter table public.redemptions drop constraint if exists redemptions_cost_check;
alter table public.star_ledger drop constraint if exists star_ledger_delta_check;
alter table public.families drop constraint if exists families_stars_per_diamond_check;
alter table public.diamond_exchanges drop constraint if exists diamond_exchanges_stars_spent_check;
alter table public.families drop constraint if exists families_streak_3_bonus_check;
alter table public.families drop constraint if exists families_streak_7_bonus_check;
alter table public.families drop constraint if exists families_streak_30_bonus_check;
alter table public.streak_awards drop constraint if exists streak_awards_bonus_stars_check;

alter table public.template_tasks alter column stars type numeric(10,1) using stars::numeric;
alter table public.missions alter column stars type numeric(10,1) using stars::numeric;
alter table public.rewards alter column cost type numeric(10,1) using cost::numeric;
alter table public.redemptions alter column cost type numeric(10,1) using cost::numeric;
alter table public.star_ledger alter column delta type numeric(10,1) using delta::numeric;
alter table public.families alter column stars_per_diamond type numeric(10,1) using stars_per_diamond::numeric;
alter table public.diamond_exchanges alter column stars_spent type numeric(10,1) using stars_spent::numeric;
alter table public.families alter column streak_3_bonus type numeric(10,1) using streak_3_bonus::numeric;
alter table public.families alter column streak_7_bonus type numeric(10,1) using streak_7_bonus::numeric;
alter table public.families alter column streak_30_bonus type numeric(10,1) using streak_30_bonus::numeric;
alter table public.streak_awards alter column bonus_stars type numeric(10,1) using bonus_stars::numeric;

alter table public.template_tasks add constraint template_tasks_stars_check check (stars between 0.5 and 100 and mod(stars * 2, 1) = 0);
alter table public.missions add constraint missions_stars_check check (stars between 0.5 and 100 and mod(stars * 2, 1) = 0);
alter table public.rewards add constraint rewards_cost_check check (cost between 0.5 and 10000 and mod(cost * 2, 1) = 0);
alter table public.redemptions add constraint redemptions_cost_check check (cost > 0 and mod(cost * 2, 1) = 0);
alter table public.star_ledger add constraint star_ledger_delta_check check (delta <> 0 and mod(delta * 2, 1) = 0);
alter table public.families add constraint families_stars_per_diamond_check check (stars_per_diamond between 0.5 and 1000 and mod(stars_per_diamond * 2, 1) = 0);
alter table public.diamond_exchanges add constraint diamond_exchanges_stars_spent_check check (stars_spent between 0.5 and 1000 and mod(stars_spent * 2, 1) = 0);
alter table public.families add constraint families_streak_3_bonus_check check (streak_3_bonus between 0 and 1000 and mod(streak_3_bonus * 2, 1) = 0);
alter table public.families add constraint families_streak_7_bonus_check check (streak_7_bonus between 0 and 1000 and mod(streak_7_bonus * 2, 1) = 0);
alter table public.families add constraint families_streak_30_bonus_check check (streak_30_bonus between 0 and 1000 and mod(streak_30_bonus * 2, 1) = 0);
alter table public.streak_awards add constraint streak_awards_bonus_stars_check check (bonus_stars > 0 and mod(bonus_stars * 2, 1) = 0);

drop function if exists public.current_star_balance(uuid);
drop function if exists public.set_diamond_exchange_rate(uuid, integer);
drop function if exists public.set_streak_rewards(uuid, integer, integer, integer);
drop function if exists public.adjust_child_points(uuid, integer, integer, text);

create function public.current_star_balance(p_child_id uuid)
returns numeric(10,1)
language sql stable
security definer set search_path = public
as $$
  select coalesce(sum(delta), 0)::numeric(10,1) from public.star_ledger
  where child_id = p_child_id and public.is_family_member(family_id);
$$;

create or replace function public.request_redemption(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_reward public.rewards%rowtype; v_child public.children%rowtype; v_balance numeric(10,1); v_pending numeric(10,1); v_id uuid;
begin
  select * into v_reward from public.rewards where id = p_reward_id and active = true;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  select * into v_child from public.children where family_id = v_reward.family_id and auth_user_id = auth.uid();
  if not found then raise exception 'CHILD_AUTH_REQUIRED'; end if;
  select coalesce(sum(delta), 0)::numeric(10,1) into v_balance from public.star_ledger where child_id = v_child.id;
  select coalesce(sum(cost), 0)::numeric(10,1) into v_pending from public.redemptions where child_id = v_child.id and status = 'pending';
  if v_balance - v_pending < v_reward.cost then raise exception 'INSUFFICIENT_STARS'; end if;
  insert into public.redemptions(family_id, child_id, reward_id, reward_title, cost) values (v_reward.family_id, v_child.id, v_reward.id, v_reward.title, v_reward.cost) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_redemption(p_redemption_id uuid, p_approve boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_redemption public.redemptions%rowtype; v_balance numeric(10,1);
begin
  select * into v_redemption from public.redemptions where id = p_redemption_id for update;
  if not found or not public.is_parent(v_redemption.family_id) then raise exception 'REDEMPTION_NOT_FOUND'; end if;
  if v_redemption.status <> 'pending' then raise exception 'REDEMPTION_NOT_PENDING'; end if;
  if p_approve then
    select coalesce(sum(delta), 0)::numeric(10,1) into v_balance from public.star_ledger where child_id = v_redemption.child_id;
    if v_balance < v_redemption.cost then raise exception 'INSUFFICIENT_STARS'; end if;
    update public.redemptions set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = null where id = p_redemption_id;
    insert into public.star_ledger(family_id, child_id, delta, reason, redemption_id, created_by)
    values (v_redemption.family_id, v_redemption.child_id, -v_redemption.cost, '兑换奖励：' || v_redemption.reward_title, v_redemption.id, auth.uid()) on conflict (redemption_id) do nothing;
  else
    update public.redemptions set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = coalesce(nullif(trim(p_reason), ''), '暂不兑换') where id = p_redemption_id;
  end if;
  return true;
end;
$$;

create or replace function public.request_diamond_exchange()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_child public.children%rowtype; v_rate numeric(10,1); v_balance numeric(10,1); v_pending_rewards numeric(10,1); v_pending_exchanges numeric(10,1); v_exchange_id uuid;
begin
  select * into v_child from public.children where auth_user_id = auth.uid() for update;
  if not found then raise exception 'CHILD_AUTH_REQUIRED'; end if;
  select stars_per_diamond into v_rate from public.families where id = v_child.family_id;
  select coalesce(sum(delta), 0)::numeric(10,1) into v_balance from public.star_ledger where child_id = v_child.id;
  select coalesce(sum(cost), 0)::numeric(10,1) into v_pending_rewards from public.redemptions where child_id = v_child.id and status = 'pending';
  select coalesce(sum(stars_spent), 0)::numeric(10,1) into v_pending_exchanges from public.diamond_exchanges where child_id = v_child.id and status = 'pending';
  if v_balance - v_pending_rewards - v_pending_exchanges < v_rate then raise exception 'INSUFFICIENT_STARS'; end if;
  insert into public.diamond_exchanges(family_id, child_id, stars_spent, diamonds_received) values (v_child.family_id, v_child.id, v_rate, 1) returning id into v_exchange_id;
  return v_exchange_id;
end;
$$;

create or replace function public.review_diamond_exchange(p_exchange_id uuid, p_approve boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_exchange public.diamond_exchanges%rowtype; v_balance numeric(10,1);
begin
  select * into v_exchange from public.diamond_exchanges where id = p_exchange_id for update;
  if not found or not public.is_parent(v_exchange.family_id) then raise exception 'DIAMOND_EXCHANGE_NOT_FOUND'; end if;
  if v_exchange.status <> 'pending' then raise exception 'DIAMOND_EXCHANGE_NOT_PENDING'; end if;
  if p_approve then
    select coalesce(sum(delta), 0)::numeric(10,1) into v_balance from public.star_ledger where child_id = v_exchange.child_id;
    if v_balance < v_exchange.stars_spent then raise exception 'INSUFFICIENT_STARS'; end if;
    update public.diamond_exchanges set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = null where id = p_exchange_id;
    insert into public.star_ledger(family_id, child_id, delta, reason, diamond_exchange_id, created_by) values (v_exchange.family_id, v_exchange.child_id, -v_exchange.stars_spent, '升级钻石', v_exchange.id, auth.uid()) on conflict (diamond_exchange_id) do nothing;
    insert into public.diamond_ledger(family_id, child_id, delta, reason, exchange_id, created_by) values (v_exchange.family_id, v_exchange.child_id, v_exchange.diamonds_received, '星星升级钻石', v_exchange.id, auth.uid()) on conflict (exchange_id) do nothing;
  else
    update public.diamond_exchanges set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = coalesce(nullif(trim(p_reason), ''), '暂不兑换') where id = p_exchange_id;
  end if;
  return true;
end;
$$;

create function public.set_diamond_exchange_rate(p_family_id uuid, p_stars_per_diamond numeric(10,1))
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent(p_family_id) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;
  if p_stars_per_diamond < 0.5 or p_stars_per_diamond > 1000 or mod(p_stars_per_diamond * 2, 1) <> 0 then raise exception 'RATE_OUT_OF_RANGE'; end if;
  update public.families set stars_per_diamond = p_stars_per_diamond, updated_at = now() where id = p_family_id;
  return true;
end;
$$;

create function public.set_streak_rewards(p_family_id uuid, p_bonus_3 numeric(10,1), p_bonus_7 numeric(10,1), p_bonus_30 numeric(10,1))
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent(p_family_id) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;
  if p_bonus_3 not between 0 and 1000 or p_bonus_7 not between 0 and 1000 or p_bonus_30 not between 0 and 1000
    or mod(p_bonus_3 * 2, 1) <> 0 or mod(p_bonus_7 * 2, 1) <> 0 or mod(p_bonus_30 * 2, 1) <> 0 then raise exception 'STREAK_BONUS_OUT_OF_RANGE'; end if;
  update public.families set streak_3_bonus = p_bonus_3, streak_7_bonus = p_bonus_7, streak_30_bonus = p_bonus_30, updated_at = now() where id = p_family_id;
  return true;
end;
$$;

create function public.adjust_child_points(p_child_id uuid, p_star_delta numeric(10,1), p_diamond_delta integer, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_child public.children%rowtype; v_star_balance numeric(10,1) := 0; v_diamond_balance integer := 0; v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if (coalesce(p_star_delta, 0) = 0 and coalesce(p_diamond_delta, 0) = 0) or (coalesce(p_star_delta, 0) <> 0 and coalesce(p_diamond_delta, 0) <> 0) then raise exception 'ADJUST_ONE_CURRENCY'; end if;
  if abs(coalesce(p_star_delta, 0)) > 1000 or abs(coalesce(p_diamond_delta, 0)) > 1000 or mod(coalesce(p_star_delta, 0) * 2, 1) <> 0 then raise exception 'ADJUSTMENT_OUT_OF_RANGE'; end if;
  select * into v_child from public.children where id = p_child_id for update;
  if not found or not public.is_parent(v_child.family_id) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;
  select coalesce(sum(delta), 0)::numeric(10,1) into v_star_balance from public.star_ledger where child_id = v_child.id;
  select coalesce(sum(delta), 0)::integer into v_diamond_balance from public.diamond_ledger where child_id = v_child.id;
  if v_star_balance + coalesce(p_star_delta, 0) < 0 or v_diamond_balance + coalesce(p_diamond_delta, 0) < 0 then raise exception 'INSUFFICIENT_POINTS'; end if;
  if coalesce(p_star_delta, 0) <> 0 then
    insert into public.star_ledger(family_id, child_id, delta, reason, created_by) values (v_child.family_id, v_child.id, p_star_delta, '家长调整：' || coalesce(v_reason, case when p_star_delta > 0 then '家长手动加分' else '家长手动扣分' end), auth.uid());
  else
    insert into public.diamond_ledger(family_id, child_id, delta, reason, created_by) values (v_child.family_id, v_child.id, p_diamond_delta, '家长调整：' || coalesce(v_reason, case when p_diamond_delta > 0 then '家长手动加分' else '家长手动扣分' end), auth.uid());
  end if;
  return jsonb_build_object('stars', v_star_balance + coalesce(p_star_delta, 0), 'diamonds', v_diamond_balance + coalesce(p_diamond_delta, 0));
end;
$$;

create or replace function public.reset_child_points(p_child_id uuid, p_reset_stars boolean, p_reset_diamonds boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_child public.children%rowtype; v_star_balance numeric(10,1) := 0; v_diamond_balance integer := 0; v_cancelled_redemptions integer := 0; v_cancelled_exchanges integer := 0;
begin
  if not coalesce(p_reset_stars, false) and not coalesce(p_reset_diamonds, false) then raise exception 'RESET_SELECTION_REQUIRED'; end if;
  select * into v_child from public.children where id = p_child_id for update;
  if not found or not public.is_parent(v_child.family_id) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;
  if coalesce(p_reset_stars, false) then
    select greatest(coalesce(sum(delta), 0)::numeric(10,1), 0) into v_star_balance from public.star_ledger where child_id = v_child.id;
    update public.redemptions set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = '星星已由家长清零' where child_id = v_child.id and status = 'pending'; get diagnostics v_cancelled_redemptions = row_count;
    if v_star_balance > 0 then insert into public.star_ledger(family_id, child_id, delta, reason, created_by) values (v_child.family_id, v_child.id, -v_star_balance, '家长清零星星', auth.uid()); end if;
  end if;
  if coalesce(p_reset_stars, false) or coalesce(p_reset_diamonds, false) then update public.diamond_exchanges set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = '积分已由家长清零' where child_id = v_child.id and status = 'pending'; get diagnostics v_cancelled_exchanges = row_count; end if;
  if coalesce(p_reset_diamonds, false) then select greatest(coalesce(sum(delta), 0)::integer, 0) into v_diamond_balance from public.diamond_ledger where child_id = v_child.id; if v_diamond_balance > 0 then insert into public.diamond_ledger(family_id, child_id, delta, reason, created_by) values (v_child.family_id, v_child.id, -v_diamond_balance, '家长清零钻石', auth.uid()); end if; end if;
  return jsonb_build_object('cleared_stars', case when coalesce(p_reset_stars, false) then v_star_balance else 0 end, 'cleared_diamonds', case when coalesce(p_reset_diamonds, false) then v_diamond_balance else 0 end, 'cancelled_redemptions', v_cancelled_redemptions, 'cancelled_diamond_exchanges', v_cancelled_exchanges);
end;
$$;

create or replace function public.review_mission(p_mission_id uuid, p_approve boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_mission public.missions%rowtype; v_streak integer := 0; v_bonus numeric(10,1) := 0; v_award_id uuid;
begin
  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found or not public.is_parent(v_mission.family_id) then raise exception 'MISSION_NOT_FOUND'; end if;
  if v_mission.status <> 'submitted' then raise exception 'MISSION_NOT_PENDING'; end if;
  if p_approve then
    update public.missions set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = null, updated_at = now() where id = p_mission_id;
    insert into public.star_ledger(family_id, child_id, delta, reason, mission_id, created_by) values (v_mission.family_id, v_mission.child_id, v_mission.stars, '完成任务：' || v_mission.title, v_mission.id, auth.uid()) on conflict (mission_id) do nothing;
    if not exists (select 1 from public.missions where child_id = v_mission.child_id and scheduled_date = v_mission.scheduled_date and status <> 'approved') then
      v_streak := public.task_streak_at(v_mission.child_id, v_mission.scheduled_date);
      select case v_streak when 3 then streak_3_bonus when 7 then streak_7_bonus when 30 then streak_30_bonus else 0 end into v_bonus from public.families where id = v_mission.family_id;
      if v_bonus > 0 then
        insert into public.streak_awards(family_id, child_id, milestone, bonus_stars, streak_end_date, created_by) values (v_mission.family_id, v_mission.child_id, v_streak, v_bonus, v_mission.scheduled_date, auth.uid()) on conflict (child_id, milestone, streak_end_date) do nothing returning id into v_award_id;
        if v_award_id is not null then insert into public.star_ledger(family_id, child_id, delta, reason, streak_award_id, created_by) values (v_mission.family_id, v_mission.child_id, v_bonus, '连续打卡 ' || v_streak || ' 天奖励', v_award_id, auth.uid()); end if;
      end if;
    end if;
  else
    update public.missions set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = coalesce(nullif(trim(p_reason), ''), '请重新完成'), updated_at = now() where id = p_mission_id;
  end if;
  return true;
end;
$$;

revoke all on function public.current_star_balance(uuid) from public;
revoke all on function public.set_diamond_exchange_rate(uuid, numeric) from public;
revoke all on function public.set_streak_rewards(uuid, numeric, numeric, numeric) from public;
revoke all on function public.adjust_child_points(uuid, numeric, integer, text) from public;
grant execute on function public.current_star_balance(uuid) to authenticated;
grant execute on function public.set_diamond_exchange_rate(uuid, numeric) to authenticated;
grant execute on function public.set_streak_rewards(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.adjust_child_points(uuid, numeric, integer, text) to authenticated;
