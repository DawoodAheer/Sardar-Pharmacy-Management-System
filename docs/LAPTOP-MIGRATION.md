# Moving the updated pharmacy to another Windows laptop

## Before deleting anything

Keep the old installation and take a fresh full database backup plus uploads. Verify recovery and keep a copy outside the old laptop. Deleting a source folder does not transfer its Docker database to another computer. Do not use Docker Factory Reset, volume pruning or docker compose down -v as an update step.

## On the other laptop

1. Install Docker Desktop from https://docs.docker.com/desktop/setup/install/windows-install/ and complete its WSL 2 / Linux containers setup. Check the official requirements for that laptop (supported Windows, virtualization and RAM). Both current per-user and all-users Docker locations are detected by the launcher.
2. Copy the **updated software/source ZIP** and the separate **private full-backup ZIP**. The source ZIP contains code; the backup ZIP contains business data. Until the new changes are pushed, an older GitHub download will not include them.
3. Extract the software to a permanent folder such as C:\Sardar-Pharmacy. Extract the entire ZIP, including client/vendor. Do not run inside the ZIP. Do not copy node_modules, old Docker images or old .env secrets from another laptop.
4. Start Docker Desktop, then double-click Start-Sardar-Pharmacy.bat. First setup needs internet to download/build dependencies and images. Daily use works offline after a successful build. No separate Node, Git or MongoDB installation is required.
5. Use the address printed/opened by the launcher. It may be 5174, 8080 or another available fallback. Create/use the desktop shortcut for daily launch; an old bookmarked port may no longer work.
6. To transfer existing records, sign in as Admin and use Database Backup & Restore to select pharmacy-complete-backup.json from the extracted backup. Verify recovery, then deliberately confirm RESTORE. This replaces that laptop's current database with the snapshot; it does not merge two shops' data. The included RESTORE-INSTRUCTIONS.txt also describes archive recovery.
7. Stop services with Stop-Sardar-Pharmacy.bat and copy the extracted uploads contents into the installation's server/uploads folder, preserving paths. Start again.
8. Sign in using the restored account credentials. Compare medicine/bill counts, stock, expiry, a sample historical bill and a profit report. Change published setup-account passwords, create a fresh backup, and verify it before daily use.
9. Keep the old laptop/folder and backup until this validation succeeds. If that laptop already had an older installation, stop it first and preserve its uploads/backups; the new launcher reuses its existing Docker database volume unless you deliberately restore a different snapshot.

## Two laptops at once

Two separate Docker installations have separate databases and do not automatically synchronize stock or bills. For shared live counter stock, both browsers must use one designated server/database. Local network deployment needs an appropriate access/security review; do not expose the HTTP installation to the public internet.

## Verification limits

The current laptop's services and tested workflows passed. The other laptop's hardware, Windows/WSL and Docker configuration must still be checked there. No software can guarantee that power cuts, disk failures, malformed new data or future updates will never cause a crash. Retain verified backups and check whether a bill saved before entering it again after an interruption.
