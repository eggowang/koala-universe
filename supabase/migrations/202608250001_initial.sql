-- 考拉的宇宙任务：Supabase 初始数据库结构
-- 只把 publishable key 放在网页端；secret/service_role key 只能由 Edge Functions 使用。

create extension if not exists pgcrypto;

do $$ begin
  create type public.family_role as enum ('parent', 'child');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mission_status as enum ('todo', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.redemption_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '家长',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8)),
  child_login_email text unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.family_role not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at timestamptz,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  reminder_time time,
  created_at timestamptz not null default now()
);

create table if not exists public.template_tasks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.template_sections(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  stars integer not null default 1 check (stars between 1 and 100),
  requires_photo boolean not null default false,
  icon_type text not null default 'mission',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  template_task_id uuid references public.template_tasks(id) on delete set null,
  scheduled_date date not null,
  section_name text not null,
  reminder_time time,
  reminder_sent_at timestamptz,
  title text not null,
  stars integer not null check (stars between 1 and 100),
  requires_photo boolean not null default false,
  icon_type text not null default 'mission',
  sort_order integer not null default 0,
  status public.mission_status not null default 'todo',
  evidence_path text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists missions_family_date_idx on public.missions(family_id, scheduled_date);
create index if not exists missions_child_status_idx on public.missions(child_id, status);
create index if not exists missions_reminder_idx on public.missions(scheduled_date, reminder_time)
  where status = 'todo' and reminder_sent_at is null;

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  icon text not null default '🎁',
  cost integer not null check (cost between 1 and 10000),
  stock integer check (stock is null or stock >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  reward_id uuid references public.rewards(id) on delete set null,
  reward_title text not null,
  cost integer not null check (cost > 0),
  status public.redemption_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  rejection_reason text
);

create table if not exists public.star_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  mission_id uuid unique references public.missions(id) on delete restrict,
  redemption_id uuid unique references public.redemptions(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists star_ledger_child_idx on public.star_ledger(child_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', '家长'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_parent(p_family_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = auth.uid() and role = 'parent'
  );
$$;

revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.is_parent(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_parent(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.parent_invites enable row level security;
alter table public.task_templates enable row level security;
alter table public.template_sections enable row level security;
alter table public.template_tasks enable row level security;
alter table public.missions enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.star_ledger enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "profiles read own family" on public.profiles for select to authenticated
using (
  user_id = auth.uid() or exists (
    select 1 from public.family_members me
    join public.family_members them on them.family_id = me.family_id
    where me.user_id = auth.uid() and them.user_id = profiles.user_id
  )
);
create policy "profiles update own" on public.profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "families read members" on public.families for select to authenticated
using (public.is_family_member(id));
create policy "families update parents" on public.families for update to authenticated
using (public.is_parent(id)) with check (public.is_parent(id));

create policy "family members read family" on public.family_members for select to authenticated
using (public.is_family_member(family_id));

create policy "children read family" on public.children for select to authenticated
using (public.is_family_member(family_id));
create policy "children update parents" on public.children for update to authenticated
using (public.is_parent(family_id)) with check (public.is_parent(family_id));

create policy "invites parents read" on public.parent_invites for select to authenticated
using (public.is_parent(family_id));
create policy "invites parents insert" on public.parent_invites for insert to authenticated
with check (public.is_parent(family_id) and invited_by = auth.uid());
create policy "invites parents delete" on public.parent_invites for delete to authenticated
using (public.is_parent(family_id));

create policy "templates family read" on public.task_templates for select to authenticated
using (public.is_family_member(family_id));
create policy "templates parents insert" on public.task_templates for insert to authenticated
with check (public.is_parent(family_id) and created_by = auth.uid());
create policy "templates parents update" on public.task_templates for update to authenticated
using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "templates parents delete" on public.task_templates for delete to authenticated
using (public.is_parent(family_id));

create policy "sections family read" on public.template_sections for select to authenticated
using (public.is_family_member(family_id));
create policy "sections parents insert" on public.template_sections for insert to authenticated
with check (public.is_parent(family_id));
create policy "sections parents update" on public.template_sections for update to authenticated
using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "sections parents delete" on public.template_sections for delete to authenticated
using (public.is_parent(family_id));

create policy "template tasks family read" on public.template_tasks for select to authenticated
using (public.is_family_member(family_id));
create policy "template tasks parents insert" on public.template_tasks for insert to authenticated
with check (public.is_parent(family_id));
create policy "template tasks parents update" on public.template_tasks for update to authenticated
using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "template tasks parents delete" on public.template_tasks for delete to authenticated
using (public.is_parent(family_id));

create policy "missions family read" on public.missions for select to authenticated
using (public.is_family_member(family_id));
create policy "missions parents insert" on public.missions for insert to authenticated
with check (public.is_parent(family_id) and created_by = auth.uid());
create policy "missions parents delete future" on public.missions for delete to authenticated
using (public.is_parent(family_id) and scheduled_date >= current_date and status in ('todo', 'rejected'));

create policy "rewards family read" on public.rewards for select to authenticated
using (public.is_family_member(family_id));
create policy "rewards parents insert" on public.rewards for insert to authenticated
with check (public.is_parent(family_id) and created_by = auth.uid());
create policy "rewards parents update" on public.rewards for update to authenticated
using (public.is_parent(family_id)) with check (public.is_parent(family_id));
create policy "rewards parents delete" on public.rewards for delete to authenticated
using (public.is_parent(family_id));

create policy "redemptions family read" on public.redemptions for select to authenticated
using (public.is_family_member(family_id));
create policy "ledger family read" on public.star_ledger for select to authenticated
using (public.is_family_member(family_id));

create policy "push subscriptions own read" on public.push_subscriptions for select to authenticated
using (user_id = auth.uid());
create policy "push subscriptions own insert" on public.push_subscriptions for insert to authenticated
with check (user_id = auth.uid());
create policy "push subscriptions own update" on public.push_subscriptions for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push subscriptions own delete" on public.push_subscriptions for delete to authenticated
using (user_id = auth.uid());

create or replace function public.create_family(
  p_family_name text,
  p_parent_name text,
  p_child_full_name text,
  p_child_nickname text
)
returns table(family_id uuid, family_code text, child_id uuid, template_id uuid)
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_child_id uuid;
  v_template_id uuid;
  v_code text;
  v_morning uuid;
  v_after_school uuid;
  v_exercise uuid;
  v_bedtime uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'USER_ALREADY_HAS_FAMILY';
  end if;

  insert into public.families(name, created_by)
  values (coalesce(nullif(trim(p_family_name), ''), '考拉家庭'), auth.uid())
  returning id, invite_code into v_family_id, v_code;

  insert into public.family_members(family_id, user_id, role, display_name)
  values (v_family_id, auth.uid(), 'parent', coalesce(nullif(trim(p_parent_name), ''), '家长'));

  insert into public.children(family_id, full_name, nickname)
  values (v_family_id, trim(p_child_full_name), trim(p_child_nickname))
  returning id into v_child_id;

  insert into public.task_templates(family_id, name, created_by)
  values (v_family_id, '上学日模板', auth.uid()) returning id into v_template_id;

  insert into public.template_sections(template_id, family_id, name, sort_order, reminder_time)
  values (v_template_id, v_family_id, '早晨', 10, '07:00') returning id into v_morning;
  insert into public.template_sections(template_id, family_id, name, sort_order, reminder_time)
  values (v_template_id, v_family_id, '放学后', 20, '17:30') returning id into v_after_school;
  insert into public.template_sections(template_id, family_id, name, sort_order, reminder_time)
  values (v_template_id, v_family_id, '锻炼', 30, '19:00') returning id into v_exercise;
  insert into public.template_sections(template_id, family_id, name, sort_order, reminder_time)
  values (v_template_id, v_family_id, '睡前', 40, '21:00') returning id into v_bedtime;

  insert into public.template_tasks(section_id, family_id, title, stars, requires_photo, icon_type, sort_order)
  values
    (v_morning, v_family_id, '整理床铺和书包', 1, false, 'morning', 10),
    (v_after_school, v_family_id, '完成语文作业', 3, true, 'language', 10),
    (v_after_school, v_family_id, '完成数学作业', 3, true, 'math', 20),
    (v_after_school, v_family_id, '阅读 20 分钟', 2, false, 'reading', 30),
    (v_exercise, v_family_id, '跳绳 500 个', 4, true, 'jump', 10),
    (v_exercise, v_family_id, '户外运动 20 分钟', 3, false, 'sport', 20),
    (v_bedtime, v_family_id, '整理明天用品并早睡', 2, false, 'night', 10);

  insert into public.rewards(family_id, title, icon, cost, sort_order, created_by)
  values
    (v_family_id, '动画时间 20 分钟', '🎬', 20, 10, auth.uid()),
    (v_family_id, '周末游戏 30 分钟', '🎮', 30, 20, auth.uid()),
    (v_family_id, '选择一次亲子活动', '🚲', 50, 30, auth.uid());

  return query select v_family_id, v_code, v_child_id, v_template_id;
end;
$$;

create or replace function public.my_family_context()
returns table(
  family_id uuid,
  family_name text,
  family_code text,
  member_role public.family_role,
  child_id uuid,
  child_full_name text,
  child_nickname text
)
language sql stable
security definer set search_path = public
as $$
  select f.id, f.name, f.invite_code, fm.role, c.id, c.full_name, c.nickname
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  join public.children c on c.family_id = f.id
  where fm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.resolve_child_login(p_family_code text)
returns text
language sql stable
security definer set search_path = public
as $$
  select child_login_email from public.families
  where invite_code = upper(trim(p_family_code)) and child_login_email is not null
  limit 1;
$$;

create or replace function public.accept_parent_invite(p_token text, p_display_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite public.parent_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into v_invite from public.parent_invites
  where token = p_token and used_at is null and expires_at > now()
  for update;
  if not found then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;
  if lower(v_invite.email) <> v_email then raise exception 'INVITE_EMAIL_MISMATCH'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'USER_ALREADY_HAS_FAMILY';
  end if;
  insert into public.family_members(family_id, user_id, role, display_name)
  values (v_invite.family_id, auth.uid(), 'parent', coalesce(nullif(trim(p_display_name), ''), '家长'));
  update public.parent_invites set used_at = now() where id = v_invite.id;
  return v_invite.family_id;
end;
$$;

create or replace function public.submit_mission(p_mission_id uuid, p_evidence_path text default null)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
begin
  select m.* into v_mission
  from public.missions m
  join public.children c on c.id = m.child_id
  where m.id = p_mission_id and c.auth_user_id = auth.uid()
  for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if v_mission.status not in ('todo', 'rejected') then raise exception 'MISSION_ALREADY_SUBMITTED'; end if;
  if v_mission.requires_photo and coalesce(trim(p_evidence_path), '') = '' then raise exception 'PHOTO_REQUIRED'; end if;
  update public.missions set status = 'submitted', evidence_path = p_evidence_path,
    submitted_at = now(), reviewed_at = null, reviewed_by = null, rejection_reason = null, updated_at = now()
  where id = p_mission_id;
  return true;
end;
$$;

create or replace function public.review_mission(p_mission_id uuid, p_approve boolean, p_reason text default null)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
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
  else
    update public.missions set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = coalesce(nullif(trim(p_reason), ''), '请重新完成'), updated_at = now() where id = p_mission_id;
  end if;
  return true;
end;
$$;

create or replace function public.current_star_balance(p_child_id uuid)
returns integer
language sql stable
security definer set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer from public.star_ledger
  where child_id = p_child_id and public.is_family_member(family_id);
$$;

create or replace function public.request_redemption(p_reward_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_reward public.rewards%rowtype;
  v_child public.children%rowtype;
  v_balance integer;
  v_pending integer;
  v_id uuid;
begin
  select * into v_reward from public.rewards where id = p_reward_id and active = true;
  if not found then raise exception 'REWARD_NOT_FOUND'; end if;
  select * into v_child from public.children
  where family_id = v_reward.family_id and auth_user_id = auth.uid();
  if not found then raise exception 'CHILD_AUTH_REQUIRED'; end if;
  select coalesce(sum(delta), 0)::integer into v_balance from public.star_ledger where child_id = v_child.id;
  select coalesce(sum(cost), 0)::integer into v_pending from public.redemptions
    where child_id = v_child.id and status = 'pending';
  if v_balance - v_pending < v_reward.cost then raise exception 'INSUFFICIENT_STARS'; end if;
  insert into public.redemptions(family_id, child_id, reward_id, reward_title, cost)
  values (v_reward.family_id, v_child.id, v_reward.id, v_reward.title, v_reward.cost)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_redemption(p_redemption_id uuid, p_approve boolean, p_reason text default null)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_redemption public.redemptions%rowtype;
  v_balance integer;
begin
  select * into v_redemption from public.redemptions where id = p_redemption_id for update;
  if not found or not public.is_parent(v_redemption.family_id) then raise exception 'REDEMPTION_NOT_FOUND'; end if;
  if v_redemption.status <> 'pending' then raise exception 'REDEMPTION_NOT_PENDING'; end if;
  if p_approve then
    select coalesce(sum(delta), 0)::integer into v_balance from public.star_ledger where child_id = v_redemption.child_id;
    if v_balance < v_redemption.cost then raise exception 'INSUFFICIENT_STARS'; end if;
    update public.redemptions set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = null
      where id = p_redemption_id;
    insert into public.star_ledger(family_id, child_id, delta, reason, redemption_id, created_by)
    values (v_redemption.family_id, v_redemption.child_id, -v_redemption.cost,
      '兑换奖励：' || v_redemption.reward_title, v_redemption.id, auth.uid())
    on conflict (redemption_id) do nothing;
  else
    update public.redemptions set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = coalesce(nullif(trim(p_reason), ''), '暂不兑换') where id = p_redemption_id;
  end if;
  return true;
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
  if p_start_date < current_date then raise exception 'PAST_DATE_NOT_ALLOWED'; end if;
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
    where ts.template_id = p_template_id and tt.active = true
    order by ts.sort_order, tt.sort_order;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;
  return v_inserted;
end;
$$;

revoke all on function public.create_family(text, text, text, text) from public;
revoke all on function public.my_family_context() from public;
revoke all on function public.submit_mission(uuid, text) from public;
revoke all on function public.review_mission(uuid, boolean, text) from public;
revoke all on function public.current_star_balance(uuid) from public;
revoke all on function public.request_redemption(uuid) from public;
revoke all on function public.review_redemption(uuid, boolean, text) from public;
revoke all on function public.publish_template(uuid, date, integer, text) from public;
grant execute on function public.create_family(text, text, text, text) to authenticated;
grant execute on function public.my_family_context() to authenticated;
grant execute on function public.resolve_child_login(text) to anon, authenticated;
grant execute on function public.accept_parent_invite(text, text) to authenticated;
grant execute on function public.submit_mission(uuid, text) to authenticated;
grant execute on function public.review_mission(uuid, boolean, text) to authenticated;
grant execute on function public.current_star_balance(uuid) to authenticated;
grant execute on function public.request_redemption(uuid) to authenticated;
grant execute on function public.review_redemption(uuid, boolean, text) to authenticated;
grant execute on function public.publish_template(uuid, date, integer, text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('task-evidence', 'task-evidence', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "evidence family read" on storage.objects for select to authenticated
using (bucket_id = 'task-evidence' and public.is_family_member(((storage.foldername(name))[1])::uuid));
create policy "evidence family upload" on storage.objects for insert to authenticated
with check (bucket_id = 'task-evidence' and public.is_family_member(((storage.foldername(name))[1])::uuid));
create policy "evidence parents delete" on storage.objects for delete to authenticated
using (bucket_id = 'task-evidence' and public.is_parent(((storage.foldername(name))[1])::uuid));

do $$ begin
  alter publication supabase_realtime add table public.missions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rewards;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.redemptions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.star_ledger;
exception when duplicate_object then null; end $$;
