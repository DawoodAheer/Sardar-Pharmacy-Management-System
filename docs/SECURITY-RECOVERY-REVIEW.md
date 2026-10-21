# Local security and recovery review — 22 October 2026

## Completed technical fixes

- Login failure throttling (20 failed attempts per account/client in 15 minutes), a broader public-auth request limit, and throttling for password-recovery endpoints. Successful logins do not consume the failed-login allowance. Forwarded-address spoofing is covered by tests; production trusts the single Nginx hop.
- Authentication forms reject operator objects, arrays, non-text credentials and oversized fields with HTTP 400 instead of an unhandled server error.
- Added API and frontend security headers, removed framework/version banners, and restricted framing/object embedding without forcing HTTPS onto an offline HTTP installation.
- New access tokens expire after 15 minutes; refresh sessions/cookies expire after 30 days. Verification enforces maximum age even on old long-lived tokens. The existing client refresh flow renews sessions during use.
- Fixed final-bill currency rounding found by the copied-inventory trial; unrounded per-unit selling rates remain available.

## Verified controls

79 unit assertions pass. The expanded database suite passed 45 checks, including copied-inventory loose/full-pack sales, discount/refund/duplicate approval, permissions, role escalation, private-export ownership, revoked tokens, spreadsheet recovery and large backups. The final focused security/counter checks also pass after negative-discount validation was tightened. All business-changing tests use disposable databases.

Full application backup recovery verified all 16 configured collections in a temporary database. The portable backup includes JSON, a complete MongoDB archive, uploads, restore instructions and checksums. It remains private, outside the Git repository.

## Required operator action

Three currently active setup accounts still use the published initial password: the setup Admin, Pharmacist and Customer accounts. Set private passwords in the application before allowing other people or devices to use these accounts. Existing passwords were not silently reset. Keep the completed backup private because it includes account hashes and business records.

Historical data review found existing same-name inventory groups and below-cost sales. These require invoice/manufacturer/batch evidence before merging or correcting records. The private pricing report contains details; old financial history was not rewritten.

## Scope and remaining deployment limits

This is a local code review plus automated permission/input/session tests and controlled local HTTP probes, not an independent professional penetration-test certification. Public internet hosting was not enabled. The current local HTTP setup does not encrypt LAN traffic; use HTTPS and an appropriate public-hosting review before exposing it to untrusted networks. Rate-limit state is in memory for this single backend and resets on restart; a multi-instance public deployment needs a shared store.

Guidance: https://expressjs.com/en/advanced/best-practice-security/ and https://express-rate-limit.mintlify.app/reference/configuration

The user authorized GitHub publishing on 22 October 2026. Private backup and pricing-review artifacts are excluded from the source upload.
