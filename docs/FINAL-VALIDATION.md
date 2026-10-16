# Validation — 17 October 2026

This is evidence from the reviewed version, not a guarantee that every possible interaction is error-free. Business-changing checks used disposable databases. The existing pharmacy database was not reset.

## Passed

- Frontend production build.
- 64 unit checks: 52 backend and 12 frontend. The standard unit run skips four database suites; those suites were separately enabled and run below.
- All four database integration/capacity suites: 36 checks, zero failures/skips. Coverage includes Excel import/duplicate correction, manufacturer ordering, sales, batch stock, refunds, profit/cash reporting, permissions and backup recovery.
- 50,000-medicine capacity fixture: ten concurrent pages returned bounded results and correct totals (413 ms on this machine; other hardware/load can differ).
- Offline Docker test: fresh database has only initial accounts and zero medicines/bills; frontend/API access, discounted sale/refund profit, stock isolation and restart persistence passed.
- Reset cancellation/failure guards, transactional reset/rollback and actual archive recovery in disposable MongoDB.
- Launcher regression simulations, including mixed installation folders and refusal to touch another Docker project.
- Restore selection/cancellation, reset archive discovery, invalid paths/selections and refusal to restore after a failed safety backup.
- Syntax checks of 118 tracked JavaScript files and all PowerShell utilities.
- Active Docker frontend, backend and MongoDB healthy after deployment.
- Browser check: Admin Refund & Return Activity opens with no captured console errors.
- Tracked source excludes business databases, `.env`, backups, uploads, logs and job runtime files.

## Fixes in this review

- Import the missing `RotateCcw` icon that caused Admin refund/sales views to fail when rendered.
- Detect containers left over from another ZIP folder and recreate this project's services together while retaining the database volume. Refuse conflicting Docker projects.
- Accept an explicitly supplied MongoDB archive without requiring a legacy backup directory; discover reset archives in `backup-exports`; validate selection and safety-backup exit status.
- Give Vite configuration and Node test files the correct Node globals in ESLint.

## Remaining static diagnostics

Full frontend `npm run lint` is **not passing**: 62 errors and 11 warnings remain. They concern unused imports/variables, empty catch blocks and React effect/callback/performance rules. No `no-undef` errors remain in that run. These diagnostics require further cleanup/review; passing build/runtime checks does not resolve them or prove the entire project bug-free.

Do not reset a live database to install updates. Reset clears both old and newly entered business records in that database. Archive/database restore is a deliberate replacement operation; normal startup does not restore old business data automatically.
