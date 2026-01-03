-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Sites Table
create table if not exists sites (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  url text not null,
  status text default 'idle', -- idle, crawling, error
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Reports Table
create table if not exists reports (
  id uuid default uuid_generate_v4() primary key,
  site_id uuid references sites(id) on delete cascade not null,
  scanned_count int default 0,
  broken_links jsonb default '[]',
  created_at timestamp with time zone default now()
);

-- RLS Policies (Security)
alter table sites enable row level security;
alter table reports enable row level security;

-- Sites Policies
create policy "Users can view their own sites" on sites
  for select using (auth.uid() = user_id);

create policy "Users can insert their own sites" on sites
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own sites" on sites
  for update using (auth.uid() = user_id);

create policy "Users can delete their own sites" on sites
  for delete using (auth.uid() = user_id);

-- Reports Policies
create policy "Users can view reports for their sites" on reports
  for select using (
    exists (select 1 from sites where sites.id = reports.site_id and sites.user_id = auth.uid())
  );
