# Shared booking, delivery and earnings workflow

Customer and shoot information is entered once in Sale's quick booking form. Select the package and assigned shooting/retouching accounts there. The shared order supplies the customer phone, customer ID, order code, service, package, shoot time and assigned employees everywhere else. Existing web-chat customers are matched by phone so a booking does not create a second customer when the web chat reloads.

## Steps and ownership

1. Sale creates an order. Package price, room, actual shooter account and retoucher account are required. The server rejects duplicate codes, overlapping rooms/shooters and taking another Sale's customer without a transfer. Pending holds with no payment expire after one hour; orders with partial payments are retained for reconciliation.
2. Sale or Sếp records money actually received, with a transaction/receipt reference. At 50% of the package price the booking becomes confirmed and snapshots the current compensation schedule. References cannot be posted twice.
3. The assigned shooter checks the customer in and confirms shooting is finished. This accrues shooting compensation and Sale commission, both pending approval. Merely passing the scheduled date does not complete a linked shoot.
4. The shooter chooses that completed shoot in the original-delivery form, pastes the Drive folder URL and presses send. The app reads image metadata and delivers the folder to the existing customer account. Customer identity and package details cannot be changed on this form; the server derives them from the selected order. Wrong staff and uncompleted shoots are rejected.
5. The customer selects from that delivered manifest, records per-file notes and submits. Editing work belongs to the assigned retoucher. Original folder ID, file IDs, filenames, order ID, round and edit-request ID remain connected.
6. Sending the final result and completing the editing request accrues package retouching compensation (first round only) and per-extra-image compensation. First-round customer fees include 10 free images and 50,000 VND per additional image. Later rounds charge customers 50,000 VND per selected image; staff compensation is a separate configured amount, not the full customer fee.
7. Sếp approves and records staff payouts with a payment reference after the customer has paid the order balance, including additional photo fees. Photographers/retouchers see only their own shooting and editing earnings; they receive no Sale commissions, compensation schedules or other employees' earnings in their API response. Sale sees only their own commission, plus package names/prices needed for booking. Only Sếp sees the complete compensation schedules, all splits, approval states and payout references. An approved payout is not yet paid; marking paid is a record of an actual payment, not a bank-transfer instruction.

Sale chat renders messages returned by the chat API and sends only text written by Sale. There are no canned concept/price claims or local outgoing-message simulations. Booking records creation rather than claiming an SMS or chat message was sent; integrations that are not connected must not show a successful-send notification. A failed chat send keeps the draft and adds no outgoing message.

## Sample schedules requested by the user (2026-10-29)

The same samples are provided for Newborn, Bé lớn, Sinh nhật, Bầu and Gia đình. No sample customers/bookings are created.

| Package | Sample package price | Sale | Shooting | Package editing | Extra editing per image |
|---|---:|---:|---:|---:|---:|
| Cơ bản | 1,500,000 | 5% | 300,000 | 150,000 | 20,000 |
| Tiêu chuẩn | 2,500,000 | 5% | 500,000 | 250,000 | 20,000 |
| Premium | 3,500,000 | 5% | 700,000 | 350,000 | 20,000 |

Sếp edits schedules in “Lịch làm việc & thu nhập”. New versions affect future confirmations; existing order snapshots and previously accrued/paid amounts remain unchanged. Missing schedules produce unknown amounts instead of silently using zero. Sếp may explicitly fill a missing policy on an order; an existing snapshot cannot be replaced. Combined package compensation cannot exceed its package price. Extra-image compensation cannot exceed the 50,000 VND customer charge.

## Storage and recovery

Sale receives a sample 5% of customer payments, including additional editing fees. Package commission is accrued after shooting as pending; each selected request with extraFee > 0 accrues `sale-extra = round(extraFee * rate / 100)` with deterministic request ID. Retries do not duplicate it. Approval/payment requires the entire package plus extra fees to have been received. Shooting and package editing remain fixed amounts; extra editing remains a fixed amount per image, at most 50,000 VND. Existing confirmed policy snapshots are retained.

Public staff demo on Render: **Bản demo nhiều máy (người dùng chốt 2026-10-29) đặt EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF=1; khi studio dùng thật thì bỏ**. Source Drive folders use a server API key and public link sharing as the deliberate privacy exception described in DRIVE-SETUP.md.

`js/workflow-core.js` contains transitions and calculations shared by browser demo and server. `js/workflow.js` uses `/api/workflow` when the existing `editSync` feature is on; it defaults to server sync; ?editSync=0 opts this browser out, ?editSync=1 clears the opt-out. When off it uses `aloha_workflow_v1` in localStorage. The UI states the mode. Browser demo is confined to that browser and is not secure multi-device CRM storage.

Server workflow data uses a separate `studio_workflow` collection in the database configured by `EDIT_REQUESTS_MONGODB_URI` / `EDIT_REQUESTS_DB`. It never uses the chat database. Without that URI it uses RAM and is lost on server restart. The aggregate stores orders, policy versions, ledger entries, payment records, employees and audit events; updates use a revision compare-and-set and a process queue. Concurrent duplicate payments or payouts do not produce duplicate amounts. Staff account metadata in the roster does not create authentication accounts.

Editing and source-album records remain in the edit-request store. The workflow read reconciles committed editing events using deterministic ledger IDs, so retrying after an interrupted cross-store operation does not duplicate earnings. Per-round request references prevent duplicate extra fees; completing an older round does not roll back a newer active round.

For existing automatic extra-photo payments, the client now forwards the QR payment code. The edit API checks the authenticated SePay webhook receipt, ties the code to the order and image count, and records the verified extra payment on the same order exactly once. A client payment-status string alone is not trusted. Legacy requests without a verified code stay in the manual reconciliation path. SePay receipt lookup still uses the pre-existing bounded RAM buffer; that infrastructure must be persisted for recovery across server restarts. Server GOOGLE_DRIVE_API_KEY and a public link-shared folder are required for source import; see DRIVE-SETUP.md.

## Checks

`node _screenshots/test-workflow.js` verifies transitions, percentage Sale commission and fixed worker schedules and snapshots, own-ledger access, repeated rounds, full-payment approval gates and duplicate payout rejection.

`node _screenshots/test-workflow-api.js` verifies the authenticated booking → delivery → edit completion → payout flow, role restrictions, concurrent duplicate receipt/payout attempts and verified SePay posting.

`node _screenshots/test-workflow-ui.js` drives Sale's actual booking form, reloads retained data, checks the assigned worker's shoot and two-field delivery form, verifies separate compensation and Sếp payout, and checks mobile overflow. Drive import is a fixture in browser tests; real Google Drive access has not been tested without the studio's server API key.
