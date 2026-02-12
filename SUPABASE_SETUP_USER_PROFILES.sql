-- MoneyMart 2.0 - user profiles
-- Run in Supabase SQL editor.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  nickname text not null default '',
  phone text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at_user_profiles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at_user_profiles();

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_owner_select" on public.user_profiles;
create policy "user_profiles_owner_select"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_profiles_owner_insert" on public.user_profiles;
create policy "user_profiles_owner_insert"
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_profiles_owner_update" on public.user_profiles;
create policy "user_profiles_owner_update"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_profiles_admin_manage" on public.user_profiles;
create policy "user_profiles_admin_manage"
on public.user_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

-- Auto-provision profile from auth metadata for email-confirmation flows.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, full_name, nickname, phone, marketing_opt_in)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    nickname = excluded.nickname,
    phone = excluded.phone,
    marketing_opt_in = excluded.marketing_opt_in;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();
