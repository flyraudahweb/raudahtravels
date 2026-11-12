# EHajj API index and integration recommendation

## Contract update from 12 November 2026

The newly supplied `API_Documentation_eHadj_Pilgrims_Products_EN (3).docx` has the same SHA-256 as the original nine-read document. `API_Documentation_eHadj_Pilgrims_Products_EN-1 (1).docx` adds three operations. Its SHA-256 is `07e1277a98f3099de76fa778f1eca9cf1fe197cea7b13d9b0ec323b8fe7e3841`.

The required additions are `GET /api/getAllBanquesAgence`, `GET /api/getAllComptesBancairesAgence` and multipart `POST /api/addPelerin`. All three use `AuthorizationAgenceKey` alone. `addPelerin` creates a pilgrim and their first payment in one provider transaction. It returns the pilgrim ID, payment ID, UUID and remaining balance. The seven existing detailed reads still require a provider JWT; token issuance remains undocumented.

The current admin workspace uses a standalone registration form. Super Admin enters the pilgrim, EHajj package ID and the first payment already received through one of EHajj's documented methods. Currency is entered explicitly for operator review because the API has no currency field. The amount is sent unchanged. Registration uses the agency key alone.

Each registration stores its personal details encrypted, a keyed passport/package fingerprint, a revision token and a durable submission state. A duplicate registration or concurrent submit cannot repeat the provider write. Editing a prepared record requires a fresh confirmation token. Lost responses and interrupted submissions remain available for reconciliation. Recent registrations support recovery after leaving the page.

The workspace operates independently of FlyRaudah bookings, Paystack receipts, the OTA payment queue and wallet credits. It creates an EHajj pilgrim and records the staff-declared first payment. Product access and read permissions remain separate from the Super Admin registration action. Optional group/services tabs are excluded from the current workspace.

The supplied agency key and HTTP base are configured in ignored local environment files. The provider's HTTP endpoint responds, while HTTPS at the same IP fails certificate hostname verification. Personal details and agency credentials require a valid HTTPS provider URL before the connection is activated. The user is asking the provider for that URL and requested deployment with this prerequisite visible.

## Activation

1. Apply [0013_ehajj.sql](../../lib/db/drizzle/0013_ehajj.sql), which creates the connection, grants and independent registration tables. The SQL is additive and idempotent. Existing earlier installations need the new registration table.
2. Configure the provider-approved HTTPS base through EHAJJ_API_BASE_URL and the agency key through EHAJJ_AGENCY_KEY or Super Admin Connection settings. Preserve the deployed SETTINGS_ENCRYPTION_KEY.
3. Enable the connection when its HTTPS URL is ready. Use Register pilgrim to prepare and review the personal and first-payment information before sending. A provider JWT is required only for the detailed record/document reads.
4. Confirm the EHajj package ID, currency and payment classification with the provider. The API has no package-price catalogue, further-installment API, signed booking-update webhook or protected customer document-delivery contract.

Local tests cover independent registration without any local bookings or Paystack records, encrypted drafts, concurrent submissions, stale confirmations, invalid payment details, uncertain outcomes, product access and HTTP activation blocking. Provider writes remain mocked during development.

## Earlier booking to document workflow request

The supplied workflow places the verified FlyRaudah reservation and receipt before any external handoff. Its endpoint image identifies six required interfaces. The image gives method, path and purpose, while the supplied API text specifies the nine existing GET interfaces.

- The requested `POST /api/bookings`, `POST /api/pilgrims` and `POST /api/payments` need provider-confirmed request and response schemas, required identifiers and call order. Confirm amount units, product mapping, idempotency keys and how to recover the outcome of an interrupted request. The handoff is currently shown as awaiting that contract.
- The requested `GET /api/bookings/{id}` and `GET /api/bookings/{id}/documents` need the provider booking identifier, status lifecycle and document access contract. The implemented reads retrieve pilgrim-level metadata through the separately documented `getDocumentsPelerin` route.
- The requested incoming `POST /api/webhooks/booking-updates` needs the event schema, signature algorithm, signing-key provisioning, timestamp rules and stable event IDs. Those details are needed to bind updates and documents to the right reservation and account.

Customer-facing EHajj delivery depends on an explicit link from a provider pilgrim or booking to the correct FlyRaudah customer. Confirm the approved file hosts and file-access method before exposing downloads or sending email or WhatsApp notifications. For this phase, staff can review reported attachments and use FlyRaudah's existing visa and ticket management workflow.

Reviewed 5 November 2026 from the supplied `API_Documentation_eHadj_Pilgrims_Products_EN (1).docx`. The user-facing name is EHajj; the document calls the service **eHadj 2.0 mobile API, version 2.0.0**. Source SHA-256: `2ffc46c0636dc8cbb637a580d263ac71b52c7c6591d52897ee30e06f27986237`.

## Original recommendation from 5 November

Add a dedicated **EHajj** area to the existing admin, initially for read-only agency operations. Super Admin should control the connection and grants. Selected administrators and staff can receive narrower permissions and product/edition assignments. Keep EHajj records identifiable as external records, and introduce explicit links to Raudah records only after review.

The supplied API documents nine GET endpoints. It does not document creation or editing of pilgrims, products, bookings, payments, visas, accommodation allocations or groups. The larger EHajj platform may support those functions in its own interface; that capability is not established by this API document. This integration cannot be presented as a working booking/write integration on the current evidence.

The implementation was tested against disposable PostgreSQL and mocked provider responses. A live provider connection still requires activation and credentials. The original document is unchanged, and the examples below describe the supplied contract.

## Indexed sources

- [Machine-readable endpoint and field index](EHAJJ_API_INDEX.json): all nine operations, their authentication, paths, response-shape notes and 128 observed field paths from the examples. Field types are observations from examples, not complete validation schemas or proven nullability rules. Sample personal values and credentials are not copied.
- Source document sections: Introduction; How it works; API list and its nine Web service subsections. All nine endpoint tables and successful response examples were inspected.
- Raw extraction is local and ignored in `scratch/ehajj-docs/`; it is not application data or a production integration.

## Authentication and environment

The only base URL provided is the development example `http://localhost/ehadj/api_mobile/public`. `API-LINK` in each operation refers to that base; an operation adds `/api/...`. The attachment's `example.com` link is also an example, not a verified production endpoint.

Every call requires the `AuthorizationAgenceKey` HTTP header. `getAllProduitsAgence` and `getPelerinsByProduit` require that key only. The other seven require both that key and `Authorization: Bearer <JWT>`.

JWT issuance, refresh, expiry, revocation and principal scope are unspecified. Verify whether the provider issues an agency-wide token or pilgrim-specific tokens before enabling detail views. The implementation accepts an operator-supplied EHajj JWT for these seven calls.

Keep upstream credentials encrypted on the Raudah server, with masked settings and explicit rotation. Browsers and mobile clients authenticate to Raudah; the Raudah backend applies permissions and calls EHajj. Do not expose the agency key in a customer browser, mobile binary, URL or downloadable report. Use an approved HTTPS provider origin and validate connection configuration server-side.

## Endpoint index

Every route below is a GET and is appended to `API-LINK`.

### 1 Agency products

`/api/getAllProduitsAgence` — agency key only, no path parameters. Returns active products with `id_produit`, label, description, `HADJ`/`OUMRAH` activity and edition year. Only active products (`status = 1`) are described.

There are no product-level prices, departure dates, capacity, hotel inventory or reservation guarantees in this response. An EHajj product is an agency programme/edition reference, not automatically a complete Raudah sellable package.

### 2 Pilgrims registered for a product

`/api/getPelerinsByProduit/{id_produit}` — agency key only; positive integer product ID. Returns pilgrim identity, product/package names, nationality, photo, status and financial fields `tarif_fixe`, `amount_paid`, `rest`.

The document states the product must belong to the agency. A 404 can mean an unavailable product or no pilgrims. Do not expose the roster publicly because no JWT is required upstream. Raudah must authenticate every caller and redact financial fields where finance access is absent.

### 3 Pilgrim profile

`/api/getPelerinDetails/{id_pelerin}` — agency key plus JWT; positive integer pilgrim ID. Contains civil identity, contact details, package/tariff, passport, assigned hotel and QR/sticker information.

The sample includes ethnicity, education, occupation, family status, passport/visa identifiers and contact numbers. Store and display only what the approved operational workflow needs. Mask passport identifiers and restrict documents/QR payloads separately. Finance restrictions apply to profile tariffs as well as the dedicated payment endpoint.

### 4 Payments and balances

`/api/getPelerinVersement/{id_pelerin}` — agency key plus JWT. Contains due, paid and remaining totals, with `versements` history. History is described as covering payments and refunds; only a payment example is supplied.

Currency, minor-versus-major amount units, decimal rules and refund sign/status conventions are absent. Keep these as labelled external balances until clarified. Do not credit a Raudah wallet, settle Paystack transactions, mark a local booking paid or issue a refund from these records.

### 5 Assigned trip

`/api/getVoyagePelerin/{id_pelerin}` — agency key plus JWT. Returns an existing trip's outbound/return dates, airport strings and airlines. One-way/round-trip is described; only the round-trip response is illustrated. Time zones and missing return-field behaviour need confirmation.

This is not a flight search, fare quote, ticket purchase or airline cancellation API.

### 6 Assigned accommodation

`/api/getHebergementPelerin/{id_pelerin}` — agency key plus JWT. Provides Makkah and Madinah assignments: building, floor, room, dates, catering and roommates.

Each city can be an object or the literal string `Non attribue`. Normalize this into an explicit unassigned state. Roommate information is personal data and needs its own visibility policy. The response is not bookable hotel inventory.

### 7 Additional services

`/api/getPelerinServiceAdd/{id_pelerin}` — agency key plus JWT. Lists subscribed services and their financial totals/status. It can instead return `data` as the French no-services message string, not an array.

Normalize the documented empty state; hide service money when finance permission is absent. No endpoint for buying or modifying services is documented.

### 8 Group membership

`/api/getPelerinGroupe/{id_pelerin}` — agency key plus JWT. Returns a group and members with names, photos and agency labels. Without a group, `groupe` and `membres_groupe` become message strings rather than object/array values.

Confirm whether a group can include other agencies and what Raudah is authorised to show. The sample member data does not provide a stable member/agency identifier suitable for reliable scoping. Default to restricted group-roster visibility until this is resolved; do not infer ownership from a display name.

### 9 Documents

`/api/getDocumentsPelerin/{id_pelerin}` — agency key plus JWT. Returns document IDs, descriptions and attachment links. The source names the controller `PelerinController::getListDocumentsPelerin`, while the external route remains `getDocumentsPelerin`.

Upload, deletion, attachment authentication, link expiry and empty attachment rules are not documented. Examples use HTTP placeholder hosts. Serve actual files only through an authorised document workflow using approved HTTPS hosts, redirect controls and file-size/type checks; never create an arbitrary URL proxy.

## Admin information architecture

Proposed sidebar entry: **EHajj** at `/admin/ehajj`.

The initial screen should show connection state, agency, selected edition/product and last successful fetch. Drill down from **Products → Pilgrims → Pilgrim record**. The record has Profile, Travel, Accommodation, Additional services, Group, Payments and Documents tabs. Restrict each tab and each sensitive field using the permissions below.

Keep **Connection settings**, **Sync history** and **Access assignments** separate from routine record browsing. There is no global group-list, hotel inventory, payment-list or dashboard-statistics endpoint in this document; any overview must be derived from authorised fetched records and labelled accordingly. Avoid suggesting those are independent upstream APIs.

Do not display edit, reserve, pay or refund actions on this integration until the relevant write contracts are supplied and tested. A link to Raudah's existing booking workflow can remain a separate action with an explicit record mapping.

## Proposed access policy

Start denied for everyone except Super Admin. Treat these names as proposed capabilities, not existing implemented permissions:

- `ehajj.access`: enter the console and view agency product metadata.
- `ehajj.pilgrims.read`: roster and necessary basic profile/contact fields for assigned records.
- `ehajj.operations.read`: assigned trip/accommodation/group/service descriptions; exclude protected financial and document fields.
- `ehajj.finance.read`: external tariffs, payment/refund history and service balances for assigned records.
- `ehajj.documents.read`: passport/visa details, authorised document previews and sensitive QR data where needed.
- `ehajj.documents.download`: retrieve attachments; require document-read permission too.
- `ehajj.export`: approved bulk exports; also require the permissions for every exported field.
- `ehajj.sync`: request a controlled refresh for assigned products; does not grant access to every fetched field.
- `ehajj.manage`: configure connections and access; additionally require the actual `super_admin` role.

Use role presets to make administration simple: operations staff get roster/travel access; finance staff get the minimal identity fields plus financial access; document officers get identity/document access. Ordinary administrators receive only explicit EHajj grants. Agents and customers receive no EHajj access in phase one.

Add record scope by connection/agency and assigned product or edition. An edition name alone is not a unique stable ID, so resolve assignments against known product IDs. An endpoint request must validate its ID, the caller's active account, capability and record scope before fetching or returning any data. Apply the same rules to exports, cached responses and file downloads. UI hiding alone is insufficient.

Only Super Admin should grant/revoke the reserved `ehajj.*` permissions. Guard this rule in staff creation and permission-update endpoints, not just the new EHajj screen. Log settings changes, grants, syncs, sensitive document access and exports without logging raw secrets or passport payloads.

## Fit with the current codebase

`lib/db/src/schema/agents.ts` already stores string-based staff permissions in `staffPermissionsTable`. `pages/admin/AdminStaff.tsx` edits permission lists, and `AdminConsole.tsx` uses those permissions to filter staff navigation. The current frontend gives ordinary administrators a broader menu than staff; therefore EHajj must have an explicit permission gate for administrators as well.

The existing `routes/admin.ts` router guard admits active admin/super-admin/staff accounts. It is not, by itself, a check for the proposed EHajj capabilities or assigned records. Its account-permission administration currently permits administrators; protect EHajj-specific grants from ordinary administrators if adopting the policy above.

Recommended future code boundaries are an EHajj server client/normalizer, a dedicated authenticated router, scoped cache/sync storage, external-to-local ID mapping, and a frontend module. Reuse the existing authentication, encrypted settings patterns and staff-management UI. Do not add EHajj keys to the OTA search API keys or reuse supplier credentials from Duffel.

## Data and synchronization design

Keep provider IDs namespaced by connection, for example `(connection_id, external_pilgrim_id)` and `(connection_id, external_product_id)`. Product, local package, pilgrim, profile and booking IDs represent different entities; link them explicitly. Do not merge records by name or email alone.

Use a read-only projection first. Keep EHajj payment snapshots separate from Raudah's payment ledger and wallets. Do not import source prices into NGN calculations until currency and unit semantics are known. External data should show source and fetch timestamp; a fetch timestamp does not prove when the source record last changed.

Load products/rosters first, then fetch each pilgrim's detail tabs on demand. Fetching all seven detail endpoints for every pilgrim creates a large request fan-out. Set caching, concurrency, timeouts and refresh frequency after confirming provider limits. No webhook, pagination, delta cursor or updated-since contract appears in the document. Do not infer deletion from an absent active product, empty response, timeout or token failure.

Validate HTTP status and the JSON `code`/`data` envelope; do not assume any JSON response is success. Preserve errors separately from legitimate no-data states. Normalize French status strings and mixed object/array/message values while retaining the source meaning. Translate display labels without changing raw identifiers.

## Questions for EHajj before implementation

1. What are the production and sandbox HTTPS URLs, and how is an agency key provisioned/rotated?
2. How do we obtain, refresh and revoke JWTs? Are they agency-operator or individual-pilgrim tokens? Can an approved agency integration access all assigned records?
3. What currency, amount units and precision apply? How are refunds, partial payments and adjustments represented?
4. What ownership checks apply to every endpoint? Can groups/rooms include other agencies, and can stable agency/member IDs be returned?
5. What are the request limits, pagination rules, maximum roster sizes, polling expectations and API-change policy?
6. Are there webhooks, modified timestamps or delta exports in a separate contract?
7. How are document links authenticated and expired, and what HTTPS storage hosts/content types are supported?
8. Are there separate create/update/booking/payment/allocation APIs? If so, request their contracts, sandbox and idempotency/status-recovery rules before designing write workflows.

## Recommended implementation phases

First, clarify the connection/token/currency/scope contract and obtain a sandbox. Next, build the protected read-only admin console with normalization and clear external-data labels. Then add controlled record linking, refresh history and permitted reports. Add customer/mobile views only after ownership mapping and field policies are proven. Add bidirectional booking/payment operations only if separately documented and approved.

For acceptance, verify revoked/absent permissions and wrong-product IDs return denied responses; finance fields stay out of non-finance roster/profile/service responses; passport/documents are denied without their grants; token expiry does not look like an empty account; repeat refreshes do not duplicate local financial or booking records; and unexpected upstream strings/files fail safely. Actual provider behaviour remains untested at this stage.
