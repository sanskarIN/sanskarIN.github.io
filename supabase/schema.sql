-- =============================================================================
--  Accounts for the blog on sanskarIN.github.io — Supabase database setup
--
--  The "Set up accounts" workflow runs it on your Supabase project, and again
--  whenever it changes on main. By hand: Dashboard → SQL Editor → New query →
--  paste this whole file → Run. Running it again is safe.
--  README.md → "Accounts" explains the complete setup.
--
--  It creates:
--    public.profiles     one public author profile per account
--    public.submissions  the posts each account has sent for review (private)
--    blog-images         a storage bucket for images in posts
--                        (images only, 10 MB each, 200 per account)
--
--  Email addresses stay in Supabase Auth (auth.users) and are never copied
--  into these tables or published.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Shared helper: keeps updated_at current
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Site admins: the email addresses whose accounts may use the site owner's
-- usernames (see "The site owner's usernames" below). The "Set up accounts"
-- workflow fills it in from the ADMIN_EMAIL secret. Nobody can read or change
-- it through the website or the API.
-- -----------------------------------------------------------------------------

create table if not exists public.site_admins (
  email text primary key,
  constraint site_admins_email_format check (email = lower(btrim(email)) and email like '%_@_%')
);

alter table public.site_admins enable row level security;
revoke all on table public.site_admins from anon, authenticated;


-- -----------------------------------------------------------------------------
-- Profiles: public, one per account
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Used in the profile's address (/blog/authors/?u=username); can't change.
  username text not null unique,
  display_name text not null,
  bio text not null default '',
  website text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_format check (
    username ~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$' and username !~ '--'
  ),
  constraint profiles_display_name_format check (
    char_length(btrim(display_name)) between 1 and 60
    and display_name !~ '[<>[:cntrl:]]'
  ),
  constraint profiles_bio_format check (
    char_length(bio) <= 300 and bio !~ '[<>[:cntrl:]]'
  ),
  constraint profiles_website_format check (
    website = ''
    or (char_length(website) <= 200 and website ~ '^https://[^[:space:]<>"''`]+$')
  )
);

-- Usernames nobody can take. Set here rather than in the table above, so that
-- running this file again updates the list. The site owner's own usernames
-- are below: only a site admin can take them.
alter table public.profiles drop constraint if exists profiles_username_reserved;
alter table public.profiles add constraint profiles_username_reserved check (
  username not in (
    'about', 'account', 'accounts', 'admin', 'administrator', 'api', 'blog',
    'contact', 'help', 'mail', 'moderator', 'null', 'owner', 'privacy', 'root',
    'security', 'staff', 'support', 'system', 'terms', 'undefined', 'www'
  )
);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "People create their own profile" on public.profiles;
create policy "People create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "People update their own profile" on public.profiles;
create policy "People update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The site owner's usernames: only an account whose email address is in
-- public.site_admins may take one, so nobody else can pose as the owner.
-- Keep in line with owner_username in _data/accounts.yml.
create or replace function public.check_owner_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username in ('sanskar', 'sanskarin', 'dev-sanskarin') and not exists (
    select 1
    from auth.users as account
    join public.site_admins as admin on admin.email = lower(account.email)
    where account.id = new.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'new row for relation "profiles" violates check constraint "profiles_username_reserved"',
      constraint = 'profiles_username_reserved';
  end if;
  return new;
end;
$$;

revoke all on function public.check_owner_username() from public, anon, authenticated;

drop trigger if exists profiles_owner_username on public.profiles;
create trigger profiles_owner_username
  before insert or update of username on public.profiles
  for each row execute function public.check_owner_username();

-- Explicit grants: anyone may read profiles; signed-in people may create
-- their own and change everything but the username.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert (id, username, display_name, bio, website) on table public.profiles to authenticated;
grant update (display_name, bio, website) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;


-- -----------------------------------------------------------------------------
-- Submissions: posts sent for review. Written only by the "blog" Edge
-- Function (which checks them and opens the GitHub issue); each person can
-- read their own.
-- -----------------------------------------------------------------------------

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  summary text not null default '',
  tags text[] not null default '{}',
  cover_url text not null default '',
  cover_alt text not null default '',
  body text not null,
  issue_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_user_created
  on public.submissions (user_id, created_at desc);

drop trigger if exists submissions_touch_updated_at on public.submissions;
create trigger submissions_touch_updated_at
  before update on public.submissions
  for each row execute function public.touch_updated_at();

alter table public.submissions enable row level security;

drop policy if exists "People read their own submissions" on public.submissions;
create policy "People read their own submissions"
  on public.submissions for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.submissions from anon, authenticated;
grant select on table public.submissions to authenticated;
grant select, insert, update, delete on table public.submissions to service_role;


-- -----------------------------------------------------------------------------
-- Images: a public bucket, so the publishing workflow can copy the images of
-- approved posts to the website. Files get random names; each person can
-- upload only to their own folder (named after their account id).
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images', 'blog-images', true, 10485760,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- How many images the signed-in person has uploaded (for the limit below).
create or replace function public.my_blog_image_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from storage.objects
  where bucket_id = 'blog-images'
    and name like (select auth.uid())::text || '/%';
$$;

revoke all on function public.my_blog_image_count() from public, anon;
grant execute on function public.my_blog_image_count() to authenticated;

drop policy if exists "People upload blog images to their own folder" on storage.objects;
create policy "People upload blog images to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.my_blog_image_count() < 200
  );

drop policy if exists "People see their own blog images" on storage.objects;
create policy "People see their own blog images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "People delete their own blog images" on storage.objects;
create policy "People delete their own blog images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
