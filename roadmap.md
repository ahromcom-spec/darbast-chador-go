# Roadmap
- [ ] Prevent the app from becoming unresponsive after order/statement printing; verify popup cleanup and dialog release after printing and cancellation.
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