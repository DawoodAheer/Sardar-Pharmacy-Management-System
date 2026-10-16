# Windows setup and updates

Docker Desktop must have a working WSL 2 engine. Installing Docker alone is insufficient if Windows reports that its hypervisor is not running.

Docker MongoDB and backend stay inside the Docker network; they do not reserve host ports 27017 or 5001. The desktop launcher normally opens port 5174 and automatically selects a free nearby port if another application occupies it. It prints the selected address and reuses a running Docker installation's address. Always launch using the shortcut rather than a saved browser URL. A separately running development instance has its own database; a fresh Docker database does not automatically copy that instance's inventory.

1. Run `Repair-Docker-Windows.bat` and accept the Windows Administrator prompt. It enables WSL and Virtual Machine Platform if missing, and enables hypervisor startup only if the current boot configuration explicitly says Off. It does not restart Windows or delete Docker data.
2. Save your work, restart Windows, then open Docker Desktop. Wait until its engine is running. If virtualization is disabled in BIOS, enable it there first. Troubleshooting: https://learn.microsoft.com/en-us/windows/wsl/troubleshooting
3. Extract this project to a permanent folder, then run `Start-Sardar-Pharmacy.bat`. First launch downloads/builds Docker images and can take several minutes. A desktop shortcut opens the application in an Edge/Chrome app window.
4. Use that desktop shortcut daily. Unchanged source reuses existing images. Twenty seconds is a target for a ready Docker engine, not a guarantee for initial builds, Windows cold starts or slow hardware.

A fresh installation uses an empty medicine/bill database and the configured initial accounts. Existing installations retain their named Docker database volume. Never run `docker compose down -v`, delete Docker volumes, or use a factory reset to update. Keep one installation folder and one running installation per PC.

Sending the source ZIP through WhatsApp does not send your database. A laptop that has NEVER run this Docker project starts empty. If your brother already ran an older version on that laptop, the existing Docker database is deliberately retained, including old medicines and bills. Downloading a new ZIP is an update, not a fresh-data reset. Use a verified backup and a separately managed fresh installation if you need a different business database; do not erase the existing volume to demonstrate the application.

Initial accounts on a fresh database: Admin `aheerdawood014@gmail.com`, Pharmacist `mlksardar6@gmail.com`, Customer `aheerraza0@gmail.com`. Their initial password is `Dawood@@5786`; change passwords after setup. Startup never resets an existing account password.

## Correcting saved bills

Every bill committed in New Bill is saved and updates stock and financial reports.
For an already saved bill, Admin can use **Delete bill** in daily/monthly/yearly bill details and type `DELETE`. The bill is removed from sales and customer history, stock is restored to its original batches, and an approval/audit snapshot remains. Bills with return/refund history are protected. This is intended for mistakenly recorded or test sales; use Return / Refund for an actual customer refund.

Pharmacist uses the bill's deletion-request button. Nothing is removed until Admin approves in **Deletion Requests**; rejection keeps the bill. Successful approval performs the same stock restoration. All deletion changes are atomic, so a failure does not partially delete a bill or restore only some stock.

## Updating your brother's laptop

For a Git-cloned installation, `Update-Sardar-Pharmacy.bat` pulls published changes with fast-forward protection, refuses to overwrite local source edits, and starts the updated build. Git must be installed for this method. Changes must first be published to GitHub to be available there.

For a downloaded ZIP, download the latest project again and copy the source into the SAME existing installation folder. Preserve `.env`, `server/backups`, `server/uploads`, `server/job-data`, `server/logs` and `backup-exports`. Run `Start-Sardar-Pharmacy.bat`; changed source triggers a rebuild. Do not keep using the shortcut pointing to an older folder. Docker-served application HTML now revalidates its browser cache.

Before updating, create and verify a backup from Operations, save a copy outside this PC, and separately copy uploaded images. Keeping backups on the same disk does not protect against that disk failing. No software can guarantee zero crashes or zero data loss.

## Medicine defaults

Only medicine name and positive purchase cost per pack are required. Blank optional fields use: one unit per pack, zero stock, sale price equal to purchase cost per unit, no expiry, and empty manufacturer/rack. Supplied invalid optional numbers/dates are rejected instead of silently changing stock. Add stock and a sale price before billing that item when appropriate.

## Offline daily operation

After the first successful Docker build, daily login, inventory, Excel import/export, billing, returns, profit reports and local backups work without internet. Docker Desktop and the application must still be running. The frontend uses local assets/system fonts and English OCR language data is installed with the backend dependencies. Label images are served through the same local application address.

Docker enables `OFFLINE_MODE=true`: email/cloud image uploads are skipped; in-app notifications remain available. Sending emails (including email password recovery), downloading updates and the first image/dependency downloads require internet. A source ZIP is not a prebuilt air-gapped installer.

Database records persist in the `pharmadesk_mongo_data` Docker volume. Images and backups persist in the installation's host folders. Keep both the Docker volume and those folders; do not delete volumes or factory-reset Docker during updates. Keep verified backup copies outside this PC to recover from disk/PC failure.

`npm run test:docker` uses a separate internal-only Docker network with no internet access. It verifies fresh accounts, frontend/API access, discounted sale profit, partial-refund profit and stock isolation, then container restart persistence. It removes only its uniquely named test storage.
