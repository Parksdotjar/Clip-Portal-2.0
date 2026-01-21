-- Clip Portal schema and security policies
-- Enable uuid generation
create extension if not exists "pgcrypto";

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  tags text[] default '{}',
  storage_path text not null,
  public_url text,
  created_at timestamptz default now()
);

alter table public.clips enable row level security;

-- Public read for discovery
create policy "clips_public_read" on public.clips
  for select
  using (true);

-- Authenticated users can insert their own clips
create policy "clips_authenticated_insert" on public.clips
  for insert to authenticated
  with check (auth.uid() = owner_id);

-- Owners can update or delete their clips
create policy "clips_owner_update" on public.clips
  for update
  using (auth.uid() = owner_id);

create policy "clips_owner_delete" on public.clips
  for delete
  using (auth.uid() = owner_id);

-- Storage bucket (public)
insert into storage.buckets (id, name, public)
values ('clips', 'clips', true)
on conflict (id) do nothing;

-- Storage object policies
alter table storage.objects enable row level security;

create policy "clips_public_read" on storage.objects
  for select
  using (bucket_id = 'clips');

create policy "clips_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clips'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "clips_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'clips'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- Storage path format: {user_id}/{clip_id}.mp4