alter table public.families
  add column if not exists stars_per_diamond integer not null default 10
  check (stars_per_diamond between 1 and 1000);

create table if not exists public.diamond_exchanges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  stars_spent integer not null check (stars_spent between 1 and 1000),
  diamonds_received integer not null default 1 check (diamonds_received > 0),
  status public.redemption_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text
);

create index if not exists diamond_exchanges_family_status_idx
  on public.diamond_exchanges(family_id, status, requested_at desc);

create table if not exists public.diamond_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  exchange_id uuid unique references public.diamond_exchanges(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists diamond_ledger_child_idx
  on public.diamond_ledger(child_id, created_at desc);

alter table public.star_ledger
  add column if not exists diamond_exchange_id uuid unique
  references public.diamond_exchanges(id) on delete restrict;

alter table public.diamond_exchanges enable row level security;
alter table public.diamond_ledger enable row level security;

drop policy if exists "diamond exchanges family read" on public.diamond_exchanges;
create policy "diamond exchanges family read" on public.diamond_exchanges
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "diamond ledger family read" on public.diamond_ledger;
create policy "diamond ledger family read" on public.diamond_ledger
  for select to authenticated using (public.is_family_member(family_id));

create or replace function public.current_diamond_balance(p_child_id uuid)
returns integer
language sql stable
security definer set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
  from public.diamond_ledger
  where child_id = p_child_id and public.is_family_member(family_id);
$$;

create or replace function public.request_diamond_exchange()
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_child public.children%rowtype;
  v_rate integer;
  v_balance integer;
  v_pending_rewards integer;
  v_pending_exchanges integer;
  v_exchange_id uuid;
begin
  select * into v_child
  from public.children
  where auth_user_id = auth.uid()
  for update;
  if not found then raise exception 'CHILD_AUTH_REQUIRED'; end if;

  select stars_per_diamond into v_rate from public.families where id = v_child.family_id;
  select coalesce(sum(delta), 0)::integer into v_balance
    from public.star_ledger where child_id = v_child.id;
  select coalesce(sum(cost), 0)::integer into v_pending_rewards
    from public.redemptions where child_id = v_child.id and status = 'pending';
  select coalesce(sum(stars_spent), 0)::integer into v_pending_exchanges
    from public.diamond_exchanges where child_id = v_child.id and status = 'pending';

  if v_balance - v_pending_rewards - v_pending_exchanges < v_rate then
    raise exception 'INSUFFICIENT_STARS';
  end if;

  insert into public.diamond_exchanges(family_id, child_id, stars_spent, diamonds_received)
  values (v_child.family_id, v_child.id, v_rate, 1)
  returning id into v_exchange_id;
  return v_exchange_id;
end;
$$;

create or replace function public.review_diamond_exchange(
  p_exchange_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_exchange public.diamond_exchanges%rowtype;
  v_balance integer;
begin
  select * into v_exchange
  from public.diamond_exchanges
  where id = p_exchange_id
  for update;
  if not found or not public.is_parent(v_exchange.family_id) then
    raise exception 'DIAMOND_EXCHANGE_NOT_FOUND';
  end if;
  if v_exchange.status <> 'pending' then raise exception 'DIAMOND_EXCHANGE_NOT_PENDING'; end if;

  if p_approve then
    select coalesce(sum(delta), 0)::integer into v_balance
      from public.star_ledger where child_id = v_exchange.child_id;
    if v_balance < v_exchange.stars_spent then raise exception 'INSUFFICIENT_STARS'; end if;

    update public.diamond_exchanges
      set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = null
      where id = p_exchange_id;
    insert into public.star_ledger(
      family_id, child_id, delta, reason, diamond_exchange_id, created_by
    ) values (
      v_exchange.family_id, v_exchange.child_id, -v_exchange.stars_spent,
      '升级钻石', v_exchange.id, auth.uid()
    ) on conflict (diamond_exchange_id) do nothing;
    insert into public.diamond_ledger(
      family_id, child_id, delta, reason, exchange_id, created_by
    ) values (
      v_exchange.family_id, v_exchange.child_id, v_exchange.diamonds_received,
      '星星升级钻石', v_exchange.id, auth.uid()
    ) on conflict (exchange_id) do nothing;
  else
    update public.diamond_exchanges
      set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
        rejection_reason = coalesce(nullif(trim(p_reason), ''), '暂不兑换')
      where id = p_exchange_id;
  end if;
  return true;
end;
$$;

create or replace function public.set_diamond_exchange_rate(
  p_family_id uuid,
  p_stars_per_diamond integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_parent(p_family_id) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;
  if p_stars_per_diamond < 1 or p_stars_per_diamond > 1000 then raise exception 'RATE_OUT_OF_RANGE'; end if;
  update public.families
    set stars_per_diamond = p_stars_per_diamond, updated_at = now()
    where id = p_family_id;
  return true;
end;
$$;

revoke all on function public.current_diamond_balance(uuid) from public;
revoke all on function public.request_diamond_exchange() from public;
revoke all on function public.review_diamond_exchange(uuid, boolean, text) from public;
revoke all on function public.set_diamond_exchange_rate(uuid, integer) from public;
grant execute on function public.current_diamond_balance(uuid) to authenticated;
grant execute on function public.request_diamond_exchange() to authenticated;
grant execute on function public.review_diamond_exchange(uuid, boolean, text) to authenticated;
grant execute on function public.set_diamond_exchange_rate(uuid, integer) to authenticated;
