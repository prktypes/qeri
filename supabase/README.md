# Supabase — Phase 4 activation

The schema and RLS policies for the cloud knowledge library are already in the repo
(`migrations/0001_saved_explanations.sql`). They are **inert until a project exists** —
this checklist turns them on. Nothing here requires code changes the stage-1 build
doesn't already anticipate: entries are row-shaped (one row = one `SavedExplanation`).

## 1. Create the project

1. Sign in at <https://supabase.com> → **New project**.
2. Pick an org, a region near expected users, and a strong DB password (store it in a
   password manager — it is shown once).
3. Wait for provisioning; note the **Project URL** shown in Settings → API.

## 2. Collect the three credentials

| Credential | Where | Goes where (planned) | Committed to git? |
| --- | --- | --- | --- |
| Project URL | Settings → API | extension config + API `.env` | ❌ never |
| `anon` public key | Settings → API | extension config + API `.env` | ❌ never (public-by-design, but keep it out of the repo) |
| `service_role` key | Settings → API | **Edge Function env only** — never the extension, never the API client | ❌ never |

## 3. Apply the migration

Either:

- **SQL editor**: open the dashboard SQL editor, paste the full contents of
  `migrations/0001_saved_explanations.sql`, run it; **or**
- **CLI**: `supabase link --project-ref <ref>` then `supabase db push` from this folder.

Verify: Table Editor shows `saved_explanations` with RLS enabled (shield icon) and the
three policies listed under the table's Policies tab.

## 4. What remains after activation (Phase 4 finish)

- Deploy the `/explain` contract as a Supabase Edge Function (same Hono-shaped handler,
  same shared schema), so the API is callable with a Supabase JWT.
- Swap the extension's base URL from `http://localhost:8787` to the function URL and
  attach the user's access token to every request.
- Add panel sign-in (magic link or Google OAuth via `@supabase/supabase-js`), then sync
  the local library: push pending saves, pull the cloud list, merge by content id.
- Quotas move from per-process counters to identities keyed by `auth.uid()`.

## Security posture

- The `anon` key identifies the *project*, not a user — it is safe to expose in the
  extension bundle **because RLS is the real gate**. Without a valid user JWT only the
  policies above (all `authenticated`-only) can touch the table.
- `service_role` bypasses RLS entirely. It exists only inside the Edge Function runtime
  environment and is never bundled, logged, or committed.
