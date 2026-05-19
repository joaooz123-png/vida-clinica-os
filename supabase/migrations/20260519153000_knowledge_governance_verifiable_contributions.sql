-- Knowledge governance: verifiable contributions and master audit flow

alter table public.knowledge_articles
  add column if not exists evidence_level text default 'unrated',
  add column if not exists evidence_grade text,
  add column if not exists evidence_summary text,
  add column if not exists sources jsonb default '[]'::jsonb,
  add column if not exists reviewer_notes text,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists contribution_origin text default 'seed';

do $$
declare
  r record;
begin
  for r in
    select conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'knowledge_articles'
      and c.contype = 'c'
      and (
        pg_get_constraintdef(c.oid) ilike '%status%'
        or pg_get_constraintdef(c.oid) ilike '%visibility%'
        or pg_get_constraintdef(c.oid) ilike '%evidence_level%'
      )
  loop
    execute format('alter table public.knowledge_articles drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.knowledge_articles
  add constraint knowledge_articles_status_check
    check (status in ('draft','pending_review','needs_revision','published','rejected','archived')),
  add constraint knowledge_articles_visibility_check
    check (visibility in ('public','authenticated','admin')),
  add constraint knowledge_articles_evidence_level_check
    check (evidence_level in ('unrated','case_experience','expert_consensus','observational_study','randomized_trial','guideline','systematic_review','meta_analysis','regulatory_source','other'));

create or replace function public.is_verified_knowledge_contributor(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.has_role(_user_id, 'admin')
    or public.has_role(_user_id, 'moderator')
    or public.is_ultimate_user(_user_id)
    or exists (
      select 1
      from public.profiles p
      where p.user_id = _user_id
        and p.verification_tier is not null
    )
    or exists (
      select 1
      from public.verification_requests vr
      where vr.user_id = _user_id
        and vr.status = 'approved'
    ),
    false
  );
$$;

create or replace function public.is_high_evidence_knowledge(_sources jsonb, _evidence_level text)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    _evidence_level in ('guideline','systematic_review','meta_analysis','randomized_trial','regulatory_source')
    and jsonb_typeof(_sources) = 'array'
    and jsonb_array_length(_sources) > 0,
    false
  );
$$;

create table if not exists public.knowledge_article_submissions (
  id uuid primary key default gen_random_uuid(),
  target_article_id uuid references public.knowledge_articles(id) on delete set null,
  submission_type text not null default 'new_article',
  title text not null,
  slug text,
  category text not null default 'general',
  summary text,
  content text not null,
  tags text[] not null default '{}',
  source_url text,
  visibility text not null default 'public',
  evidence_level text not null default 'unrated',
  evidence_grade text,
  evidence_summary text,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'submitted',
  contributor_id uuid not null references auth.users(id),
  reviewer_id uuid references auth.users(id),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_article_submissions_type_check
    check (submission_type in ('new_article','expansion','correction','revision')),
  constraint knowledge_article_submissions_status_check
    check (status in ('draft','submitted','auto_verified','approved','needs_revision','rejected','archived')),
  constraint knowledge_article_submissions_visibility_check
    check (visibility in ('public','authenticated','admin')),
  constraint knowledge_article_submissions_evidence_level_check
    check (evidence_level in ('unrated','case_experience','expert_consensus','observational_study','randomized_trial','guideline','systematic_review','meta_analysis','regulatory_source','other'))
);

create index if not exists knowledge_article_submissions_target_idx on public.knowledge_article_submissions(target_article_id);
create index if not exists knowledge_article_submissions_contributor_idx on public.knowledge_article_submissions(contributor_id);
create index if not exists knowledge_article_submissions_status_idx on public.knowledge_article_submissions(status);

alter table public.knowledge_article_submissions enable row level security;

drop policy if exists "Knowledge contributors can insert submissions" on public.knowledge_article_submissions;
create policy "Knowledge contributors can insert submissions"
  on public.knowledge_article_submissions
  for insert
  to authenticated
  with check (
    auth.uid() = contributor_id
    and public.is_verified_knowledge_contributor(auth.uid())
  );

drop policy if exists "Contributors can view own submissions" on public.knowledge_article_submissions;
create policy "Contributors can view own submissions"
  on public.knowledge_article_submissions
  for select
  to authenticated
  using (auth.uid() = contributor_id);

drop policy if exists "Auditors can view all submissions" on public.knowledge_article_submissions;
create policy "Auditors can view all submissions"
  on public.knowledge_article_submissions
  for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
    or public.is_ultimate_user(auth.uid())
  );

drop policy if exists "Contributors can revise own unapproved submissions" on public.knowledge_article_submissions;
create policy "Contributors can revise own unapproved submissions"
  on public.knowledge_article_submissions
  for update
  to authenticated
  using (
    auth.uid() = contributor_id
    and status in ('draft','submitted','needs_revision')
    and public.is_verified_knowledge_contributor(auth.uid())
  )
  with check (
    auth.uid() = contributor_id
    and status in ('draft','submitted','needs_revision')
    and public.is_verified_knowledge_contributor(auth.uid())
  );

drop policy if exists "Auditors can update all submissions" on public.knowledge_article_submissions;
create policy "Auditors can update all submissions"
  on public.knowledge_article_submissions
  for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
    or public.is_ultimate_user(auth.uid())
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
    or public.is_ultimate_user(auth.uid())
  );

drop policy if exists "Users manage own knowledge articles" on public.knowledge_articles;

drop policy if exists "Auditors manage knowledge articles" on public.knowledge_articles;
create policy "Auditors manage knowledge articles"
  on public.knowledge_articles
  for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
    or public.is_ultimate_user(auth.uid())
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
    or public.is_ultimate_user(auth.uid())
  );

drop policy if exists "Contributors can view own draft articles" on public.knowledge_articles;
create policy "Contributors can view own draft articles"
  on public.knowledge_articles
  for select
  to authenticated
  using (auth.uid() = created_by);

drop policy if exists "Verified contributors can create draft articles" on public.knowledge_articles;
create policy "Verified contributors can create draft articles"
  on public.knowledge_articles
  for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and public.is_verified_knowledge_contributor(auth.uid())
    and status in ('draft','pending_review','needs_revision')
  );

drop policy if exists "Verified contributors can update own draft articles" on public.knowledge_articles;
create policy "Verified contributors can update own draft articles"
  on public.knowledge_articles
  for update
  to authenticated
  using (
    auth.uid() = created_by
    and public.is_verified_knowledge_contributor(auth.uid())
    and status in ('draft','pending_review','needs_revision')
  )
  with check (
    auth.uid() = created_by
    and public.is_verified_knowledge_contributor(auth.uid())
    and status in ('draft','pending_review','needs_revision')
  );

create or replace function public.review_knowledge_submission(
  p_submission_id uuid,
  p_decision text,
  p_reviewer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.knowledge_article_submissions%rowtype;
  article_id uuid;
  reviewer uuid := auth.uid();
begin
  if reviewer is null or not (
    public.has_role(reviewer, 'admin')
    or public.has_role(reviewer, 'moderator')
    or public.is_ultimate_user(reviewer)
  ) then
    raise exception 'Only auditors can review knowledge submissions';
  end if;

  select * into s
  from public.knowledge_article_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found';
  end if;

  if p_decision not in ('approved','needs_revision','rejected','archived') then
    raise exception 'Invalid review decision';
  end if;

  update public.knowledge_article_submissions
  set status = p_decision,
      reviewer_id = reviewer,
      reviewer_notes = p_reviewer_notes,
      reviewed_at = now(),
      updated_at = now()
  where id = p_submission_id;

  if p_decision = 'approved' then
    if s.target_article_id is not null then
      update public.knowledge_articles
      set title = s.title,
          slug = coalesce(nullif(s.slug, ''), slug),
          category = s.category,
          summary = s.summary,
          content = s.content,
          tags = s.tags,
          source_url = s.source_url,
          visibility = s.visibility,
          status = 'published',
          evidence_level = s.evidence_level,
          evidence_grade = s.evidence_grade,
          evidence_summary = s.evidence_summary,
          sources = s.sources,
          reviewer_notes = p_reviewer_notes,
          reviewed_by = reviewer,
          reviewed_at = now(),
          updated_by = reviewer,
          updated_at = now(),
          contribution_origin = s.submission_type
      where id = s.target_article_id
      returning id into article_id;
    else
      insert into public.knowledge_articles (
        title, slug, category, summary, content, tags, source_url,
        visibility, status, created_by, updated_by, evidence_level,
        evidence_grade, evidence_summary, sources, reviewer_notes,
        reviewed_by, reviewed_at, contribution_origin
      ) values (
        s.title,
        coalesce(nullif(s.slug, ''), lower(regexp_replace(s.title, '[^a-zA-Z0-9]+', '-', 'g'))),
        s.category,
        s.summary,
        s.content,
        s.tags,
        s.source_url,
        s.visibility,
        'published',
        s.contributor_id,
        reviewer,
        s.evidence_level,
        s.evidence_grade,
        s.evidence_summary,
        s.sources,
        p_reviewer_notes,
        reviewer,
        now(),
        s.submission_type
      ) returning id into article_id;
    end if;

    update public.knowledge_article_submissions
    set target_article_id = article_id
    where id = p_submission_id;

    return article_id;
  end if;

  return s.target_article_id;
end;
$$;

create or replace function public.audit_archive_knowledge_article(
  p_article_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  auditor uuid := auth.uid();
begin
  if auditor is null or not (
    public.has_role(auditor, 'admin')
    or public.is_ultimate_user(auditor)
  ) then
    raise exception 'Only master auditors can archive knowledge articles';
  end if;

  update public.knowledge_articles
  set status = 'archived',
      reviewer_notes = coalesce(p_reason, reviewer_notes),
      reviewed_by = auditor,
      reviewed_at = now(),
      updated_by = auditor,
      updated_at = now()
  where id = p_article_id;
end;
$$;
