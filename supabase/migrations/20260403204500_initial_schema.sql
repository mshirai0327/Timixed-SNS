create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null check (char_length(handle) between 3 and 32),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  resolved_display_name text;
begin
  base_handle := regexp_replace(
    lower(split_part(coalesce(new.email, 'drifter@example.com'), '@', 1)),
    '[^a-z0-9_]+',
    '',
    'g'
  );

  if char_length(base_handle) < 3 then
    base_handle := 'drifter';
  end if;

  resolved_display_name := left(
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(new.email, 'drifter@example.com'), '@', 1),
      'drifter'
    ),
    50
  );

  insert into public.users (id, handle, display_name)
  values (
    new.id,
    left(base_handle, 24) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    resolved_display_name
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create table if not exists public.drifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  composed_at timestamptz not null default now(),
  surface_at timestamptz not null,
  resurface_count integer not null default 0 check (resurface_count between 0 and 2),
  next_resurface_at timestamptz,
  deleted_at timestamptz
);

create or replace function public.apply_drift_schedule()
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

drop trigger if exists drifts_apply_schedule on public.drifts;

create trigger drifts_apply_schedule
before insert or update on public.drifts
for each row
execute function public.apply_drift_schedule();

create table if not exists public.follows (
  follower_id uuid not null references public.users (id) on delete cascade,
  following_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.resonances (
  drift_id uuid not null references public.drifts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drift_id, user_id)
);

create index if not exists idx_drifts_surface_at
  on public.drifts (surface_at)
  where deleted_at is null;

create index if not exists idx_drifts_next_resurface
  on public.drifts (next_resurface_at)
  where next_resurface_at is not null and deleted_at is null;

create index if not exists idx_drifts_user_id
  on public.drifts (user_id, composed_at desc)
  where deleted_at is null;

create index if not exists idx_follows_follower
  on public.follows (follower_id);

create index if not exists idx_follows_following
  on public.follows (following_id);

alter table public.users enable row level security;
alter table public.drifts enable row level security;
alter table public.follows enable row level security;
alter table public.resonances enable row level security;

create policy "users are publicly readable"
  on public.users
  for select
  using (true);

create policy "users manage own profile"
  on public.users
  for update
  using (id = auth.uid());

create policy "users can insert own profile"
  on public.users
  for insert
  with check (id = auth.uid());

create policy "floating drifts are visible"
  on public.drifts
  for select
  using (
    deleted_at is null
    and (
      surface_at <= now()
      or user_id = auth.uid()
    )
  );

create policy "users create own drifts"
  on public.drifts
  for insert
  with check (user_id = auth.uid());

create policy "users update own drifts"
  on public.drifts
  for update
  using (user_id = auth.uid());

create policy "follows are readable"
  on public.follows
  for select
  using (true);

create policy "users create follows"
  on public.follows
  for insert
  with check (follower_id = auth.uid());

create policy "users delete follows"
  on public.follows
  for delete
  using (follower_id = auth.uid());

create policy "resonances are readable"
  on public.resonances
  for select
  using (true);

create policy "users create resonances"
  on public.resonances
  for insert
  with check (user_id = auth.uid());

create policy "users delete resonances"
  on public.resonances
  for delete
  using (user_id = auth.uid());

create or replace view public.public_drifts as
select
  id,
  user_id,
  body,
  resurface_count
from public.drifts
where deleted_at is null
  and surface_at <= now();

create or replace function public.get_timeline_entries(
  p_viewer_id uuid,
  p_limit integer default 21,
  p_offset integer default 0,
  p_seed double precision default null
)
returns table (
  id uuid,
  author_id uuid,
  author_handle text,
  author_display_name text,
  author_avatar_url text,
  body text,
  resurface_count integer,
  resonance_count bigint,
  is_resonated boolean,
  is_mine boolean
)
language plpgsql
set search_path = public
as $$
begin
  if p_seed is not null then
    perform setseed(least(greatest(p_seed, -1), 1));
  end if;

  return query
  with visible_drifts as (
    select
      d.id,
      d.user_id,
      d.body,
      d.resurface_count
    from public.drifts d
    where d.deleted_at is null
      and d.surface_at <= now()
      and (
        d.user_id = p_viewer_id
        or exists (
          select 1
          from public.follows f
          where f.follower_id = p_viewer_id
            and f.following_id = d.user_id
        )
      )
  )
  select
    d.id,
    u.id as author_id,
    u.handle as author_handle,
    u.display_name as author_display_name,
    u.avatar_url as author_avatar_url,
    d.body,
    d.resurface_count,
    coalesce(rc.resonance_count, 0)::bigint as resonance_count,
    coalesce(me.is_resonated, false) as is_resonated,
    d.user_id = p_viewer_id as is_mine
  from visible_drifts d
  join public.users u on u.id = d.user_id
  left join lateral (
    select count(*) as resonance_count
    from public.resonances r
    where r.drift_id = d.id
  ) rc on true
  left join lateral (
    select true as is_resonated
    from public.resonances r
    where r.drift_id = d.id
      and r.user_id = p_viewer_id
    limit 1
  ) me on true
  order by random()
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;

grant select, insert, update on public.users to authenticated;
grant select on public.users to anon;
grant select, insert, update on public.drifts to authenticated;
grant select on public.drifts to anon;
grant select, insert, delete on public.follows to authenticated;
grant select on public.follows to anon;
grant select, insert, delete on public.resonances to authenticated;
grant select on public.resonances to anon;
grant select on public.public_drifts to authenticated, anon;
grant execute on function public.get_timeline_entries(uuid, integer, integer, double precision) to authenticated;
