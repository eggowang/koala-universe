create table if not exists public.learning_answers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  material_id uuid not null unique references public.learning_materials(id) on delete cascade,
  answer_content text not null check (length(trim(answer_content)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_answers_family_updated_idx
  on public.learning_answers(family_id, updated_at desc);

alter table public.learning_answers enable row level security;

do $$
begin
  alter publication supabase_realtime add table public.learning_materials;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.learning_answers;
exception when duplicate_object then null;
end $$;

drop policy if exists "learning answers parents read" on public.learning_answers;
create policy "learning answers parents read" on public.learning_answers
  for select to authenticated using (public.is_parent(family_id));

drop policy if exists "learning answers parents insert" on public.learning_answers;
create policy "learning answers parents insert" on public.learning_answers
  for insert to authenticated with check (
    public.is_parent(family_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.learning_materials material
      where material.id = learning_answers.material_id
        and material.family_id = learning_answers.family_id
    )
  );

drop policy if exists "learning answers parents update" on public.learning_answers;
create policy "learning answers parents update" on public.learning_answers
  for update to authenticated
  using (public.is_parent(family_id))
  with check (
    public.is_parent(family_id)
    and exists (
      select 1 from public.learning_materials material
      where material.id = learning_answers.material_id
        and material.family_id = learning_answers.family_id
    )
  );

drop policy if exists "learning answers parents delete" on public.learning_answers;
create policy "learning answers parents delete" on public.learning_answers
  for delete to authenticated using (public.is_parent(family_id));

create or replace function public.seed_default_learning_answers()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_inserted integer;
begin
  select family_id into v_family_id
  from public.family_members
  where user_id = auth.uid() and role = 'parent'
  limit 1;
  if v_family_id is null then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;

  insert into public.learning_answers(family_id, material_id, answer_content, created_by)
  select material.family_id, material.id,
    case material.title
      when '词语搭配小练习' then E'1. 一条小河、一支铅笔。\n2. 示例：我认真地完成了今天的作业。\n3. 光亮（答案合理即可）。'
      when '100 以内加减法' then E'1. 63\n2. 37\n3. 42\n4. 42'
      when '生活应用题' then E'24 - 7 + 9 = 26（支）\n答：现在文具盒里有 26 支铅笔。'
      when 'Read and choose' then E'1. book\n2. pencil\n3. long'
    end,
    auth.uid()
  from public.learning_materials material
  where material.family_id = v_family_id
    and material.title in ('词语搭配小练习', '100 以内加减法', '生活应用题', 'Read and choose')
    and not exists (
      select 1 from public.learning_answers existing
      where existing.material_id = material.id
    );
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

insert into public.learning_answers(family_id, material_id, answer_content, created_by)
select material.family_id, material.id,
  case material.title
    when '词语搭配小练习' then E'1. 一条小河、一支铅笔。\n2. 示例：我认真地完成了今天的作业。\n3. 光亮（答案合理即可）。'
    when '100 以内加减法' then E'1. 63\n2. 37\n3. 42\n4. 42'
    when '生活应用题' then E'24 - 7 + 9 = 26（支）\n答：现在文具盒里有 26 支铅笔。'
    when 'Read and choose' then E'1. book\n2. pencil\n3. long'
  end,
  family.created_by
from public.learning_materials material
join public.families family on family.id = material.family_id
where material.title in ('词语搭配小练习', '100 以内加减法', '生活应用题', 'Read and choose')
  and not exists (
    select 1 from public.learning_answers existing
    where existing.material_id = material.id
  );

revoke all on function public.seed_default_learning_answers() from public;
grant execute on function public.seed_default_learning_answers() to authenticated;
