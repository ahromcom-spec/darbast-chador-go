# Architecture Decisions
- Use `openPrintWindow` for order and statement printing: run native print in the disposable tab, release the preview dialog on print start, and close/focus back on print completion so app interaction is not stranded.
- Share compact date markup and column-layout CSS through `statementPrintLayout` across statement preview, print and PDF to keep presentation consistent without changing billing.

- Compute statement financial summaries with `statementTotals` using uncapped receipts; refresh through scoped RLS realtime subscriptions plus visible-page reconciliation so cost changes retain credit and never truncate payments.

- Detect «اجرای داربست بدون اجناس» only through `isScaffoldingNoMaterials`; this keeps invoice and workflow branching consistent across legacy and current orders.
- Renewal/repair operational ownership stays in `order_id`; financial ownership uses `COALESCE(billing_order_id, order_id)` through `orderChargeBilling`, so separation never breaks dates, media or part links.
- Create charge-separated orders only through the manager-authorized atomic `transfer_order_charges` RPC; expose full order and collection UI, keep zero base price and suppress duplicate initial-installation automation. Synchronize their rental period from financially owned approved renewals.
- Resolve invoice customer identity through the order-scoped `get_order_customer_identity` RPC with snapshot fallbacks; restricted profile access must not erase inherited identity or expose unrelated customers.
- Read customer and manager daily activity through `get_order_report_activity`: canonical report rows preserve all modules and edits; legacy logs are fallback only, with server-side order access checks and no personnel/global notes.
- Delete empty closed statements only through the manager-authorized `delete_empty_closed_statement` RPC; count all linked orders and retain statements with cheque or payment-submission history to protect financial records.