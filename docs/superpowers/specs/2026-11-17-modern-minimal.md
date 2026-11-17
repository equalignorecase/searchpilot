# Modern minimal interface

User approved all four design choices: a white/neutral-gray interface with small blue accents and dark mode; compact, readable analytics; IBM Plex Sans Thai from Google Fonts; all screens using the current workflows.

Use the existing global stylesheet and shared primitives to carry the design through reports, tasks, settings and forms. Refine the navigation, top bar, KPI hierarchy and login screen. Keep Thai copy and existing controls, API values and auth/sync behavior. Retain focus indicators, mobile navigation, scrollable tables and reduced-motion behavior.

Bundle official Google Fonts files with their license and load through Next.js local font optimization to avoid external font dependencies during builds. Verify available weights, Thai glyphs, contrast, tests, types, lint and production build. Attempt browser QA where the environment permits it; report any limitation without claiming a visual pass.
