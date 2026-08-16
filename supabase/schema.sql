-- FOOTPRINT
-- FINAL SUPABASE SCHEMA

create extension if not exists pgcrypto;


-- PROFILES

-- One profile for each Supabase Auth user.
--
-- full_name:
--   Name supplied when the Footprint account is created.
--
-- verified_name:
--   Name extracted/confirmed through documentary verification.
--
-- name_verification_status:
--   unverified
--   verified
--   failed
--
-- role:
--   member
--   admin

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  full_name text,

  verified_name text,

  name_verification_status text
    not null
    default 'unverified'
    check (
      name_verification_status in (
        'unverified',
        'verified',
        'failed'
      )
    ),

  name_verification_method text,

  name_verified_at timestamptz,

  role text
    not null
    default 'member'
    check (
      role in (
        'member',
        'admin'
      )
    ),

  created_at timestamptz
    not null
    default now()
);


-- SCANS

create table if not exists public.scans (
  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  status text
    not null
    default 'running'
    check (
      status in (
        'running',
        'completed',
        'failed'
      )
    ),

  /*
   * Stores the identifiers submitted for the scan.
   * Example:
   *
   * {
   *   "fullName": "...",
   *   "emails": ["..."],
   *   "phone": "..."
   * }
   */
  identifiers jsonb
    not null
    default '{}'::jsonb,

  consent_given_at timestamptz
    not null,

  created_at timestamptz
    not null
    default now(),

  completed_at timestamptz,

  error_message text
);


-- FINDINGS


create table if not exists public.findings (
  id uuid
    primary key
    default gen_random_uuid(),

  scan_id uuid
    not null
    references public.scans(id)
    on delete cascade,

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  url text
    not null,

  domain text
    not null,

  title text,

  summary text
    not null,

  matched_identifiers jsonb
    not null
    default '[]'::jsonb,

  source_category text
    not null,

  source_mode text
    not null,

  dpc numeric
    not null,

  ei numeric
    not null,

  cb numeric
    not null,

  severity_score numeric
    not null,

  risk_level text
    not null
    check (
      risk_level in (
        'Low',
        'Medium',
        'High',
        'Very High'
      )
    ),

  risk_reason text
    not null,

  score_explanation text
    not null,

  recommended_action text
    not null,

  ownership_status text
    not null
    default 'needs_review'
    check (
      ownership_status in (
        'verified',
        'needs_review',
        'rejected'
      )
    ),

  created_at timestamptz
    not null
    default now()
);


-- POST-SCAN ADMIN REVIEWS

-- Used when a finding has already been discovered but
-- ownership cannot be automatically established.

-- Example:
-- reference-photo candidate + verified identifier
-- → finding created
-- → ownership_status = needs_review
-- → admin review


create table if not exists public.admin_reviews (
  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  finding_id uuid
    not null
    references public.findings(id)
    on delete cascade,

  reason text
    not null,

  status text
    not null
    default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'more_confirmation'
      )
    ),

  admin_note text,

  created_at timestamptz
    not null
    default now(),

  reviewed_at timestamptz
);


-- PRE-SEARCH IDENTITY REVIEWS

-- Used BEFORE any public-web search occurs.
--
-- Example:
-- documentary-verified name: Bhanusree Sajith Kumar
-- submitted search name: Nikita Jose
-- → scan blocked
-- → no Brave / Lens search
-- → identity-review record created

create table if not exists public.identity_reviews (
  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  submitted_name text
    not null,

  verified_name text
    not null,

  match_type text,

  reason text
    not null,

  status text
    not null
    default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'rejected'
      )
    ),

  search_performed boolean
    not null
    default false,

  admin_note text,

  created_at timestamptz
    not null
    default now(),

  reviewed_at timestamptz
);


-- REMOVAL REQUESTS


create table if not exists public.removal_requests (
  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  finding_id uuid
    not null
    references public.findings(id)
    on delete cascade,

  target_domain text
    not null,

  subject text
    not null,

  draft_body text
    not null,

  status text
    not null
    default 'draft'
    check (
      status in (
        'draft',
        'sent',
        'acknowledged',
        'removed',
        'rejected'
      )
    ),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


-- AUTOMATIC updated_at


create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists
  set_removal_requests_updated_at
on public.removal_requests;


create trigger set_removal_requests_updated_at
before update
on public.removal_requests
for each row
execute procedure public.set_updated_at();


-- ROW LEVEL SECURITY


alter table public.profiles
  enable row level security;

alter table public.scans
  enable row level security;

alter table public.findings
  enable row level security;

alter table public.admin_reviews
  enable row level security;

alter table public.identity_reviews
  enable row level security;

alter table public.removal_requests
  enable row level security;



-- Profiles

drop policy if exists
  "profiles own read"
on public.profiles;

create policy "profiles own read"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
);


-- Scans

drop policy if exists
  "scans own read"
on public.scans;

create policy "scans own read"
on public.scans
for select
to authenticated
using (
  auth.uid() = user_id
);


-- Findings

drop policy if exists
  "findings own read"
on public.findings;

create policy "findings own read"
on public.findings
for select
to authenticated
using (
  auth.uid() = user_id
);


-- Identity-review results

--
-- Users may see their OWN identity-review result.
-- They cannot approve/reject it through this policy because
-- no UPDATE policy is provided.


drop policy if exists
  "identity reviews own read"
on public.identity_reviews;

create policy "identity reviews own read"
on public.identity_reviews
for select
to authenticated
using (
  auth.uid() = user_id
);


-- Removal requests


drop policy if exists
  "removals own read"
on public.removal_requests;

create policy "removals own read"
on public.removal_requests
for select
to authenticated
using (
  auth.uid() = user_id
);


/*
 * No normal-user policy is created for admin_reviews.
 *
 * Administrative operations are handled by the
 * Express backend using the Supabase server-side
 * administrative client and requireAdmin middleware.
 */


-- STORAGE BUCKET:
-- REFERENCE PHOTOS

-- Private temporary bucket used for image-search reference
-- photographs.
-- Backend deletes the photograph after image processing.


insert into storage.buckets (
  id,
  name,
  public
)
values (
  'scan-images',
  'scan-images',
  false
)
on conflict (id)
do update
set public = false;



-- Reference-photo upload

drop policy if exists
  "users upload own temporary scan images"
on storage.objects;

create policy
  "users upload own temporary scan images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'scan-images'
  and
  (storage.foldername(name))[1]
    = auth.uid()::text
);


-- Reference-photo read


drop policy if exists
  "users read own temporary scan images"
on storage.objects;

create policy
  "users read own temporary scan images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'scan-images'
  and
  (storage.foldername(name))[1]
    = auth.uid()::text
);


-- Reference-photo delete


drop policy if exists
  "users delete own temporary scan images"
on storage.objects;

create policy
  "users delete own temporary scan images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'scan-images'
  and
  (storage.foldername(name))[1]
    = auth.uid()::text
);


-- STORAGE BUCKET:
-- DOCUMENTARY NAME VERIFICATION


-- Private temporary bucket for government-ID images.
-- The image is used for documentary name matching and
-- deleted after processing.

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'name-verification-docs',
  'name-verification-docs',
  false
)
on conflict (id)
do update
set public = false;


-- ID-document upload


drop policy if exists
  "users upload own name verification documents"
on storage.objects;

create policy
  "users upload own name verification documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'name-verification-docs'
  and
  (storage.foldername(name))[1]
    = auth.uid()::text
);



-- ID-document read

drop policy if exists
  "users read own name verification documents"
on storage.objects;

create policy
  "users read own name verification documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'name-verification-docs'
  and
  (storage.foldername(name))[1]
    = auth.uid()::text
);


-- ID-document delete


drop policy if exists
  "users delete own name verification documents"
on storage.objects;

create policy
  "users delete own name verification documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'name-verification-docs'
  and
  (storage.foldername(name))[1]
    = auth.uid()::text
);


-- NEW USER PROFILE TRIGGER

-- When a Supabase Auth account is created, automatically
-- create its corresponding Footprint profile.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  insert into public.profiles (
    id,
    full_name
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name'
  );

  return new;

end;
$$;


drop trigger if exists
  on_auth_user_created
on auth.users;


create trigger on_auth_user_created
after insert
on auth.users
for each row
execute procedure public.handle_new_user();


-- USEFUL INDEXES


create index if not exists
  scans_user_id_idx
on public.scans(user_id);


create index if not exists
  findings_scan_id_idx
on public.findings(scan_id);


create index if not exists
  findings_user_id_idx
on public.findings(user_id);


create index if not exists
  findings_risk_level_idx
on public.findings(risk_level);


create index if not exists
  admin_reviews_status_idx
on public.admin_reviews(status);


create index if not exists
  admin_reviews_finding_id_idx
on public.admin_reviews(finding_id);


create index if not exists
  identity_reviews_user_id_idx
on public.identity_reviews(user_id);


create index if not exists
  identity_reviews_status_idx
on public.identity_reviews(status);


create index if not exists
  removal_requests_user_id_idx
on public.removal_requests(user_id);


create index if not exists
  removal_requests_finding_id_idx
on public.removal_requests(finding_id);