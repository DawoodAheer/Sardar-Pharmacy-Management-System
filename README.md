# Sardar Medical Store — Pharmacy Management System

A local pharmacy application for Windows, with Docker, MongoDB, an Express API and a React interface. It supports inventory, billing, returns, customer credit, supplier accounts and financial reports. Daily business workflows work offline after the initial installation.

## Run on Windows

1. Install Docker Desktop, use Linux containers and finish its WSL 2 setup. Windows virtualization and the hypervisor must be running.
2. Download **Code → Download ZIP** and extract the whole project to a permanent folder.
3. Double-click **start pharmacy.bat** or **Start-Sardar-Pharmacy.bat**.
4. Wait for the first image download/build. This requires internet and can take several minutes.
5. Use the **Sardar Medical Store** desktop shortcut for daily launch. Keep the installation folder in place.

Node.js, Git and a separate MongoDB installation are not required for this Docker setup. The shortcut opens an Edge/Chrome app window. Daily launches reuse unchanged images; changed source is rebuilt.

The normal address is `http://localhost:5174`. If occupied, the launcher chooses a nearby free port and prints/opens that address. It reuses the running installation's port. MongoDB and the backend communicate inside Docker without reserving host ports 27017 or 5001. A separate development instance has a different database; use the desktop shortcut to avoid confusing the two.

When starting from a different ZIP folder, the launcher recreates this project's containers together so they all belong to the current installation folder. It retains the existing database volume. Keep uploaded files, backups and `.env` when moving/updating an installation.

If Docker reports that its hypervisor is not running, use **Repair-Docker-Windows.bat**, accept the Windows Administrator prompt and restart Windows when instructed. The helper never automatically reboots or deletes data.

## Fresh installation and accounts

A **fresh database volume** contains zero medicines and zero bills. An older installation's existing database is retained during updates.

| Initial account | Role |
| --- | --- |
| aheerdawood014@gmail.com | Admin / Superadmin |
| mlksardar6@gmail.com | Pharmacist |
| aheerraza0@gmail.com | Customer |

The initial password is `Dawood@@5786`. Change initial passwords before business use. Startup adds missing configured accounts; it never resets existing passwords or inventory. In offline mode, an authorized Admin can reset managed users' passwords. Public email recovery does not reveal reset codes or links.

## Main workflows

- **Inventory:** manufacturer-first ordering, search, pagination, expiry/stock alerts, batch quantities and individual purchase costs.
- **Excel import:** preview validation, background import, correction records for invalid rows and retry protection. Only medicine name and positive purchase cost per pack are required.
- **Billing:** per-unit prices, discounts, batch stock allocation, printable/PDF receipts and customer history. Accepted sales reduce stock transactionally.
- **Returns:** partial refunds respect discounts and restore the original medicine/batch stock. Unrelated medicines are unaffected.
- **Profit:** net sales after discounts/refunds minus recorded cost of the remaining sold units. Historical batch costs are retained. Reports use Pakistan business dates (`Asia/Karachi`).
- **Credit and suppliers:** Udhar statements/payments, supplier invoices, balances, returns and cash reconciliation.
- **Refresh:** successful writes invalidate cached data; authenticated pages have a refresh control with update/error feedback.
- **Bill deletion:** Pharmacists request Admin approval. Admin-confirmed deletion restores stock and retains a deletion audit. Bills with refund history are protected; use Return / Refund for actual refunds.
- **Archived medicines:** Admin permanent deletion requires confirmation and a safety backup. Financially referenced medicines remain protected.

## Excel expiry dates and units

Rows needing correction stay in **Medicine Rows Needing Review**. Choose **Review rows** to open a scrollable list with 10 rows per page, then **Fix & Add** to open a separate correction dialog. Corrected unique medicines are added with an audit entry. An unchanged name/company duplicate is rejected without overwriting stock; discard a repeated row, or use Batch inventory for a genuine new delivery of an existing medicine.

Template/export dates use **YYYY-MM-DD**, for example `2028-05-22`. Text dates also accept **DD/MM/YYYY**, for example `22/05/2028`. Actual Excel date cells retain their date even when displayed as MM/DD/YYYY. Plain text `03/04/2028` means **3 April**, not March 4.

Purchase cost is per pack; units per pack determine the unit cost. Sale price and stock quantity are per sellable unit. Optional blanks default to one unit per pack, zero stock, sale price equal to unit cost, and no expiry/manufacturer/rack. Invalid supplied values are rejected.

## Offline operation

After the first successful build, login, inventory, imports/exports, billing, returns, reports, OCR and local backups operate locally. Docker Desktop and the application must be running. English OCR data is bundled with backend dependencies; label images use local storage and the frontend has no Google Fonts request.

Docker enables `OFFLINE_MODE=true`. Email and cloud image uploads are skipped; in-app alerts remain available. Sending email, obtaining updates and first-time image/package downloads require internet. This source ZIP is **not** a prebuilt installer for a PC that has never had internet access.

## Data, backups and recovery

- Database: Docker named volume **pharmadesk_mongo_data**.
- Images: **server/uploads** in the installation folder.
- Application backups: **server/backups**; shareable copies: **backup-exports**.
- Job files/logs: **server/job-data** and **server/logs**.

Use Operations to create backups and **verify recovery**. Keep verified copies on another device/drive and separately back up uploads. Ordinary container rebuilds/restarts retain the database; disk failure or accidental deletion can still cause loss. No software guarantees zero crashes or unlimited capacity.

**Never use `docker compose down -v`, volume pruning or Docker Factory Reset as an update/repair step.** Stop safely using **Stop-Sardar-Pharmacy.bat**. After a crash, check whether the last bill saved before entering it again. Collect `docker compose logs --tail 100` for diagnosis; do not publish private logs/backups.

To deliberately start business records again, use **Reset-Pharmacy-Data.bat** from the running installation folder. It requires typing `RESET PHARMACY DATA`, stops application writers, creates/checks a full MongoDB backup in `backup-exports`, then clears business records in a transaction while preserving login accounts/passwords and database indexes. It does not delete Docker volumes or program files. Follow [the reset instructions](WINDOWS-START-AND-UPDATE.md#intentionally-clearing-old-business-data); this is a destructive business-data reset, separate from updating. Reset guard tests: `powershell -File scripts/test-reset.ps1`; disposable Docker reset/restore checks: `powershell -File scripts/test-reset-docker.ps1`.

## Updating another laptop

1. Make and verify a backup; keep a separate copy of uploaded images.
2. For a Git clone, run **Update-Sardar-Pharmacy.bat**. Git is required; local source edits stop the update rather than being overwritten.
3. For a ZIP installation, copy the latest source into the **same installation folder**. Preserve `.env`, uploads, backups, job files and logs.
4. Run **Start-Sardar-Pharmacy.bat**. Changed source is rebuilt; use the current desktop shortcut.

A new ZIP does not reset an old database. Sending this repository ZIP does not send the sender's medicines, bills or private credentials.

## Developer setup and verification

Use Node.js 22 and a local MongoDB replica set for development:

```powershell
npm run install:all
npm run dev
```

Keep development and Docker instances separate. See the scripts and environment examples before changing database connections; never run tests against a business database.

```powershell
npm test
npm run lint --prefix client -- --max-warnings 0
npm run build --prefix client
$env:TEST_MONGO_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true'
npm run test:integration
npm run test:capacity
npm run test:docker
```

Integration/capacity tests create guarded temporary databases. Docker verification uses a random test project with an internal-only network, verifies discounted sale/refund profit and stock isolation, then checks restart persistence. Only that test project's storage is removed. Initial test builds require internet.

Verified workflows include Excel imports, accounting/permissions, stock restoration, backup recovery, large-data queries and Docker restart behavior. This does not cover every possible interaction or hardware failure.

## Repository contents

`client/` contains the interface; `server/` contains the API, models and tests; `scripts/` contains launch/maintenance utilities. Dockerfiles, Compose configuration, package lockfiles, tests and documentation are included so the project can be built and verified.

Private `.env` files, database files, uploads, backups, logs, node_modules and generated frontend bundles are excluded. Root environment secrets are generated locally on first launch. Assistant planning files and one-time source-edit scripts are excluded from release archives.

More guidance: [Windows start and update](WINDOWS-START-AND-UPDATE.md), [new-PC setup](docs/NEW-PC.md), [operations](docs/OPERATIONS.md).

Inventory tables and the New Bill medicine catalog use bounded scrolling; inventory remains server-paginated. CSV export downloads a file without expanding the page. Every committed bill is saved and updates stock and financial reports.
