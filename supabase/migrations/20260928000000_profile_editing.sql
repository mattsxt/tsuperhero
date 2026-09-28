alter table public.profile rename column birthdate to birth_date;

alter table public.profile add column profile_picture text;

create function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.first_name is distinct from old.first_name
    or new.last_name is distinct from old.last_name then
    raise exception 'First name and last name cannot be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profile
  for each row execute function public.guard_profile_update();

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true);

create policy "Users can view their own profile pictures"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own profile pictures"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own profile pictures"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
