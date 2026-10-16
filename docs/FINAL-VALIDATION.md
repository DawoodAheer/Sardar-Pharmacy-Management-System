# Validation — 17 October 2026

This is evidence from the reviewed version, not a guarantee that every possible interaction is error-free. Business-changing checks used disposable databases. The existing pharmacy database was not reset.

## Passed

- Frontend production build.
- Full frontend lint with `--max-warnings 0`: zero errors and zero warnings. Existing lint rules remain enabled.
- 66 unit checks: 52 backend and 14 frontend, including React pagination regression tests. The standard unit run skips four database suites; those suites were separately enabled and run below.
- All four database integration/capacity suites: 36 checks, zero failures/skips. Coverage includes Excel import/duplicate correction, manufacturer ordering, sales, batch stock, refunds, profit/cash reporting, permissions and backup recovery.
- 50,000-medicine capacity fixture: ten concurrent pages returned bounded results and correct totals (413 ms on this machine; other hardware/load can differ).
- Offline Docker test: fresh database has only initial accounts and zero medicines/bills; frontend/API access, discounted sale/refund profit, stock isolation and restart persistence passed.
- Reset cancellation/failure guards, transactional reset/rollback and actual archive recovery in disposable MongoDB.
- Launcher regression simulations, including mixed installation folders and refusal to touch another Docker project.
- Restore selection/cancellation, reset archive discovery, invalid paths/selections and refusal to restore after a failed safety backup.
- JavaScript syntax checks and PowerShell utility parse checks.
- Active Docker frontend, backend and MongoDB healthy after deployment.
- Browser check: Admin Refund & Return Activity opens with no captured console errors.
- Browser regression checks: inventory page 2 resets to page 1 after a search; closing a custom profit date range and opening monthly profit restores the monthly range; a scanner URL without its pairing ID shows a controlled error. No console errors were captured in those checks.
- Tracked source excludes business databases, `.env`, backups, uploads, logs and job runtime files.

## Fixes in this review

- Import the missing `RotateCcw` icon that caused Admin refund/sales views to fail when rendered.
- Detect containers left over from another ZIP folder and recreate this project's services together while retaining the database volume. Refuse conflicting Docker projects.
- Accept an explicitly supplied MongoDB archive without requiring a legacy backup directory; discover reset archives in `backup-exports`; validate selection and safety-backup exit status.
- Give Vite configuration and Node test files the correct Node globals in ESLint.
- Remove unused imports, obsolete helpers and unreachable handlers; document expected scanner cleanup failures.
- Reset pagination synchronously with its filter scope, without post-commit effects sending an obsolete page to query observers. New tests cover immediate reset, returning to a previous scope, functional page updates and retaining the page across unrelated renders.
- Remount profit dialog state for each opening/preset and use stable empty lists for memo dependencies.
- Stabilize scanner acknowledgement/reconnect callbacks and cleanup, derive missing-session errors directly from the URL, and use the browser location API for the print fallback.

## Static diagnostics resolved

The previously reported 62 lint errors and 11 warnings are resolved. The full frontend lint command passes with warnings treated as failures; no rules were disabled to obtain this result. Passing these checks does not guarantee zero crashes or ten years of error-free operation. Continue verified backups and maintenance when Windows, Docker or application dependencies change.

Do not reset a live database to install updates. Reset clears both old and newly entered business records in that database. Archive/database restore is a deliberate replacement operation; normal startup does not restore old business data automatically.
