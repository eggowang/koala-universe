begin;

create or replace function public.delete_reward(p_reward_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select family_id into v_family_id
  from public.rewards
  where id = p_reward_id;

  if not found then return false; end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = v_family_id
      and user_id = auth.uid()
      and role = 'parent'
  ) then
    raise exception 'PARENT_PERMISSION_REQUIRED';
  end if;

  delete from public.rewards where id = p_reward_id;
  return found;
end;
$$;

revoke all on function public.delete_reward(uuid) from public;
grant execute on function public.delete_reward(uuid) to authenticated;

commit;
