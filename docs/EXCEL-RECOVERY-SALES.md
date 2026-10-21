# Inventory Excel recovery and sales history

## Medicine inventory

Use **Medicines → Export Excel** (Admin or Pharmacist). A background task exports all active medicines, not just the displayed page or current search.

The `Medicines` worksheet uses the same eight headings and order as the import template: Medicine name, Manufacturer, Expiry date, Purchase cost per pack (PKR), Units per pack, Sale price per pack (PKR), Stock quantity (units), Rack / shelf location. Expiry is readable YYYY-MM-DD text in a wide column. Pack sale price is calculated from the saved unit rate and pack size; importing divides it once.

To recover the basic medicine list in a fresh inventory, open Bulk Medicine Import, select the exported .xlsx, review the preview, and confirm. The importer ignores the Batch reference and Instructions sheets. Existing duplicates are reported for review; this is not a database overwrite. Keep a separate full database backup to recover bills, users, refunds, batch identities/costs, archived medicines and audit history. The Batch reference worksheet retains active-medicine batch data for reference but is not automatically restored by the medicine importer.

## Yearly / custom-period sales

On either staff Home dashboard, below Daily Closing Report, open **Sales history / Yearly Excel report**. Choose This year, Previous year, Last 12 months, or enter any custom From and To dates, both inclusive. For example, 20 October 2026 through 19 October 2027 is a full annual period; choosing 20 October 2027 includes that additional day too.

Totals and monthly summaries are calculated in the database. Bill rows are paginated, 50 at a time. **Download all sales (.xlsx)** includes every matching bill in the range, independent of the visible page, with Monthly totals and Report information worksheets. Export runs in the background and streams records rather than loading all bills into the browser.

Dates use Pakistan business time. Online orders count on acceptance date; pending and rejected orders are excluded. Net sales are billed sales less all recorded refunds on those bills as of report generation. A refund processed later may therefore change a historical sale-period report. This report describes revenue from those sales, not cash collected during the selected period, and is not a restorable bill backup.
