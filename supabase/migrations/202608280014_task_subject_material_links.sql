-- 任务学科与资料关联：一份资料可以安全地用于多个任务。
alter table public.template_tasks
  add column if not exists subject text
  check (subject is null or subject in ('语文', '数学', '英语', '锻炼', '综合'));

alter table public.learning_materials
  drop constraint if exists learning_materials_subject_check;
alter table public.learning_materials
  add constraint learning_materials_subject_check
  check (subject in ('语文', '数学', '英语', '锻炼', '综合'));

insert into public.learning_materials(
  family_id, subject, grade, semester, material_type, title, content,
  source_label, published, active, sort_order, created_by
)
select f.id, '锻炼', 2, '通用', 'note', '运动前热身与放松',
  E'运动前：原地走一走、转转肩膀和脚踝，各 20 秒。\n运动中：感到头晕、疼痛或很喘时立刻停下，告诉家长。\n运动后：慢慢走一走、喝几口水，再做轻柔拉伸。',
  '家长运动安全模板', true, true, 80, f.created_by
from public.families f
where not exists (
  select 1 from public.learning_materials material
  where material.family_id = f.id and material.title = '运动前热身与放松'
);

create table if not exists public.learning_material_task_links (
  family_id uuid not null references public.families(id) on delete cascade,
  template_task_id uuid not null references public.template_tasks(id) on delete cascade,
  learning_material_id uuid not null references public.learning_materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_task_id, learning_material_id)
);

create index if not exists learning_material_task_links_family_idx
  on public.learning_material_task_links(family_id, template_task_id);

-- 保留旧的单任务关联，并迁移为可复用关联。
insert into public.learning_material_task_links(family_id, template_task_id, learning_material_id)
select family_id, template_task_id, id
from public.learning_materials
where template_task_id is not null
on conflict do nothing;

alter table public.learning_material_task_links enable row level security;

drop policy if exists "learning material links visible read" on public.learning_material_task_links;
create policy "learning material links visible read" on public.learning_material_task_links
  for select to authenticated
  using (
    public.is_parent(family_id)
    or public.is_family_member(family_id)
  );

drop policy if exists "learning material links parents insert" on public.learning_material_task_links;
create policy "learning material links parents insert" on public.learning_material_task_links
  for insert to authenticated
  with check (public.is_parent(family_id));

drop policy if exists "learning material links parents delete" on public.learning_material_task_links;
create policy "learning material links parents delete" on public.learning_material_task_links
  for delete to authenticated using (public.is_parent(family_id));

-- 孩子可读的资料既兼容旧关联，也支持新的多任务关联。
drop policy if exists "learning materials visible read" on public.learning_materials;
create policy "learning materials visible read" on public.learning_materials
  for select to authenticated
  using (
    public.is_parent(family_id)
    or (
      published = true and active = true and public.is_family_member(family_id)
      and (
        template_task_id is not null
        or exists (
          select 1 from public.learning_material_task_links link
          where link.family_id = learning_materials.family_id
            and link.learning_material_id = learning_materials.id
        )
      )
    )
  );

create or replace function public.set_task_learning_materials(
  p_template_task_id uuid,
  p_material_ids uuid[] default '{}'::uuid[]
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_family_id uuid;
  v_subject text;
  v_linked integer := 0;
begin
  select family_id, subject into v_family_id, v_subject
  from public.template_tasks
  where id = p_template_task_id and active = true;
  if v_family_id is null or not public.is_parent(v_family_id) then
    raise exception 'PARENT_PERMISSION_REQUIRED';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_material_ids, '{}'::uuid[])) material_id
    left join public.learning_materials material on material.id = material_id
    where material.id is null
       or material.family_id <> v_family_id
       or (v_subject in ('语文', '数学', '英语', '锻炼') and material.subject <> v_subject)
  ) then
    raise exception 'MATERIAL_NOT_AVAILABLE_FOR_TASK';
  end if;

  delete from public.learning_material_task_links
  where family_id = v_family_id and template_task_id = p_template_task_id;

  -- 旧版的单任务关联也必须一并解除，否则家长取消勾选后孩子仍会看到资料。
  update public.learning_materials
  set template_task_id = null, updated_at = now()
  where family_id = v_family_id and template_task_id = p_template_task_id;

  insert into public.learning_material_task_links(family_id, template_task_id, learning_material_id)
  select v_family_id, p_template_task_id, material_id
  from unnest(coalesce(p_material_ids, '{}'::uuid[])) material_id
  on conflict do nothing;
  get diagnostics v_linked = row_count;
  return v_linked;
end;
$$;

revoke all on function public.set_task_learning_materials(uuid, uuid[]) from public;
grant execute on function public.set_task_learning_materials(uuid, uuid[]) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.learning_material_task_links;
exception when duplicate_object then null;
end $$;
