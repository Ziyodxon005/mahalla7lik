-- Enable PostGIS if needed for advanced geo queries, but for now simple lat/lng floats are enough.

-- 1. Profiles Table (Extends default auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  phone text,
  role text default 'user' check (role in ('user', 'rais', 'yoshlar_yetakchisi', 'ijtimoiy_xodim', 'inspektor', 'hokim_yordamchisi', 'soliq_inspektori', 'ayollar_faoli', 'super_admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- 2. Murojaatlar (Requests) Table
create table public.murojaatlar (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  target_role text not null,
  title text not null,
  description text,
  lat float,
  lng float,
  image_url text, -- Telegra.ph URL
  status text default 'pending' check (status in ('pending', 'progress', 'done', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.murojaatlar enable row level security;

-- Policies for Murojaatlar
-- Users can see their own requests
create policy "Users can view own requests" on murojaatlar for select using (auth.uid() = user_id);
-- Officials can see requests targeted to them
create policy "Officials can view targeted requests" on murojaatlar for select using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and (profiles.role = murojaatlar.target_role or profiles.role = 'super_admin')
  )
);
-- Users can insert requests
create policy "Users can create requests" on murojaatlar for insert with check (auth.uid() = user_id);
-- Officials can update status of requests targeted to them
create policy "Officials can update status" on murojaatlar for update using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and (profiles.role = murojaatlar.target_role or profiles.role = 'super_admin')
  )
);

-- 3. Messages Table (Chat)
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  murojaat_id uuid references public.murojaatlar(id) not null,
  sender_id uuid references public.profiles(id) not null,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies for Messages
create policy "Users can view messages for their requests" on messages for select using (
  exists (
    select 1 from murojaatlar
    where murojaatlar.id = messages.murojaat_id
    and (murojaatlar.user_id = auth.uid() 
         or exists (
           select 1 from profiles
           where profiles.id = auth.uid()
           and (profiles.role = murojaatlar.target_role or profiles.role = 'super_admin')
         )
    )
  )
);

create policy "Users can insert messages for their requests" on messages for insert with check (
   exists (
    select 1 from murojaatlar
    where murojaatlar.id = messages.murojaat_id
    and (murojaatlar.user_id = auth.uid() 
         or exists (
           select 1 from profiles
           where profiles.id = auth.uid()
           and (profiles.role = murojaatlar.target_role or profiles.role = 'super_admin')
         )
    )
  )
);

-- Set up Storage for consistency (optional if using Telegra.ph, but good to have)
-- (Skipping Storage setup as we strictly use Telegra.ph per request)
