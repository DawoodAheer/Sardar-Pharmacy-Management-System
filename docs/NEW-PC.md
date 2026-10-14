# Running on another PC without losing existing data

## Fresh installation

Install and finish configuring Docker Desktop (Linux containers) once. Download the GitHub ZIP, extract the entire folder to a permanent location, then double-click **start pharmacy.bat**. The launcher starts Docker Desktop if needed, creates your desktop shortcut, builds source and waits for healthy services before opening Edge/Chrome in an app window. No Node.js, Git or manual MongoDB installation is needed. First setup needs internet for images/packages; daily launch uses the shortcut and cached services. Do not run the batch file from inside the ZIP.

Use these commands only for manual troubleshooting:

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Open `http://localhost:5174`. A **new database volume** starts with no medicines or bills. Startup creates only these approved accounts:

| Email | Role |
| --- | --- |
| aheerdawood014@gmail.com | Superadmin |
| mlksardar6@gmail.com | Pharmacist |
| aheerraza0@gmail.com | Customer |

The initial password for these three accounts is `Dawood@@5786`. Existing accounts are never reset by startup. `npm run seed` is now a non-destructive account check; it does not delete or create medicine stock.

An existing database volume is deliberately retained. Restarting or rebuilding does **not** empty its medicines. Do not delete that volume to make an existing installation appear fresh. If local Node/MongoDB services already use ports 5001, 5174 or 27017, stop those services before starting the same application with Docker.

The server image excludes local backups and uploads. MongoDB records live in the named `pharmadesk_mongo_data` volume; uploads and backups use `server/uploads` and `server/backups`. The frontend proxies API requests and scanner WebSockets. The API health check waits for the database and initial account setup.

## Safe stopping and recovery

Use `docker compose stop` to stop and `docker compose start` to restart. Containers have restart policies and graceful shutdown windows. Never use `docker compose down -v`, delete the database volume, or run Docker volume pruning on business data.

Create a backup from Admin, download a copy to separate storage, and use **Verify backup recovery** regularly. A named volume protects ordinary container rebuilds; it cannot protect against disk failure, accidental volume deletion or loss of the PC. Keep an external copy. A UPS reduces the risk from abrupt power loss.

To transfer existing data, create and verify a JSON backup on the old PC, then restore it through Admin on the new PC. Restore replaces the destination database and makes a safety backup first; use a fresh destination or save its existing data beforehand. Do not copy the portable MongoDB data folder while MongoDB is running. Backups made by older Docker configurations may be in the project-root `backups` folder; retain those files when moving to the current `server/backups` mount.

## Excel import

Use the sample template's medicine sheet. Instruction sheets are skipped. Date cells are normalized from Excel's actual serial value rather than its display format. Quantities must be whole non-negative units; units per pack must be positive whole numbers. Supplied invalid numbers are rejected and retained in correction records, not silently replaced with zero. Missing quantity defaults to zero and a missing sale price defaults to the calculated unit cost.

Preview never changes stock. Confirmation writes valid medicine rows, audit records and invalid-row correction records together in a MongoDB transaction. A failed transaction leaves none of that import committed. Resending the same file content for the same account returns its recorded result instead of adding stock twice. Existing medicine/manufacturer pairs are skipped without overwriting their stock. Use batch receipts for additional deliveries of an existing medicine.

Import supports up to 10,000 medicine rows and a 20 MB workbook. File parsing runs in a browser worker. The API and Nginx allow enough time for large imports. A closed browser does not prove that a submitted import failed: retry the same file or inspect inventory before making a different import.

No software can guarantee zero crashes or zero data loss. Docker runtime checks must be performed on the target PC. The development machine used for these changes did not have Docker installed; its Docker configuration was checked statically, while import and database transaction tests ran against local MongoDB.


## Daily launch and updates

Keep the extracted project folder in place because the desktop shortcut points to it. Changed source triggers a rebuild; unchanged daily launches reuse images. The launcher does not automatically pull GitHub changes. Copy newer source into the existing folder while retaining its ignored `.env`, backups and uploads. Never remove the database volume.

## Archived medicines

Admin → Archived Medicines → **Delete permanently** requires typing `DELETE`. A background worker creates a safety backup, rechecks accounting references and removes the unlinked archived record with an audit entry. Bills, returns and supplier-purchase references prevent deletion. Restore remains available for records that have not been permanently deleted. Startup does not delete archived records.

## Launcher verification

Windows launcher simulations check first build, daily image reuse, stable secrets, refusal to open unhealthy services and shortcut targeting. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-launcher.ps1`. Backend tests use temporary databases to verify fresh account setup/zero bills, archive-deletion permissions, accounting protection and safety backup. Docker is absent on this development PC; actual Docker build/restart testing must run on the Docker-equipped laptop using the supplied `scripts/test-docker-restart.ps1` script. Keep external backups; no system guarantees zero data loss.
