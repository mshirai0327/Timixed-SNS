create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text not null,
  handle citext unique not null check (char_length(handle::text) between 3 and 32),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists drifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  composed_at timestamptz not null default now(),
  surface_at timestamptz not null,
  resurface_count integer not null default 0 check (resurface_count between 0 and 2),
  next_resurface_at timestamptz,
  deleted_at timestamptz
);

create or replace function apply_drift_schedule()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.composed_at := coalesce(new.composed_at, now());
    new.surface_at := new.composed_at + (random() * interval '7 days');

    if new.resurface_count >= 2 then
      new.next_resurface_at := null;
    else
      new.next_resurface_at := new.surface_at + interval '7 days' + (random() * interval '3 days');
    end if;
  elsif new.resurface_count >= 2 then
    new.next_resurface_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists drifts_apply_schedule on drifts;

create trigger drifts_apply_schedule
before insert or update on drifts
for each row
execute function apply_drift_schedule();

create table if not exists follows (
  follower_id uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists resonances (
  drift_id uuid not null references drifts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drift_id, user_id)
);

create index if not exists idx_users_handle on users(handle);
create index if not exists idx_drifts_surface_at on drifts(surface_at) where deleted_at is null;
create index if not exists idx_drifts_next_resurface on drifts(next_resurface_at)
  where next_resurface_at is not null and deleted_at is null;
create index if not exists idx_drifts_user_id on drifts(user_id, composed_at desc)
  where deleted_at is null;
create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_following on follows(following_id);

create or replace view public_drifts as
select
  d.id,
  d.user_id,
  d.body,
  d.resurface_count
from drifts d
where d.deleted_at is null
  and d.surface_at <= now();
