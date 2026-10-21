# Counter billing validation — 20 October 2026

The dashboard New Bill screen accepts pack selling price and units per pack, calculates unit rates without prematurely rounding, shows stock before/after sale, and supports audited stock corrections before billing.

Checks completed:

- Frontend lint with `--max-warnings 0`: zero errors/warnings.
- Production build, including the actual dashboard/component, passed locally and in Docker.
- 69 unit checks passed (53 backend, 16 frontend). Four database suites are skipped by the default unit command; the relevant upgrades suite was enabled separately.
- Enabled upgrades integration suite: 12 checks passed, zero failures/skips, using a randomly named disposable database. The new counter fixture runs separately from existing cash-report fixtures.
- Exact counter scenario: purchase pack cost 200, stored pack size 10, counted stock 20 corrected to 30, pack sale price 300, five units sold for 150, remaining stock 25; two-unit refund leaves 27. Unrelated medicine stock stays unchanged.
- Backend rejects stale/repeated stock corrections, customer stock changes, invalid/fractional pack sizes and invalid bills without saving a bill or removing stock. A client-supplied unit rate cannot override pack-price division.
- Zero-stock medicine can be read for a count correction and increased before a sale.
- Existing batch allocation/refunds, cash reconciliation, online acceptance-day reporting, deletion approval and backup recovery passed in the enabled suite.
- Browser interaction with the actual invoice-line component verified editable price, units, quantity, correction form, calculated rate, line total and stock remaining. This used a temporary local fixture and wrote no pharmacy records; fixture files were removed afterward.
- Current Docker installation was backed up before rebuilding. All three services became healthy. Medicine/bill record counts remained unchanged.

Pack selling price/size on the bill do not rewrite inventory purchase costs, pack settings or previous bills. Profit uses stored batch unit costs. Existing incorrectly imported costs/settings require inventory correction; this change does not infer historical purchase data.

These are checks of the changed workflows, not a guarantee against every future failure.

## Follow-up: simplified counter and profit display

- Stock count is always visible. An automatic audit reason replaces the reason input; changed counts must still be saved before billing.
- Whole-pack mode validates a positive whole pack count and deducts pack count multiplied by pack size. Fractional packs and insufficient stock are rejected.
- Add/Edit Medicine now accepts sale price per pack and converts it to per-unit storage. Existing saved unit prices are multiplied by stored pack size when editing. Import format remains unchanged.
- Profit Details and its Excel export include net average profit per unit and profit per current-pack equivalent. Saved sale costs and historical profits are not rewritten.
- 70 unit checks passed (53 backend, 17 frontend); frontend lint passed without warnings. The enabled 12-check database suite passed, additionally asserting a full-pack sale and net profit of 10 per unit / 100 per ten-unit pack, after a partial refund.
- Read-only inspection of the user's Dawood example found unitsPerPack=1 and batch purchaseCost=200. The old bill therefore retains its recorded loss; changing only the selling pack size cannot correct historical purchase cost.
