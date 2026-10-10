begin;

alter table public.vehicle
  add column if not exists is_full boolean not null default false;

update public.vehicle
set is_full = coalesce(current_capacity, 0) >= max_capacity
where vehicle_status in ('on-trip', 'loading');

create or replace function public.set_my_vehicle_trip_state(
  p_status public.vehicle_status,
  p_current_capacity integer,
  p_is_full boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target uuid := public.my_assigned_vehicle_id();
  capacity integer;
begin
  if target is null then
    raise exception 'You are not assigned to a vehicle.' using errcode = '42501';
  end if;

  select max_capacity
  into capacity
  from public.vehicle
  where vehicle_id = target;

  if p_current_capacity < 0 or p_current_capacity > capacity then
    raise exception 'Passenger count must be between 0 and %.', capacity
      using errcode = '22023';
  end if;

  update public.vehicle
  set vehicle_status = p_status,
      current_capacity = p_current_capacity,
      is_full = case
        when p_status in ('idle', 'offline') then false
        else p_is_full or p_current_capacity >= capacity
      end
  where vehicle_id = target;

  if p_status in ('idle', 'offline') then
    delete from public.location_records where vehicle_id = target;
    update public.trip
    set trip_status = 'completed', arrival_time = coalesce(arrival_time, now())
    where vehicle_id = target and trip_status = 'active';
    perform public.release_vehicle_pickups(target);
  end if;
end;
$function$;

revoke all on function public.set_my_vehicle_trip_state(
  public.vehicle_status, integer, boolean
) from public, anon;
grant execute on function public.set_my_vehicle_trip_state(
  public.vehicle_status, integer, boolean
) to authenticated;

create or replace function public.get_live_vehicles_with_full()
returns table(
  vehicle_id uuid,
  vehicle_type public.vehicle_type,
  plate_number text,
  vehicle_status public.vehicle_status,
  max_capacity integer,
  current_capacity integer,
  latitude double precision,
  longitude double precision,
  route_id uuid,
  route_name text,
  is_full boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    vehicle.vehicle_id,
    vehicle.vehicle_type,
    vehicle.plate_number,
    vehicle.vehicle_status,
    vehicle.max_capacity,
    coalesce(vehicle.current_capacity, 0),
    location.records_latitude,
    location.records_longitude,
    route.route_id,
    route.route_name,
    coalesce(vehicle.is_full, false)
  from public.location_records as location
  join public.vehicle as vehicle on vehicle.vehicle_id = location.vehicle_id
  left join lateral (
    select coalesce(
      (
        select trip.route_id
        from public.trip as trip
        where trip.vehicle_id = vehicle.vehicle_id and trip.trip_status = 'active'
        order by trip.departure_time desc
        limit 1
      ),
      vehicle.route_id
    ) as route_id
  ) as running on true
  left join public.route as route on route.route_id = running.route_id
  where vehicle.vehicle_status in ('on-trip', 'loading')
    and location.recorded_at > now() - interval '1 minute';
$function$;

grant execute on function public.get_live_vehicles_with_full()
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
