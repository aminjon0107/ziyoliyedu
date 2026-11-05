-- AIEdu database schema. Run in Supabase Dashboard -> SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student','teacher','admin','moderator')),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  subject text not null default '',
  level text not null default 'Barcha darajalar',
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(student_id, course_id)
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  score numeric(5,2) not null default 0,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('click','payme')),
  amount_uzs bigint not null check (amount_uzs > 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded','failed')),
  provider_transaction_id text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.quiz_results enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "published courses public" on public.courses;
create policy "published courses public" on public.courses for select to anon, authenticated using (published = true);
drop policy if exists "enrollments own" on public.enrollments;
create policy "enrollments own" on public.enrollments for select to authenticated using (auth.uid() = student_id);
drop policy if exists "quiz results own" on public.quiz_results;
create policy "quiz results own" on public.quiz_results for select to authenticated using (auth.uid() = student_id);
drop policy if exists "payments own" on public.payments;
create policy "payments own" on public.payments for select to authenticated using (auth.uid() = user_id);

-- After creating your own account, promote it to Super Admin using the exact email:
-- update public.profiles p set role = 'admin'
-- from auth.users u where p.id = u.id and lower(u.email) = lower('YOUR_EMAIL_HERE');
