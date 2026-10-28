# Architecture Decisions

- Detect «اجرای داربست بدون اجناس» only through `isScaffoldingNoMaterials`; this keeps invoice and workflow branching consistent across legacy and current orders.
- Renewal/repair operational ownership stays in `order_id`; financial ownership uses `COALESCE(billing_order_id, order_id)` through `orderChargeBilling`, so separation never breaks dates, media or part links.
- Create charge-separated orders only through the manager-authorized atomic `transfer_order_charges` RPC; billing-only orders have zero base price and no physical-order automation to prevent duplicate billing and execution.