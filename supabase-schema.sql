-- ─────────────────────────────────────────────────────────────
-- WebHunter v3 — Schema Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ─────────────────────────────────────────────────────────────

-- PROSPECTS
create table if not exists prospects (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  place_id      text not null,
  name          text not null,
  address       text,
  city          text,
  phone         text,
  website       text,
  google_maps_url text,
  rating        numeric(3,1),
  review_count  integer,
  category      text,
  web_status    text check (web_status in ('no_web','fake_web','poor_web','has_web')) default 'no_web',
  audit_score   integer,
  audit_summary text,
  audit_pitch   text,
  stage         text check (stage in ('encontrado','contactado','respondio','demo','cerrado','descartado')) default 'encontrado',
  notes         text,
  followup_date date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(user_id, place_id)
);

-- ACTIVITIES
create table if not exists activities (
  id           uuid default gen_random_uuid() primary key,
  prospect_id  uuid references prospects(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  type         text not null,
  content      text,
  created_at   timestamptz default now()
);

-- TEMPLATES
create table if not exists templates (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  sector     text,
  subject    text not null,
  body       text not null,
  created_at timestamptz default now()
);

-- CREDITS
create table if not exists credits (
  user_id         uuid references auth.users(id) on delete cascade primary key,
  plan            text check (plan in ('free','pro')) default 'free',
  searches_used   integer default 0,
  searches_limit  integer default 20,
  audits_used     integer default 0,
  audits_limit    integer default 5,
  reset_date      date default (now() + interval '30 days')
);

-- ─── RLS (Row Level Security) ─────────────────────────────────
alter table prospects  enable row level security;
alter table activities enable row level security;
alter table templates  enable row level security;
alter table credits    enable row level security;

-- Cada usuario solo ve y edita sus propios datos
create policy "prospects_own" on prospects  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "activities_own" on activities using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "templates_own" on templates  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "credits_own"   on credits    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Auto-crear credits al registrarse ───────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into credits (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Auto-updated_at en prospects ────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prospects_updated_at
  before update on prospects
  for each row execute procedure update_updated_at();
