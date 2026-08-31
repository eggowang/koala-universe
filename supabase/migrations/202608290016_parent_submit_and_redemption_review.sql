-- Parents may help submit a child's task from the parent device. Approval is still separate.
create or replace function public.submit_mission(p_mission_id uuid, p_evidence_path text default null)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.children c where c.id = v_mission.child_id and c.auth_user_id = auth.uid()
  ) and not exists (
    select 1 from public.family_members fm
    where fm.family_id = v_mission.family_id and fm.user_id = auth.uid() and fm.role = 'parent'
  ) then
    raise exception 'MISSION_SUBMIT_PERMISSION_REQUIRED';
  end if;
  if v_mission.status not in ('todo', 'rejected') then raise exception 'MISSION_ALREADY_SUBMITTED'; end if;
  if v_mission.requires_photo and coalesce(trim(p_evidence_path), '') = '' then raise exception 'PHOTO_REQUIRED'; end if;
  update public.missions set status = 'submitted', evidence_path = p_evidence_path,
    submitted_at = now(), reviewed_at = null, reviewed_by = null, rejection_reason = null, updated_at = now()
  where id = p_mission_id;
  return true;
end;
$$;

-- Keep the not-found and parent-permission paths distinct. The direct membership check
-- is reliable for a SECURITY DEFINER RPC invoked from either parent account.
create or replace function public.review_redemption(p_redemption_id uuid, p_approve boolean, p_reason text default null)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_redemption public.redemptions%rowtype;
  v_balance numeric(10,1);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_redemption from public.redemptions where id = p_redemption_id for update;
  if not found then raise exception 'REDEMPTION_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = v_redemption.family_id and fm.user_id = auth.uid() and fm.role = 'parent'
  ) then raise exception 'PARENT_PERMISSION_REQUIRED'; end if;
  if v_redemption.status <> 'pending' then raise exception 'REDEMPTION_NOT_PENDING'; end if;
  if p_approve then
    select coalesce(sum(delta), 0)::numeric(10,1) into v_balance from public.star_ledger where child_id = v_redemption.child_id;
    if v_balance < v_redemption.cost then raise exception 'INSUFFICIENT_STARS'; end if;
    update public.redemptions set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = null where id = p_redemption_id;
    insert into public.star_ledger(family_id, child_id, delta, reason, redemption_id, created_by)
    values (v_redemption.family_id, v_redemption.child_id, -v_redemption.cost, '兑换奖励：' || v_redemption.reward_title, v_redemption.id, auth.uid())
    on conflict (redemption_id) do nothing;
  else
    update public.redemptions set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = coalesce(nullif(trim(p_reason), ''), '暂不兑换') where id = p_redemption_id;
  end if;
  return true;
end;
$$;

revoke all on function public.submit_mission(uuid, text) from public;
revoke all on function public.review_redemption(uuid, boolean, text) from public;
grant execute on function public.submit_mission(uuid, text) to authenticated;
grant execute on function public.review_redemption(uuid, boolean, text) to authenticated;
