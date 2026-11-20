# Roadmap
- [x] Align single and combined statement employer display with order invoice settings; preserve ownership and financial accounting. Nine tests pass; dialog rendering verified with order 1000502 recorded employer data.
- [ ] Verify employer update end-to-end from management order details to statements — current requesting account redirects away from management; direct dialog rendering verified instead.
- [x] Convert new order videos to SD 480p and first 60 seconds before saving; show notice across order/report upload controls. Two policy tests pass; authenticated MediaUploader selection, processing, upload and download verified with a 65-second file producing 852×480, 60-second MP4. Existing order linkage not exercised; bundled headless Chromium lacks H264 playback support.
- [x] Isolate order/statement printing in the disposable tab, release the preview modal and restore app focus; 3 lifecycle tests and two simulated browser print returns pass with working clicks.
- [ ] Verify native Windows/Edge printing on a real order — unavailable in the headless browser; current account has no orders, so browser verification used the actual statement component with sample data and simulated print/image events.
- [x] Show the order-count number fully on map markers: marker enlarged to 68px, counter reduced and moved outside the clipped photo frame at the bottom corner; rendered close-up and clipping checks confirm the whole number is visible.

- [x] Compact printed statement dates and widen activity descriptions; single and combined A4 tables verified with sample data, no cell overflow, and print windows open correctly.

- [x] Preserve uncapped statement receipts and refresh financial totals automatically; 12 tests pass and statement 6 data confirms 50,000,000 paid with 2,320,000 remaining.
- [ ] Verify statement financial updates through the management UI — blocked because the current account is redirected away from the management page.

- [x] Add confirmed deletion of empty closed statements with server-side order and financial-history safeguards; eligibility tests pass.
- [ ] Verify deletion through the management UI — blocked because the current preview account has no management role.

- [x] Show and verify inherited customer name, code and contact details in separated orders and invoices.

- [x] Make separated renewal/repair orders accessible as independent orders with inherited specifications and correct rental dates.
- [x] Enable collection requests and show collection dates and invoice date rows for separated orders.
- [x] Verify independent-order visibility, rental dates and collection without duplicate billing or installation.

- [x] Design safe separation of selected renewals and repairs into linked independent orders and statements.
- [x] Implement management selection and independent invoice/payment accounting without duplicate charges.
- [x] Verify repeated separation, original settled invoice preservation and independent payments.
- [x] Show order-specific daily activity and report notes below order details for management and customers.
- [x] Verify historical report visibility and order-scoped access.
- [x] Add manager-built custom SMS elements (order/payment/renewal/collection dates and amounts) with live preview; deposit date uses the date chosen at payment registration. 7 tests pass; tab, element buttons and preview verified in browser with a sample element.
- [ ] Verify creating an element and receiving it in a real SMS — the preview account has no manager role, so saving was correctly refused.

- [x] SMS templates per service: general vs service-specific filters, target/exclude services, per-stage service variants, per-service coverage overview, log service filter; sender picks the matching variant. 7 selection tests pass; filters, variant dialog and coverage verified in browser with a temporary variant (removed).
- [ ] Verify creating/saving a service-specific message and a real SMS using it — preview account has no manager role.

- [x] Custom message frames: managers choose stage (12 stages incl. rejection), services, recipients (customer, collaborators, management roles, custom phones), window/delay/amount conditions. 12 rule tests pass; manager UI create/delete and queued-frame preview verified with a blocked test number; no real SMS sent.
- [ ] Verify a real frame delivery to a staff phone — avoided sending live SMS.
- [x] Custom frames for renewals, repairs, discounts, order transfers and collaborators (event person recipient, event variables); 16 ready-made frames added switched off. Rule tests pass; manager UI and server event checks verified with a blocked test number.
- [ ] Verify a real renewal/repair/transfer/collaborator message on a live order — avoided sending live SMS.
- [x] Move custom frames into the customer or «پیامک‌های مدیریت اهرم» tab (renamed from مدیرعامل) with the same editing card plus frame extras; 4 rule tests pass; move, full-editor return and move back verified as site manager.

- [x] Android-style unseen-event badges on pinned home modules and on each tab inside order management, transfers/collaboration, SMS, notifications, contractors, daily reports, bank cards, registration, users and HR; verified with the site manager account (badges appear, opening a tab clears only that tab).
- [x] SMS elements in Persian (e.g. {کد}, {نوع_خدمات}) moved into «المان‌های سفارشی» as editable base elements; {نوع_خدمات} shows service type with subcategory; all saved texts converted. Tests pass; server preview verified for with/without-materials orders; no SMS sent.
