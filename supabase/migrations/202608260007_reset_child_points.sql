create or replace function public.reset_child_points(
  p_child_id uuid,
  p_reset_stars boolean,
  p_reset_diamonds boolean
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_child public.children%rowtype;
  v_star_balance integer := 0;
  v_diamond_balance integer := 0;
  v_cancelled_redemptions integer := 0;
  v_cancelled_exchanges integer := 0;
begin
  if not coalesce(p_reset_stars, false) and not coalesce(p_reset_diamonds, false) then
    raise exception 'RESET_SELECTION_REQUIRED';
  end if;

  select * into v_child
  from public.children
  where id = p_child_id
  for update;

  if not found or not public.is_parent(v_child.family_id) then
    raise exception 'PARENT_PERMISSION_REQUIRED';
  end if;

  if coalesce(p_reset_stars, false) then
    select greatest(coalesce(sum(delta), 0)::integer, 0)
      into v_star_balance
      from public.star_ledger
      where child_id = v_child.id;

    update public.redemptions
      set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
        rejection_reason = '星星已由家长清零'
      where child_id = v_child.id and status = 'pending';
    get diagnostics v_cancelled_redemptions = row_count;

    if v_star_balance > 0 then
      insert into public.star_ledger(family_id, child_id, delta, reason, created_by)
      values (v_child.family_id, v_child.id, -v_star_balance, '家长清零星星', auth.uid());
    end if;
  end if;

  if coalesce(p_reset_stars, false) or coalesce(p_reset_diamonds, false) then
    update public.diamond_exchanges
      set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
        rejection_reason = '积分已由家长清零'
      where child_id = v_child.id and status = 'pending';
    get diagnostics v_cancelled_exchanges = row_count;
  end if;

  if coalesce(p_reset_diamonds, false) then
    select greatest(coalesce(sum(delta), 0)::integer, 0)
      into v_diamond_balance
      from public.diamond_ledger
      where child_id = v_child.id;

    if v_diamond_balance > 0 then
      insert into public.diamond_ledger(family_id, child_id, delta, reason, created_by)
      values (v_child.family_id, v_child.id, -v_diamond_balance, '家长清零钻石', auth.uid());
    end if;
  end if;

  return jsonb_build_object(
    'cleared_stars', case when coalesce(p_reset_stars, false) then v_star_balance else 0 end,
    'cleared_diamonds', case when coalesce(p_reset_diamonds, false) then v_diamond_balance else 0 end,
    'cancelled_redemptions', v_cancelled_redemptions,
    'cancelled_diamond_exchanges', v_cancelled_exchanges
  );
end;
$$;

revoke all on function public.reset_child_points(uuid, boolean, boolean) from public;
grant execute on function public.reset_child_points(uuid, boolean, boolean) to authenticated;
