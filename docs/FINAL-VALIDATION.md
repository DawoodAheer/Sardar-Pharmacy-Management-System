# Final release verification — 22 October 2026

## Follow-up: legacy account background import repair

- New extracted-folder launcher now automatically preserves the existing installation settings and five backend data mounts using a local ignored Compose override. No manual source replacement is required. The old installation folder must remain available. Fixture checks covered preservation, repeated application and unrelated-project refusal; the launcher regression suite passed. Docker Compose configuration validation against the actual installation confirmed unchanged data mount sources and MongoDB volume without changing running services.
- Reproduced the other laptop's exact permission failure with an approved legacy Admin and Pharmacist lacking a stored `isActive` field: preview accepted 35 rows, but the old lean worker lookup rejected the job.
- Changed the worker to use a hydrated User lookup matching API authentication. Inactive, pending, demoted and missing accounts remain denied. Error messages now distinguish those causes and the frontend displays background job errors and identifiers.
- Enabled disposable-database regression: 4 tests passed, zero failures, covering both 35-row imports, replay protection and revoked permissions. Standard tests: 60 server plus 19 client assertions passed; 9 database-dependent tests were skipped in that standard run. Frontend strict lint and production build passed.
- Repair helper fixture passed first application and repeated application, preserving a backup of the original source. The repair helper rebuilds through the existing launcher without resetting data. This verifies the local fix; installation and retry on the other laptop are still required.

Status: no blocking failure found in the verified workflows. GitHub publishing was authorized by the user on 22 October 2026; verification history below records the earlier upload hold.

- Current source passed 73 unit assertions, strict frontend lint and the production frontend build in the preceding recheck. No application code changed afterward; the launcher fixes were separately regression-tested again for this final release check.
- Full enabled database suite: 39 passes, zero failures/skips/cancellations. Includes duplicate-stock authorization and single execution, concurrent/stale approvals, Excel round-trip recovery, annual sales export, ordering, billing/refunds, batch profit, 50,000-medicine paging/export, background import replay and large-backup verification/recovery.
- The full capacity suite now passes. The earlier timeout recorded below was from the older Windows source-bind test run; the final run uses installed Linux image dependencies and writable container storage. It did not raise application timeouts or skip the backup test.
- Fresh isolated Docker installation passed frontend/API connectivity, sale/discount/batch cost/partial refund/profit, stock isolation, and persistence after restarting MongoDB/backend/frontend. Only random test containers/volumes were removed afterward.
- Launcher regressions, occupied-port-range fallback, unchanged-build reuse, changed-vendored-dependency rebuild, preserved secrets, conflicting-project refusal, backup selection and reset cancellation/failure safeguards passed.
- Fresh npm audits: root project, complete frontend dependencies and production backend dependencies each report zero known vulnerabilities.
- Running installation: http://localhost:8080/ (Windows has reserved the previous 5174 range). Frontend, backend and MongoDB healthy. API health reports ready=true and databaseConnected=true. Read-only authenticated inventory, pending approval queue and yearly-sales endpoints all returned HTTP 200.
- Upload candidate file list excludes private environment files, live database files, uploads, backups and runtime logs. Source diff whitespace check passes. Test logs and audit outputs remain outside the repository in the workspace outputs folder.

No live medicine, stock approval or bill was created by final verification. This is evidence for these tested paths; it cannot guarantee that every future input, hardware failure or dependency update will be crash-free. Keep verified database backups for recovery.

Earlier verification history follows.

# Security follow-up — 22 October 2026

GitHub push remains on hold. All changes remain local.

- Frontend dependency audit: zero reported vulnerabilities across production and development dependencies. Production server audit: zero reported vulnerabilities.
- Replaced registry SheetJS 0.18.5 with the official, pinned 0.20.3 archive; updated React Router to 7.18.4, Tailwind/PostCSS to 4.3.3 and patched Vite to 8.3.5 in the lockfile. Tailwind styles were migrated with the official upgrade tool, preserving custom theme tokens and compatibility styles.
- Docker copies the vendored spreadsheet dependency before npm ci, so clean builds can resolve the pinned local archive.
- All 73 unit checks passed (54 server, 19 client); the six database suites skipped by the unit command are distinct from the separately enabled integration run.
- Enabled import, duplicate approval, exports and pharmacy-upgrade integration checks: 24 passes, zero failures or skips, using disposable databases.
- Strict frontend lint and production build passed. Browser navigation between admin and inventory works. The medicine form shows purchase 200 / pack, sale 300 / pack, 10 units: cost 20 / tablet, sale 30 / tablet, profit 10 / tablet and 100 / pack. No test medicine was saved.
- Addressed the sales chart's initial negative-dimension warning with an initial size; ResizeObserver continues to provide the actual responsive dimensions.
- Local Docker security deployment completed after a compressed MongoDB safety backup. Medicine and bill counts were unchanged. Frontend, backend and MongoDB health checks passed.

The audit reports describe known advisories returned at verification time, not a guarantee against every vulnerability. Historical validation below records earlier releases.

# Latest validation — 21 October 2026

GitHub upload is on hold at the user's request. This update remains local.

- 73 unit checks passed: 54 server and 19 client. Five database suites are intentionally skipped by the default unit command.
- Strict frontend lint and production build passed.
- Enabled final database checks: 16 passes, zero failures/cancellations. Five unrelated capacity subtests were explicitly skipped in the focused export run.
- The 50,000-medicine background XLSX export retained all records while paginated inventory reads remained available.
- Actual inventory XLSX files were read back and normalized for import, preserving expiry, purchase/pack sale prices, units, stock and rack. Formula-like medicine names remain text.
- Annual report checks include inclusive Pakistan date boundaries, online acceptance dates, exclusion of pending/rejected orders, net sales after refunds, monthly totals, and exporting more than one visible page.
- Existing upgraded billing, batch allocation/refunds, profit, cash reconciliation, deletion approval, stale-stock protection and recovery into a temporary database passed.
- Production server dependency audit: zero reported vulnerabilities. Compatible dependency fixes were applied; scheduler and local JSON email transport smoke checks passed.
- At the time of the 21 October review, the frontend audit reported 10 findings (4 moderate, 6 high). These were subsequently resolved in the 22 October security update recorded above.
- A previous broad capacity run reached its overall four-minute timeout during its separate large-backup check. The final focused export run passed; the smaller database recovery workflow passed separately. The broad harness timeout is now ten minutes for slower hardware.

Inventory Excel restores the basic active medicine list, not the whole database. Full backups are required for bills, refunds, archived medicines, batch history, users and audit records. Historical bill costs are retained rather than rewritten to hide losses from incorrect old pack settings.

The records below describe the earlier reviewed release and remain for context.

## Earlier validation — 17 October 2026

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

## Local deployment check — 21 October 2026

The updated runtime at http://localhost:5174 returned HTTP 200; the health endpoint reported ready=true and databaseConnected=true. All three Docker services were healthy. A safety archive was created before rebuilding, and medicine/bill counts were unchanged across deployment. Authenticated checks on the running service successfully loaded the sales-period report and downloaded real inventory and sales .xlsx job artifacts. These checks did not create/delete bills or change medicine stock.

GitHub push remains on hold at the user's latest instruction; no new commit has been pushed in this work.

## Duplicate delivery update — 21 October 2026

Same-name manual and bulk entries now require Admin approval before increasing existing stock. 73 unit checks, strict lint, production build and 23 enabled integration checks passed. The integration checks include import retry safety, concurrent approvals, stale stock, role restrictions, one-time additions, batch costs/expiry, billing/refunds and isolated recovery. GitHub push remains on hold.

## Live checks — 22 October 2026

The interrupted duplicate-stock deployment was completed after starting Docker Desktop. A fresh database archive was saved before deployment; medicine/bill record counts were unchanged. Live inventory, pending approval queue and yearly sales APIs returned successfully. Frontend returned HTTP 200 and the health endpoint reported ready=true/databaseConnected=true. All three production containers were healthy, with zero container restarts and OOM=false at inspection.

A separate, randomly named offline Docker installation passed fresh-start initial-data checks, frontend/API access, the offline sale/refund smoke workflow and restart persistence. Test-only containers/volumes were removed by the guarded test script. Production containers and volumes were retained. GitHub push remains on hold.

## Duplicate approval and startup recheck — 22 October 2026

- Rechecked 73 unit assertions and strict lint; production build passed.
- Enabled database suites for duplicate approval, import, exports, ordering and pharmacy upgrades: 31 checks passed, zero failures/skips. The duplicate fixture verifies 20 existing + 10 incoming = 30 units only after Admin approval, rejected staff/customer approvals, rejected repeated and stale approvals, concurrent deliveries, same-file duplicates, batch cost/expiry and unchanged unrelated stock.
- Found Windows excluded TCP range 5141–5240 containing 5174. Docker was initially stopped; after startup its frontend lacked an active host mapping. An explicit attempt to publish 5174 confirmed the Windows bind restriction.
- Updated the launcher to try separate port ranges after the preferred eleven ports, without changing Windows reservations. Added a regression fixture occupying eleven consecutive ports. The local installation successfully selected a free fallback port and passed its API readiness check.
- Included vendored dependencies and optional PostCSS configuration in the launch build fingerprint. A regression test confirms a changed bundled archive triggers a rebuild; unchanged launches preserve secrets and reuse the build.
- Business database was retained. No live medicine entries, approval requests or bills were created by these checks. GitHub push remains on hold.
## Recovery, counter trial and security update — 22 October 2026

The subsequent recovery/security task added login rate limits, authentication input validation, security headers, bounded JWT/cookie ages and monetary rounding on new bills. 79 unit assertions passed; the expanded isolated database suite passed 45 checks, with a further six focused checks after the final discount guard. A copied real medicine was exercised only in a temporary database. Live backup verification restored and compared 16 collections. The portable private backup ZIP and historical pricing report are outside Git. See SECURITY-RECOVERY-REVIEW.md for controls, test scope and remaining operator actions, including changing the three published setup-account passwords. No historical prices or live bills were rewritten. GitHub push remains on hold.
