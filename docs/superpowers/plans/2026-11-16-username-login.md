# Username/password login

User override: replace Google application sign-in with a single username/password login. Google Search Console consent stays independent and read-only. Keep managed Neon Auth; do not build a password database or modify neon_auth.

- Use the supported Neon email/password SDK behind a server-only username mapping. New installs use the reserved internal identifier owner@searchpilot.invalid; no personal Google email is required for app login.
- Pin the immutable Neon user ID after owner provisioning. Never authorize from a submitted username or email alone.
- Add validated, same-origin, rate-limited login. Hide and block public registration and Google application sign-in.
- Provision the account from an interactive terminal with hidden password entry; never store a plaintext password in environment files or command arguments. Preserve an existing pinned owner ID.
- Keep existing installations' owner identity by allowing OWNER_AUTH_EMAIL (or the prior OWNER_GOOGLE_EMAIL) as an administrative login identifier. Existing Google-only owners must set a password on their same Neon account; no business ownership is rewritten.
- Update login UI, settings/setup copy, environment example, wizard, README, unit/integration tests and Playwright fixtures. Keep managed session restoration/sign-out.
- Run failing tests first, then typecheck, lint, full tests and build. Live Neon login still requires service credentials; no mocked live-success claim.

## Verification

- 58 Vitest tests passed across 12 files, including server username mapping, managed identity pinning, wrong-password/provider failures, blocked public auth paths and owner provisioning.
- TypeScript passed after generating fresh Next route types; lint passed.
- Production build passed with `/api/auth/login` included.
- Managed Neon password client was initialized with the installed SDK without network access; the supported `signIn.email` API exists.
- Both setup shell scripts passed `bash -n`. Plaintext passwords are absent from environment configuration and are read through a hidden terminal prompt and stdin only.
- Seven updated Playwright scenarios were discovered with `--list`. Browser execution and real Neon credential login remain unverified because live credentials and sandbox loopback access are unavailable.
- No database schema or ownership migration was performed; GSC OAuth and stored Google credentials retain their existing design.

## Provisioning failure diagnostics

- Reproduced the generic CLI error using a short fixture password. The catch previously discarded every underlying failure, so the reported message alone cannot identify the live Neon failure.
- Added safe validation errors, stage-specific provider errors with allowlisted codes/HTTP status, and network diagnostics. Raw provider messages, request details and passwords remain hidden. Origin/settings errors stop before account creation.
- 63 tests passed; typecheck and lint passed. The actual CLI now reports the password validation reason and an assertion verified `.env.local` remains byte-for-byte unchanged on failure.
- Live password provisioning remains unverified; the owner must rerun `npm run auth:owner` with their password locally and report the safe diagnostic if it fails.

## Managed SDK thrown-error fix

- Reproduced the user's network diagnostic with the installed, unmocked managed SDK and a local HTTP 401 response fixture. The SDK's `customFetchImpl` throws a normalized `AuthApiError` before the expected `{ data, error }` return. The provisioning catch incorrectly classified that rejection as a network failure and prevented first-owner signup.
- Normalize official SDK `AuthError` rejections into the existing result flow for initial sign-in, sign-up and verification. Allow normalized `invalid_credentials` to reach signup only when no owner is pinned. Other provider errors remain safe, stage-specific failures.
- Three regression tests use the real SDK with HTTP response fixtures: first-owner creation after 401, no signup for a pinned owner, and signup settings rejection. All 66 tests, typecheck and lint passed.
- No live account was created and no database or environment configuration was changed during diagnosis. Real password provisioning still requires the user's local rerun.

## Login pending-state investigation

- Started the local development server on port 3000. A wrong username and one fixture wrong-password request both returned safe HTTP 401 responses in approximately 0.4 seconds. The anonymous session endpoint returned HTTP 200. These probes do not reproduce the user's successful-password navigation stall.
- Reproduced a pending-state defect directly through the form submit handler: HTTP success never cleared pending, and navigation used concurrent router replace/refresh without checking the browser's restored session. A browser retaining no session could return to login with no actionable error.
- Added bounded login/session requests, session confirmation before navigation, a full document navigation after confirmation, and pending reset in finally. Missing cookies and timeouts now display actionable errors.
- Four form-handler tests cover successful session confirmation, missing cookies, timeout and invalid credentials. All 70 tests, typecheck and lint passed. Eight Playwright scenarios are discoverable, including cookie failure recovery.
- Actual browser execution was attempted but Chromium was blocked by macOS sandbox MachPortRendezvous permission denial. No successful-password login was performed; the exact cause in the user's browser remains unconfirmed. Development server remains available at http://localhost:3000 for the user's retry.

## Local Secure-cookie compatibility

- Observed a real successful login HTTP 200 followed by a session check while the app was served over HTTP. This confirms the password step completed; the browser reported no restored session.
- A real managed server SDK fixture confirmed session cookies retain `Secure`. An assertion against the actual configured app origin failed with `http:` and passed after upgrading localhost configuration to `https:`. HTTP localhost exceptions vary across browser engines; HTTPS removes this dependency. The exact cookie rejection in the user's browser has not been inspected.
- Added `npm run dev:https` using Next.js' documented certificate flow. Updated localhost app/callback examples, setup defaults, README and cookie error guidance. Upgraded only localhost HTTP app/callback values in `.env.local`; credentials and owner identity were preserved.
- Stopped the HTTP development server. The user must add `https://localhost:3000` to Neon trusted origins and run `npm run dev:https` in their terminal. Next.js may request local CA trust during first startup; no system trust store changes were attempted by the agent.
- All 70 tests, typecheck, lint and shell syntax validation passed. HTTPS startup and real browser login remain unverified.

## Origin mismatch after HTTPS configuration

- Confirmed `.env.local` expects `https://localhost:3000`, while the active port 3000 server responds successfully to plain HTTP and rejects a TLS connection. This directly explains the application's origin rejection; its CSRF origin check remains unchanged.
- Replaced automatic mkcert setup with a local OpenSSL certificate and explicit Next.js HTTPS key/certificate paths. The script fixes port 3000 so a busy port fails instead of silently choosing a mismatched origin. Certificates are ignored; private key permissions are 0600. No system CA trust changes are made.
- Generated and verified the localhost certificate, hostname and matching private key. Shell syntax, all 70 tests and lint passed. Sandbox blocked the attempted HTTPS test listener with EPERM, so browser trust and actual HTTPS login remain unverified.
- The currently running HTTP server belongs to the user's terminal; stop it with Ctrl+C, run `npm run dev:https`, trust the localhost certificate and use exactly `https://localhost:3000/login`.
