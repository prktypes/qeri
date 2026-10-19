-- Qeri — Phase 4 (accounts & saved knowledge): schema + row-level security.
--
-- Activation is pending the Supabase project (supabase/README.md has the checklist).
-- Until then this file is inert SQL, not dead code: it defines the cloud mirror the
-- local library (chrome.storage.local, stage 1) will sync into.
--
-- Model, in one line: one row = one SavedExplanation. Explanations are IMMUTABLE
-- artifacts — the panel re-render needs no transform, and `payload` is the exact
-- shared `Explanation` JSON, already validated by the same Zod schema upstream.

create extension if not exists pgcrypto;

create table if not exists public.saved_explanations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),

  -- Denormalized columns for cheap queries/listing without touching the payload.
  source_url     text,
  status_id      text,
  prompt_version text not null,
  generator      text not null, -- 'openrouter' | 'mock'

  -- The full immutable Explanation (shared contract, schema-validated upstream).
  payload        jsonb not null check (jsonb_typeof(payload) = 'object'),

  constraint saved_explanations_user_fkey_valid check (user_id is not null)
);

create index if not exists saved_explanations_user_recent
  on public.saved_explanations (user_id, created_at desc);

alter table public.saved_explanations enable row level security;

-- Reads: only your rows.
drop policy if exists "select own explanations" on public.saved_explanations;
create policy "select own explanations"
  on public.saved_explanations
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts: a row can only ever attach to yourself.
drop policy if exists "insert own explanations" on public.saved_explanations;
create policy "insert own explanations"
  on public.saved_explanations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Deletes: only your rows.
drop policy if exists "delete own explanations" on public.saved_explanations;
create policy "delete own explanations"
  on public.saved_explanations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- No UPDATE policy, on purpose: explanations are immutable artifacts. Editing one
-- is nonsensical — re-generate and save the new version instead (the library's
-- upsert-by-content-id semantics already make re-saves idempotent, not edits).
