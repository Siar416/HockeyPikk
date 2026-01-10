create extension if not exists "pgcrypto";

do $$
begin
  create type public.board_status as enum ('draft', 'locked');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.suggestion_status as enum ('pending', 'accepted', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.friend_request_status as enum ('pending', 'accepted', 'declined');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  handle text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  board_date date not null,
  status public.board_status not null default 'draft',
  lock_at timestamptz,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  unique (created_by, board_date)
);

create table if not exists public.board_groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create index if not exists board_groups_board_id_sort_order_idx
  on public.board_groups (board_id, sort_order);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards on delete cascade,
  board_group_id uuid not null references public.board_groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  nhl_player_id integer,
  player_name text not null,
  team_code text not null,
  team_name text not null,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (board_group_id, user_id)
);

alter table public.picks
  add column if not exists nhl_player_id integer;

create index if not exists picks_board_user_idx
  on public.picks (board_id, user_id);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards on delete cascade,
  board_group_id uuid not null references public.board_groups on delete cascade,
  suggested_by uuid not null references auth.users on delete cascade,
  nhl_player_id integer,
  player_name text not null,
  team_code text not null,
  team_name text not null,
  reason text,
  status public.suggestion_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.suggestions
  add column if not exists nhl_player_id integer;

create index if not exists suggestions_board_idx
  on public.suggestions (board_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_board_idx
  on public.comments (board_id);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);

create index if not exists friend_requests_recipient_idx
  on public.friend_requests (recipient_id, status);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  friend_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists friends_user_id_idx
  on public.friends (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Player')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_groups enable row level security;
alter table public.picks enable row level security;
alter table public.suggestions enable row level security;
alter table public.comments enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;

drop policy if exists "Profiles read own" on public.profiles;
create policy "Profiles read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Boards read own" on public.boards;
create policy "Boards read own"
  on public.boards for select
  using (auth.uid() = created_by);

drop policy if exists "Boards insert own" on public.boards;
create policy "Boards insert own"
  on public.boards for insert
  with check (auth.uid() = created_by);

drop policy if exists "Boards update own" on public.boards;
create policy "Boards update own"
  on public.boards for update
  using (auth.uid() = created_by);

drop policy if exists "Boards delete own" on public.boards;
create policy "Boards delete own"
  on public.boards for delete
  using (auth.uid() = created_by);

drop policy if exists "Groups read own boards" on public.board_groups;
create policy "Groups read own boards"
  on public.board_groups for select
  using (
    exists (
      select 1
      from public.boards
      where boards.id = board_groups.board_id
        and boards.created_by = auth.uid()
    )
  );

drop policy if exists "Groups insert own boards" on public.board_groups;
create policy "Groups insert own boards"
  on public.board_groups for insert
  with check (
    exists (
      select 1
      from public.boards
      where boards.id = board_groups.board_id
        and boards.created_by = auth.uid()
    )
  );

drop policy if exists "Groups update own boards" on public.board_groups;
create policy "Groups update own boards"
  on public.board_groups for update
  using (
    exists (
      select 1
      from public.boards
      where boards.id = board_groups.board_id
        and boards.created_by = auth.uid()
    )
  );

drop policy if exists "Groups delete own boards" on public.board_groups;
create policy "Groups delete own boards"
  on public.board_groups for delete
  using (
    exists (
      select 1
      from public.boards
      where boards.id = board_groups.board_id
        and boards.created_by = auth.uid()
    )
  );

drop policy if exists "Picks read own" on public.picks;
create policy "Picks read own"
  on public.picks for select
  using (auth.uid() = user_id);

drop policy if exists "Picks insert own" on public.picks;
create policy "Picks insert own"
  on public.picks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Picks update own" on public.picks;
create policy "Picks update own"
  on public.picks for update
  using (auth.uid() = user_id);

drop policy if exists "Picks delete own" on public.picks;
create policy "Picks delete own"
  on public.picks for delete
  using (auth.uid() = user_id);

drop policy if exists "Suggestions read board" on public.suggestions;
create policy "Suggestions read board"
  on public.suggestions for select
  using (
    auth.uid() = suggested_by
    or exists (
      select 1
      from public.boards
      where boards.id = suggestions.board_id
        and boards.created_by = auth.uid()
    )
  );

drop policy if exists "Suggestions insert own" on public.suggestions;
create policy "Suggestions insert own"
  on public.suggestions for insert
  with check (auth.uid() = suggested_by);

drop policy if exists "Suggestions update own or owner" on public.suggestions;
create policy "Suggestions update own or owner"
  on public.suggestions for update
  using (
    auth.uid() = suggested_by
    or exists (
      select 1
      from public.boards
      where boards.id = suggestions.board_id
        and boards.created_by = auth.uid()
    )
  );

drop policy if exists "Suggestions delete own" on public.suggestions;
create policy "Suggestions delete own"
  on public.suggestions for delete
  using (auth.uid() = suggested_by);

drop policy if exists "Comments read board" on public.comments;
create policy "Comments read board"
  on public.comments for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.boards
      where boards.id = comments.board_id
        and boards.created_by = auth.uid()
    )
  );

drop policy if exists "Comments insert own" on public.comments;
create policy "Comments insert own"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Comments update own" on public.comments;
create policy "Comments update own"
  on public.comments for update
  using (auth.uid() = user_id);

drop policy if exists "Comments delete own" on public.comments;
create policy "Comments delete own"
  on public.comments for delete
  using (auth.uid() = user_id);

drop policy if exists "Friend requests read own" on public.friend_requests;
create policy "Friend requests read own"
  on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Friend requests insert own" on public.friend_requests;
create policy "Friend requests insert own"
  on public.friend_requests for insert
  with check (auth.uid() = sender_id);

drop policy if exists "Friend requests update own" on public.friend_requests;
create policy "Friend requests update own"
  on public.friend_requests for update
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Friend requests delete own" on public.friend_requests;
create policy "Friend requests delete own"
  on public.friend_requests for delete
  using (auth.uid() = sender_id);

drop policy if exists "Friends read own" on public.friends;
create policy "Friends read own"
  on public.friends for select
  using (auth.uid() = user_id);

drop policy if exists "Friends insert own" on public.friends;
create policy "Friends insert own"
  on public.friends for insert
  with check (auth.uid() = user_id);

drop policy if exists "Friends delete own" on public.friends;
create policy "Friends delete own"
  on public.friends for delete
  using (auth.uid() = user_id);
