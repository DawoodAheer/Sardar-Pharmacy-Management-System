# Windows setup and updates

Docker Desktop must have a working WSL 2 engine. Installing Docker alone is insufficient if Windows reports that its hypervisor is not running.

1. Run `Repair-Docker-Windows.bat` and accept the Windows Administrator prompt. It enables WSL and Virtual Machine Platform if missing, and enables hypervisor startup only if the current boot configuration explicitly says Off. It does not restart Windows or delete Docker data.
2. Save your work, restart Windows, then open Docker Desktop. Wait until its engine is running. If virtualization is disabled in BIOS, enable it there first. Troubleshooting: https://learn.microsoft.com/en-us/windows/wsl/troubleshooting
3. Extract this project to a permanent folder, then run `Start-Sardar-Pharmacy.bat`. First launch downloads/builds Docker images and can take several minutes. A desktop shortcut opens the application in an Edge/Chrome app window.
4. Use that desktop shortcut daily. Unchanged source reuses existing images. Twenty seconds is a target for a ready Docker engine, not a guarantee for initial builds, Windows cold starts or slow hardware.

A fresh installation uses an empty medicine/bill database and the configured initial accounts. Existing installations retain their named Docker database volume. Never run `docker compose down -v`, delete Docker volumes, or use a factory reset to update. Keep one installation folder and one running installation per PC.

## Updating your brother's laptop

For a Git-cloned installation, `Update-Sardar-Pharmacy.bat` pulls published changes with fast-forward protection, refuses to overwrite local source edits, and starts the updated build. Git must be installed for this method. Changes must first be published to GitHub to be available there.

For a downloaded ZIP, download the latest project again and copy the source into the SAME existing installation folder. Preserve `.env`, `server/backups`, `server/uploads`, `server/job-data`, `server/logs` and `backup-exports`. Run `Start-Sardar-Pharmacy.bat`; changed source triggers a rebuild. Do not keep using the shortcut pointing to an older folder. Docker-served application HTML now revalidates its browser cache.

Before updating, create and verify a backup from Operations, save a copy outside this PC, and separately copy uploaded images. Keeping backups on the same disk does not protect against that disk failing. No software can guarantee zero crashes or zero data loss.

## Medicine defaults

Only medicine name and positive purchase cost per pack are required. Blank optional fields use: one unit per pack, zero stock, sale price equal to purchase cost per unit, no expiry, and empty manufacturer/rack. Supplied invalid optional numbers/dates are rejected instead of silently changing stock. Add stock and a sale price before billing that item when appropriate.
