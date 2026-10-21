# Pack pricing and counted stock at the counter

Open **New Bill** and add a medicine. Enter its **Sale price / pack** and **Tablets / units in one pack**. The screen divides these to show the rate per tablet/unit. Choose Tablets / units or Whole packs. Whole packs multiplies the entered pack count by units per pack before billing and stock deduction. Fractional packs are rejected. A bottle, tube or single injection uses one unit per individually sold item.

For example, pack sale price PKR 300 and 10 tablets gives PKR 30 per tablet. Selling five tablets bills PKR 150 and removes five units. The backend independently calculates this division; an invalid pack count or price cannot be posted.

Each invoice line shows **Stock before sale** and **After sale**. To correct a physical count, edit the always-visible **Counted stock before sale** field, then choose **Save stock**. The audit reason is recorded automatically as Physical count at billing counter. A count of 30 followed by a sale of five leaves 25 units. The correction is saved immediately, even if you later cancel the bill, and appears in stock adjustment/audit history. Save or undo the correction before posting the bill.

**Refresh stock** refreshes both the catalog and selected invoice lines. If another transaction changed stock after it was loaded, the correction is rejected with a refresh message rather than overwriting that transaction. Zero-stock medicines can be selected for a count correction, but cannot be billed until sufficient stock is saved. Expired stock remains blocked. Refunds restore only the original medicine/batch allocations.

Pack sale pricing is specific to the bill. Existing purchase costs, inventory pack settings and previous bills retain their stored values. Profit continues to use the recorded unit purchase costs of the batches sold; correct any inaccurate imported purchase costs or pack settings in inventory before relying on profit reports.

Add/Edit Medicine takes purchase and sale prices per pack, converts sale price to the stored per-unit value, and previews sale per unit plus profit per unit and pack. Existing medicines are converted back to pack price for editing; imports retain their existing per-unit sale format. Profit Details shows net average profit per unit and its equivalent at the current inventory pack size, including in its Excel export. Historical bill cost snapshots are retained.

Excel template and inventory export now use Sale price per pack (PKR). The importer converts this to stored per-unit sale price. Explicit legacy per-unit headers and internal price values retain their old meaning. Only name and positive purchase pack cost are required; blank units default to 1, stock to 0, sale pack price to purchase pack cost, and expiry/manufacturer/rack stay blank. A row containing both nonblank pack and unit sale prices is rejected to avoid ambiguity. Expiry parsing is unchanged.
