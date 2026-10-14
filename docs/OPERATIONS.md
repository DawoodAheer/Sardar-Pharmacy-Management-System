# Stock and accounts

Open **Stock & accounts** from the Admin sidebar or the Pharmacist navigation, or visit `/operations`.

## Batch inventory

Receive separate deliveries with a batch number, expiry, whole-unit quantity and purchase cost **per unit**, not per pack. Existing stock is retained as a legacy lot on its first stock transaction. Sales allocate the earliest unexpired lots and save the actual costs on the invoice. Returns restore the original lots. Expired lots remain visible and are excluded from sales; expiry notifications now evaluate each lot independently.

For medicines with batches, use Batch inventory for receipts and Stock adjustment for inventory corrections. Editing the medicine's aggregate quantity, expiry or purchase cost is blocked once batches exist, so its lot history stays consistent. Stock additions through the old adjustment tool inherit the current medicine expiry and unit purchase cost; use batch receipts when those details differ. Remove expired stock using a subtract adjustment, or return the exact purchased lot to its supplier.

## Supplier accounts

Create suppliers, then receive a purchase invoice with one or more batch lines. Invoice receipt and stock receipt commit together. Invoice numbers are unique per supplier. Admins may record payments and supplier returns; staff may create suppliers and receive purchases. Returns are limited to purchased units still in stock. Credits reduce the supplier balance; negative balances indicate money or credit owed by the supplier. Supplier cash refunds and settlement of those credits are not automatically booked into the drawer.

When recording a supplier payment, select **Paid from cash drawer** if applicable. This records its cash expense in the same transaction. Other payment sources do not change drawer cash.

Purchase-order drafts remain available in the existing dashboard. Their Receive action creates a lot using the order number and existing medicine expiry/cost unless explicit receipt details are supplied. Do not receive both a purchase order and a supplier invoice for the same delivery: use the supplier invoice flow when supplier accounting is required.

## Customer credit

Continue creating accounts and recording payments in Udhar. Credit statements adds due dates, overdue filtering, an itemized printable statement and individual printable payment receipts. Concurrent payments validate the latest balance inside a transaction. Other account edits use optimistic concurrency; retry after refreshing if another staff member has changed the record. Charges cannot be removed below recorded payments.

## Cash reconciliation

For each local business date, an Admin may enter opening cash, expenses and counted cash. Online cash orders enter the daily closing and cash drawer report on their acceptance date; legacy orders without an acceptance timestamp use their creation date. In-store sales use their creation date. Inventory value sums the remaining units at each batch’s purchase cost, with pack-cost conversion for legacy medicines.

Expected cash is opening cash + cash sales + credit recovered − cash refunds − expenses. The difference is counted cash − expected cash. Staff can view the figures. Credit payments are treated as cash, matching the current Udhar payment workflow. Bank settlements and other cash movements must be accounted for separately.

## Backup recovery

Admin Backup & Restore now includes **Verify backup recovery**. Create a backup or choose a backup JSON file first. Verification validates the archive, restores its collections and indexes into a uniquely named temporary database, compares normalized document contents and then drops that temporary database. It never replaces the active database. The panel records the last successful verification and errors. Verification needs permission to create and drop temporary databases on the MongoDB deployment.

Backups include batches, suppliers, purchase invoices, cash sessions and credit due dates. Backups are read from a consistent MongoDB snapshot. Older backups without the new collections remain supported. Keep an additional backup copy outside the application computer.

## Performance and validation

Inventory, shop, users/customers, invoices, orders, credit, corrections, batch alerts, purchase orders, medicine audit history and financial detail lists use server pagination. The usual page is 50 records, with a maximum of 100. Dashboard inventory counts and batch valuation, sales, profit totals and the seven-day chart use database aggregation. Excel libraries and large panels load on demand. No latency guarantee is implied.

Bulk import confirmation, complete inventory export, backup creation and recovery checks run in a separate Node worker with a 512 MB heap limit. The queue and status are stored in MongoDB; import payloads and CSV artifacts live under `server/job-data`. Run only one API instance/dispatcher per database. A server restart marks interrupted jobs as failed and retains queued work. Imports can be retried safely because their existing transaction and content ID prevent duplication. The interface reports success only after worker completion. The normal import remains limited to 10,000 rows per file. Inventory CSV is compatible with Excel; the small profit-detail Excel export explicitly contains the displayed page.

The Admin's Operations page shows disk space, system/API memory, event-loop delay, database connectivity and background job states. Server errors are written without request bodies, passwords or tokens to `server/logs/errors.jsonl`, rotated at 5 MB. Memory/disk readings in Docker describe the container environment; monitoring is not a substitute for checking the host and MongoDB volume.

Every completed backup gets a checksum-verified sharing copy in `backup-exports` beside the repository folders. Change `PHARMADESK_BACKUP_SHARE_DIR` to move that destination. Docker mounts it to the same host folder. Copy failure is displayed separately from database backup success. The user can send the JSON themselves; the application does not send WhatsApp messages. The JSON contains account and business records. Keep its transferred copy outside this PC. Images under `server/uploads` need a separate external copy as well.

Nightly backups and weekly isolated recovery checks are scheduled while the API is running. Schedule times use Asia/Karachi. A same-PC backup does not survive loss of that PC/disk. Worker memory limits protect the API, but an oversized backup can fail and must be addressed before relying on recovery.

Run `npm test` for the regression suite and `npm run build --prefix client` to build the frontend. For integration tests on Windows PowerShell:

```powershell
$env:TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true'
npm run test:integration
npm run test:capacity
```

The capacity test creates a separate database with 50,000 medicines, checks bounded concurrent page reads and valuation, verifies batch cost/return accounting, streams a complete export, tests import replay, creates a sharing copy and restores/verifies it in another temporary database. It also checks interrupted-job reporting. This establishes a tested dataset, not an unlimited capacity guarantee.

Run `npm run test:docker` on a PC with Docker Desktop to build an isolated backend/MongoDB pair, check the fresh three accounts/empty inventory, restart containers and verify a persisted sentinel. Its random test project has no host ports or production volume/container names. Only its own temporary volumes are cleaned up. Docker is unavailable on the current development PC, so that runtime test has not been executed here.

Integration tests create a uniquely named `pharmadesk_test_upgrades_*` database, exercise billing, returns, supplier balances, concurrent credit payments, cash reconciliation and backup recovery, then drop only that test database. They require a local replica set and never use the live pharmacy database. Without `TEST_MONGO_URI`, integration tests are skipped by the ordinary test suite.
