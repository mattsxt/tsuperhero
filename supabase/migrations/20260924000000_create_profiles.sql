create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  user_type text not null check (user_type in ('commuter', 'transit_personnel')),
  first_name text not null,
  last_name text not null,
  birthdate date not null check (birthdate <= current_date),
  gender text not null check (gender in ('male', 'female', 'prefer_not_to_say')),
  contact_number text not null check (contact_number ~ '^\+63[0-9]{10}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile enable row level security;

create policy "Users can view their own profile"
  on public.profile for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profile for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profile for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
