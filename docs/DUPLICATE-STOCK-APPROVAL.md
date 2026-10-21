# Admin approval for duplicate medicine deliveries

Manual Add Medicine and Bulk/Excel imports compare active medicine names without case sensitivity. A same-name entry becomes a pending review request, including repeated rows in one file. It does not immediately add stock or create another active medicine. A different manufacturer alone no longer bypasses the name-duplicate check.

On Home or Medicines, open **Medicine review / Admin stock approvals → Review rows**. Admin can choose **Review stock addition**, verify the existing medicine/manufacturer/strength, confirm the delivery's pack size, total tablets/units, purchase cost and expiry, and approve the displayed current + incoming = resulting stock. Existing same-name records require an explicit target choice. A mismatched pack size is blocked until verified/corrected. Missing expiry remains optional, as in medicine entry.

Only an Admin can call the approval endpoint. Pharmacists see the waiting status. Normal Fix & Add remains for correcting a genuinely different medicine name. Discarding a pending request does not increase stock.

The approval transaction adds a delivery batch preserving its cost and expiry, updates only the selected medicine, records a stock adjustment and medicine audit, and resolves the request with the approving user/time and old/added/new stock. Existing purchase lots and default sale price remain intact. Repeated approvals are rejected. If a sale, receipt or another approval changes the stock after the preview was loaded, approval is rejected for fresh review rather than applying the old preview.

Quantities in this approval are total tablets/sellable units: a delivery of one ten-tablet pack must be entered as 10 units. Entered delivery purchase cost remains per pack, divided by its verified units per pack for the batch unit cost.

Validation on 21 October 2026: 73 unit checks passed; strict lint and frontend build passed; 23 enabled database checks passed with no failures/skips, covering manual/bulk duplicates, same-file repeated rows, permissions, single execution, concurrent/stale approvals, per-batch cost/expiry, unchanged unrelated stock, import retries, billing/refunds and temporary-database backup recovery. No business test records were created in the pharmacy database.
