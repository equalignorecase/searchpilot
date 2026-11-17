# SearchPilot Implementation Plan

Goal: implement gsc.txt as a private, single-owner SEO platform, backed by real Google data.
Architecture: Next.js modular monolith, Prisma business tables in public only, managed Neon Auth, separate GSC OAuth, PostgreSQL jobs claimed with SKIP LOCKED. One worker step fetches one day/dataset/page; fencing and transactions protect checkpoints.
Spec: ../../../gsc.txt

The supplied spec authorizes implementation and reasonable technical decisions. No additional design approval is needed. No AI, registration UI, billing, Redis, or fabricated production analytics.

## Files and boundaries

- src/lib/auth: official Neon SDK and verified-owner guard. No business auth tables.
- src/lib/security: authenticated encryption, OAuth state, origin checks, persisted rate limits.
- src/lib/google: official SDK, separate authorization, read-only analytics and inspection.
- prisma: schema, additive application-only migration, public-schema isolation.
- src/features/sync and src/jobs: durable jobs, checkpointing, retries, worker and schedule.
- src/features/analytics and src/lib/seo: weighted metrics, comparison ranges, seven deterministic detectors.
- src/app/api: thin validated owner-protected routes, separately authenticated cron.
- src/components and dashboard routes: real data charts, tables, tasks, inspection, settings.
- tests: unit, mocked integration, embedded PostgreSQL migration/SQL checks, browser tests without production credentials.

## Tasks

- [x] 1. Resolve current official contracts; install pinned dependencies, strict TypeScript, Tailwind, shadcn primitives, Prisma config/schema/migration.
- [x] 2. Test then implement owner checks, encryption, date/metric math, dimension keys, token preservation, request validation.
- [x] 3. Implement Neon session integration, separate GSC state + PKCE OAuth, discovery/disconnect, quotas and error sanitization.
- [x] 4. Test then implement four independent datasets, day-at-a-time pagination, transactional checkpoint/upsert, leases, retries, scheduling.
- [x] 5. Test then implement reporting and all seven configurable rules with evidence/confidence/scoring and stable fingerprints.
- [x] 6. Implement working analytics, keyword/page details, preferred targets, opportunities, tasks, changes, inspection, sync and settings UI.
- [ ] 7. Run typecheck, lint, unit/integration/browser tests, migration validation and production build; document exact setup and unverified external acceptance criteria.

## Review focus

- Forged, unverified or non-owner identity must fail before any DB reads; require verified owner email and optional pinned Neon user ID. No Google sub inference from Neon user ID.
- Missing replacement refresh token must retain current token only for the same Google grant. Revocation must require reconnect.
- Concurrent/stale workers must never overwrite newer checkpoints; retries cannot publish partial day snapshots.
- Empty periods and zeros must not become fake 0% deltas; independent aggregation datasets retain Google's meaning.
- Missing credentials must fail closed and show setup guidance; tests must not create any production auth bypass.

## External setup

No credentials supplied. Implement integrations and safe mocks, document Neon project/branch/Auth, Google Cloud OAuth consent and scheduler setup. Live OAuth, Neon migration execution and production deployment require the owner's accounts.

## Verification at handoff

- TypeScript and ESLint: passed.
- Vitest: 46 tests passed across nine files (unit + mocked and embedded-PostgreSQL integration).
- Prisma schema validation: passed. Initial migration executed successfully in ephemeral PostgreSQL; managed-auth sentinel remained intact, including when the original search path preferred neon_auth.
- Production build: passed using `npm run build` (Webpack), without production credentials.
- Browser asset scan: no references to database URLs, GSC client secret, encryption key or Neon cookie secret in `.next/static`.
- Playwright: seven E2E scenarios authored; local execution blocked by sandbox loopback restrictions before tests began. CI is configured to run them on a hosted runner. No E2E pass is claimed.
- Native-browser visual QA was attempted but the available computer-use session timed out; responsive layout is not visually certified.
- Actual Neon project provisioning, remote migration, real Google login/consent/data sync, worker hosting and deployment remain external setup steps in README. No production accounts or data were modified.

Task 7 remains open for browser/live acceptance. The temporary test environment file was removed; only `.env.example` remains.

## Final setup additions

- `npm run setup`: interactive Neon/GSC setup wizard with hidden credential entry, stable generated secrets and development-branch migration.
- `npm run check:setup`: safe configuration and read-only live-connection diagnostics, tested to fail without leaking secrets when configuration is absent.
- Disconnect now handles an already-revoked Google grant while preserving credentials on uncertain network failures.
- Real PostgreSQL tests exercise opportunity insert/update/resolve SQL and preserve dismissals without duplicating findings.
- E2E always starts its own test-configured server and overrides production credential variables, preventing reuse of a real workspace.
- Neon/Vercel connections were offered but are not confirmed connected. The Google owner email is still not supplied. No live project/deployment success is claimed.

## Account-access blocker rechecked

Neon and Vercel plugin discovery still reports both uninstalled; no service credentials or `.env.local` are present. The required owner Google email remains unanswered. No production project or deployment was created. Setup diagnostics now use `node --import tsx` directly so they run without tsx CLI IPC pipes in restricted environments; the real npm command is covered by the secret-redaction test. Typecheck, lint and all 46 tests passed after that change.

## Later authentication override

The user's username/password request supersedes this plan's earlier Google-login/email-owner requirements. Current auth behavior and verification are documented in `2026-11-16-username-login.md`. No personal Google email is required for application login; GSC OAuth remains separate.

## Live Neon connection supplied

The supplied pooled database credential was saved privately in ignored `.env.local` (0600), with the direct hostname derived for migrations. Existing secret values were preserved; missing server encryption/cookie/cron keys were generated locally. Default app username is `admin`, pending owner provisioning.

A read-only query through the installed Neon HTTP driver's request format succeeded against the real database: managed `neon_auth` schema exists; the public schema contains no tables yet. No managed auth data was read or modified. `npm run db:migrate` failed with P1001 because the direct PostgreSQL port could not be reached from the execution environment; no migration success is claimed. The managed Auth URL and owner password provisioning are still missing. Database credentials were not added to documentation or printed in results.

## Live migration and Auth endpoint verified

The user's successful Prisma migration was independently verified by a read-only query: all nine business tables exist and `20261116000000_initial` is recorded as finished. The managed auth schema remains present. The supplied managed Auth URL was saved in private `.env.local`; its unauthenticated session endpoint responded successfully. App username is currently `admin`; owner password provisioning and the pinned user ID are still pending. No password was requested or stored in chat.
