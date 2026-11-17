# Thai interface

Make Thai the default language for SearchPilot's existing screens. Translate navigation, login/setup, reports, tasks, opportunities, settings, sync/inspection screens, accessible labels and actionable API errors. Preserve product names, user-entered content, URLs, stored enum values, filter/API keys and authorization checks.

Use Thai locale for numbers and Gregorian Thai date labels. Report dates keep their original day; event timestamps use Asia/Bangkok. Use installed system fonts with Thai fallbacks. Translate known saved opportunity explanations at display time, with the same mapping applied to new findings. Keep raw external inspection payloads intact.

Verification: 74 Vitest tests, typecheck and lint passed. Production build passed, including the translated not-found page. Eight Playwright scenarios use Thai labels and were discovered with --list. Browser visual verification remains unavailable in the sandbox; the local HTTPS endpoint was not running during the read-only check. No database migration, credential or owner changes.
