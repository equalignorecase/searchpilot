# Modern Minimal Implementation Plan

**Goal:** Apply the approved modern minimal design and IBM Plex Sans Thai throughout SearchPilot.

**Architecture:** Keep the current components and workflows. Use `src/app/globals.css`, shared UI primitives and the root font loader for cross-screen consistency; refine login and workspace markup where needed.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, next/font/local, bundled Google Fonts.

**Spec:** `docs/superpowers/specs/2026-11-17-modern-minimal.md` (approved direction in the conversation).

## Tasks

- [x] Bundle IBM Plex Sans Thai with OFL license; wire its CSS variable in `src/app/layout.tsx` and global typography.
- [x] Refine light/dark tokens, compact tables, panels, sidebar, topbar, buttons, inputs and KPI hierarchy; preserve accessibility and mobile layouts.
- [x] Simplify the login presentation using the same visual system.
- [x] Verify font assets, contrast and existing functional tests. Run typecheck, lint and build. Attempt browser QA and record outcomes.

## Review focus

Thai combining marks must remain visible, desktop tables must stay scrollable on mobile, dark text must retain contrast, keyboard focus must stay visible, and styling must not change API values or login/sync behavior. No new behavior is needed, so no implementation-mirroring UI unit tests will be added.

## Verification

- 76 tests passed; typecheck, lint and final production webpack build passed.
- Official Google Fonts assets for weights 400/500/600/700 are bundled with the OFL license. FontTools confirmed Thai letters, combining marks, Thai digits and Latin/Arabic-digit glyphs before lossless WOFF compression; glyph maps match the original TTF sources. No new runtime dependency.
- Production CSS contains the local font faces, swap display and root font variable; all four WOFF assets were emitted. Total compressed font payload is approximately 211 KB.
- Checked foreground/background, muted text/card, muted text/muted surface, primary/button text, primary/card and destructive/card in both themes; all tested pairs exceed 4.5:1.
- Mobile controls retain 44px targets, responsive forms and scrollable tables. No authentication, database or sync behavior was changed.
- Browser inventory exposed no browser tabs. Attempting to access the running Orion app timed out; screenshot/mobile visual verification was not completed.
