-- Atomic Pro grant. Run once in Supabase → SQL Editor (safe to re-run). The app works without it (it falls back to
-- the older two-step grant), but with it a payment and the Pro extension happen in ONE database transaction:
--   * if the server dies half-way, nothing is saved — the payment stays "pending" and the next retry grants it,
--     instead of leaving a paid student without Pro;
--   * two payments confirmed at the same moment (e.g. weekly + monthly) both add their days, none is lost.

create or replace function public.grant_pro_for_payment(p_payment uuid, p_paid_kobo integer, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid;
  v_until timestamptz;
begin
  if p_days is null or p_days < 1 or p_days > 36500 then
    raise exception 'bad_days';
  end if;

  -- Claim the payment: only the first caller changes it, and only when the amount covers the price.
  update public.payments
     set status = 'success', paid_at = now()
   where id = p_payment
     and status <> 'success'
     and amount_kobo <= p_paid_kobo
  returning user_id into v_user;

  if v_user is null then
    return null;  -- already granted, unknown payment, or underpaid
  end if;

  -- Extend from the current end date while Pro is still running, otherwise from now. The row lock makes two
  -- simultaneous grants queue up and each one sees the other's result.
  update public.profiles
     set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => p_days),
         updated_at = now()
   where id = v_user
  returning premium_until into v_until;

  if v_until is null then
    raise exception 'profile_not_found';  -- undoes the claim above
  end if;

  return v_until;
end $$;

-- Only the server (service role) may grant Pro. Students and signed-out visitors must never reach this.
revoke all on function public.grant_pro_for_payment(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.grant_pro_for_payment(uuid, integer, integer) to service_role;
