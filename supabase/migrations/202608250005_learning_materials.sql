create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  template_task_id uuid references public.template_tasks(id) on delete set null,
  subject text not null check (subject in ('语文', '数学', '英语', '综合')),
  grade integer not null default 2 check (grade between 1 and 12),
  semester text not null default '上册' check (semester in ('上册', '下册', '通用')),
  material_type text not null check (material_type in ('exercise', 'note', 'link')),
  title text not null,
  content text not null,
  source_label text not null default '家长自建',
  source_url text,
  published boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_materials_family_subject_idx
  on public.learning_materials(family_id, subject, published, sort_order);
create index if not exists learning_materials_task_idx
  on public.learning_materials(template_task_id) where published = true and active = true;

alter table public.learning_materials enable row level security;

drop policy if exists "learning materials visible read" on public.learning_materials;
create policy "learning materials visible read" on public.learning_materials
  for select to authenticated
  using (
    public.is_parent(family_id)
    or (published = true and active = true and template_task_id is not null and public.is_family_member(family_id))
  );

drop policy if exists "learning materials parents insert" on public.learning_materials;
create policy "learning materials parents insert" on public.learning_materials
  for insert to authenticated
  with check (
    public.is_parent(family_id) and created_by = auth.uid()
    and (template_task_id is null or exists (
      select 1 from public.template_tasks tt
      where tt.id = learning_materials.template_task_id and tt.family_id = learning_materials.family_id
    ))
  );

drop policy if exists "learning materials parents update" on public.learning_materials;
create policy "learning materials parents update" on public.learning_materials
  for update to authenticated
  using (public.is_parent(family_id)) with check (
    public.is_parent(family_id)
    and (template_task_id is null or exists (
      select 1 from public.template_tasks tt
      where tt.id = learning_materials.template_task_id and tt.family_id = learning_materials.family_id
    ))
  );

drop policy if exists "learning materials parents delete" on public.learning_materials;
create policy "learning materials parents delete" on public.learning_materials
  for delete to authenticated using (public.is_parent(family_id));

create or replace function public.seed_default_learning_materials()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_created_by uuid;
  v_inserted integer;
begin
  select fm.family_id, f.created_by into v_family_id, v_created_by
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where fm.user_id = auth.uid() and fm.role = 'parent'
  limit 1;
  if v_family_id is null then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;

  insert into public.learning_materials(
    family_id, template_task_id, subject, grade, semester, material_type,
    title, content, source_label, source_url, published, sort_order, created_by
  )
  select v_family_id,
    case when sample.task_title is null then null else (
      select tt.id from public.template_tasks tt
      where tt.family_id = v_family_id and tt.title = sample.task_title
      order by tt.created_at limit 1
    ) end,
    sample.subject, 2, '上册', sample.material_type, sample.title, sample.content,
    sample.source_label, sample.source_url, sample.published, sample.sort_order, v_created_by
  from (values
    ('语文', 'note', '看图说话三步法', E'第一步：看清时间、地点和人物。\n第二步：按顺序说清楚发生了什么。\n第三步：补充人物的动作、表情和感受。', '家长自建示例', null::text, true, 10, '完成语文作业'),
    ('语文', 'exercise', '词语搭配小练习', E'1. 在括号里填上合适的词：一（　）小河、一（　）铅笔。\n2. 用“认真”写一句完整的话。\n3. 找出“明亮”的近义词。', '原创练习', null::text, true, 20, '完成语文作业'),
    ('数学', 'exercise', '100 以内加减法', E'1. 36 + 27 = ______\n2. 82 - 45 = ______\n3. 48 + 19 - 25 = ______\n4. 比 60 少 18 的数是 ______。', '原创练习', null::text, true, 30, '完成数学作业'),
    ('数学', 'exercise', '生活应用题', '文具盒里有 24 支铅笔，借给同学 7 支，后来又放进 9 支。现在文具盒里有多少支铅笔？请写出算式和答案。', '原创练习', null::text, true, 40, '完成数学作业'),
    ('英语', 'note', 'My school bag 词汇卡', E'school bag — 书包\nbook — 书\npencil — 铅笔\nruler — 尺子\n句型：I have a pencil in my school bag.', '原创学习卡', null::text, true, 50, null::text),
    ('英语', 'exercise', 'Read and choose', E'Choose the right word.\n1. I have a (book / red).\n2. This is my (pencil / happy).\n3. The ruler is (long / sing).', '原创练习', null::text, true, 60, null::text),
    ('综合', 'link', '沪学习官方平台', '正版数字课本、点读与同步练习需在沪学习官方平台或 App 内使用。', '沪学习官方网站', 'https://www.diyiedu.com/', false, 70, null::text)
  ) as sample(subject, material_type, title, content, source_label, source_url, published, sort_order, task_title)
  where not exists (
    select 1 from public.learning_materials existing
    where existing.family_id = v_family_id and existing.title = sample.title
  );
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

insert into public.learning_materials(
  family_id, template_task_id, subject, grade, semester, material_type,
  title, content, source_label, source_url, published, sort_order, created_by
)
select f.id,
  case when sample.task_title is null then null else (
    select tt.id from public.template_tasks tt
    where tt.family_id = f.id and tt.title = sample.task_title
    order by tt.created_at limit 1
  ) end,
  sample.subject, 2, '上册', sample.material_type, sample.title, sample.content,
  sample.source_label, sample.source_url, sample.published, sample.sort_order, f.created_by
from public.families f
cross join (values
  ('语文', 'note', '看图说话三步法', E'第一步：看清时间、地点和人物。\n第二步：按顺序说清楚发生了什么。\n第三步：补充人物的动作、表情和感受。', '家长自建示例', null::text, true, 10, '完成语文作业'),
  ('语文', 'exercise', '词语搭配小练习', E'1. 在括号里填上合适的词：一（　）小河、一（　）铅笔。\n2. 用“认真”写一句完整的话。\n3. 找出“明亮”的近义词。', '原创练习', null::text, true, 20, '完成语文作业'),
  ('数学', 'exercise', '100 以内加减法', E'1. 36 + 27 = ______\n2. 82 - 45 = ______\n3. 48 + 19 - 25 = ______\n4. 比 60 少 18 的数是 ______。', '原创练习', null::text, true, 30, '完成数学作业'),
  ('数学', 'exercise', '生活应用题', '文具盒里有 24 支铅笔，借给同学 7 支，后来又放进 9 支。现在文具盒里有多少支铅笔？请写出算式和答案。', '原创练习', null::text, true, 40, '完成数学作业'),
  ('英语', 'note', 'My school bag 词汇卡', E'school bag — 书包\nbook — 书\npencil — 铅笔\nruler — 尺子\n句型：I have a pencil in my school bag.', '原创学习卡', null::text, true, 50, null::text),
  ('英语', 'exercise', 'Read and choose', E'Choose the right word.\n1. I have a (book / red).\n2. This is my (pencil / happy).\n3. The ruler is (long / sing).', '原创练习', null::text, true, 60, null::text),
  ('综合', 'link', '沪学习官方平台', '正版数字课本、点读与同步练习需在沪学习官方平台或 App 内使用。', '沪学习官方网站', 'https://www.diyiedu.com/', false, 70, null::text)
) as sample(subject, material_type, title, content, source_label, source_url, published, sort_order, task_title)
where not exists (
  select 1 from public.learning_materials existing
  where existing.family_id = f.id and existing.title = sample.title
);

revoke all on function public.seed_default_learning_materials() from public;
grant execute on function public.seed_default_learning_materials() to authenticated;
