alter table public.customer_style_profiles
  add column if not exists next_delivery_at_utc timestamptz;

create index if not exists customer_style_profiles_next_delivery_idx
  on public.customer_style_profiles (daily_email_enabled, next_delivery_at_utc);

update public.customer_style_profiles
set next_delivery_at_utc = case
  when daily_email_enabled then
    (
      case
        when (now() at time zone timezone)::time < time '06:15'
          then date_trunc('day', now() at time zone timezone) + interval '6 hours'
        else date_trunc('day', now() at time zone timezone) + interval '1 day' + interval '6 hours'
      end
    ) at time zone timezone
  else null
end
where next_delivery_at_utc is null;
