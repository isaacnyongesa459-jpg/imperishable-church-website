# Imperishable Crown Website Upgrade Plan

## Goal and scope

Incrementally evolve the existing Imperishable Crown Bible Baptist Church website into a responsive, accessible, content-managed platform with protected administration, public financial transparency, private prayer-request handling, and dynamic sermons, media, events, and announcements. Preserve the existing public site, multilingual runtime, service worker, current branding, admin routes, historical records, and working M-PESA Daraja and PayPal flows. Do not rebuild the application or expose credentials, donor details, prayer submissions, or unpublished information.

This is a substantial multi-release upgrade. Implement and validate each phase separately; do not claim a feature is complete until its frontend, backend, persistence, authorization, and relevant deployment/configuration needs are connected. Existing deployments use GitHub Pages for static public pages and Render for the Express/PostgreSQL backend. The static host cannot safely hold a database connection or protected admin data; dynamic public reads and all privileged operations must use the HTTPS backend.

## Architecture found in the repository

- Public site: static HTML, CSS, and JavaScript at the repository root; eight current HTML entry pages, a PWA manifest/service worker, and ten static translation catalogs. Current public pages include home, about, services, events, leadership, contact, donate, and splash/welcome.
- API/admin/payment service: `mpesa-backend/server.js` is an Express application using `pg`, and `mpesa-backend/admin-views.js` contains the backend-served admin views. The README identifies Render as its deployment host. Existing API routes include public content, announcements, leaders, services, events, home, gallery, contact messages, M-PESA, PayPal, and admin data operations.
- Database: PostgreSQL. Existing tables include donation-provider records, church content, announcements, leaders, services, events, contact messages, gallery, members, attendance, expenses, ministries, financial categories, and admin activity logs. Schema initialization currently lives in `server.js`; additive, ordered, reversible where practical migration files should replace ad-hoc schema growth for new capabilities without deleting historical rows.
- Admin: backend-served sign-in and protected sections already exist. Current login uses deployment environment credentials and signed HTTP-only session cookies, with origin checks and an in-memory login-attempt limit. Existing admin sections cover dashboard, members, attendance, expenses, reports, ministries, announcements, events, donations, contact messages, and gallery. Existing authorization is a single administrator gate rather than role/permission-based access. Preserve and incrementally upgrade it rather than creating a second admin system.
- Payments: verified M-PESA callback handling and PayPal order/capture verification are already implemented. Completed donation-provider records are the authoritative source for received digital donations; pending or failed payment attempts must never count as income. Keep all payment credentials server-side and maintain idempotency for callbacks/captures.
- Media: the backend already depends on Cloudinary and Multer, but the current scope needs verification of which media operations are implemented and which credentials/configuration are available before enabling uploads. Uploaded binary files must use approved durable media storage, with metadata and publication state in PostgreSQL.
- Existing gaps to address: no dedicated public sermons, gallery, prayer-request, or financial-transparency pages; no private prayer-request workflow; no systematic content editor for every manageable page section; no explicit RBAC/user management across roles; and current financial entries/reports need a traceable public-report publication model and explicit reconciliation rules.

## Implementation approach and dependencies

1. Keep the public client dependency-light: existing HTML/CSS/JavaScript pages and progressively enhanced scripts. Continue locale detection/selector behavior and translate new static interface strings through the existing catalog system. Add new public route entries to `manus-routes.json` and preserve responsive navigation, footer, accessibility, and the church's recognizable dark green, warm gold, paper, and photographic identity.
2. Keep the existing Express/PostgreSQL backend and payment provider code. Extract new API responsibilities into small route/service modules only where this can be done without destabilizing the current payment and admin endpoints. Use validated request schemas, parameterized SQL, explicit permission middleware, consistent JSON error handling, and additive PostgreSQL migrations with indexes, foreign keys, timestamps, and suitable constraints.
3. Put editable public content in PostgreSQL with draft/published states and explicit fields for page sections, content, media metadata, event dates, sermon metadata, and livestream settings. Public APIs return only published and explicitly public fields. Admin edits persist through protected API endpoints and become visible on public pages after publication.
4. Keep financial reporting derived and traceable: verified completed donations are imported/referenced once; manually recorded income and expense entries are distinct; unique source references prevent duplicate donation recognition; edits/deletes create audit events. Published reports are curated snapshots/period summaries, never an unrestricted dump of source records. Label a calculated accounting balance as calculated, not as a bank or M-PESA balance.
5. Keep prayer requests private by default. Store contact/consent fields separately from the request where practical, expose no public listing endpoint, scope reads/assignments to authorized prayer-team roles, audit sensitive access and changes, and never publish a request or testimony without explicit permission.
6. Use existing Cloudinary/Multer dependencies for validated image/video uploads if configuration is available; store files outside the app container and retain only durable URLs/identifiers and metadata in PostgreSQL. If Cloudinary configuration or credentials are unavailable, implement secure URL-based media management first and document uploads as configuration-blocked instead of pretending they work.
7. Preserve deployment separation: GitHub Pages serves the static frontend, Render serves the backend and PostgreSQL connection. Configure CORS only for the intended website/admin origins, keep all secret values in Render's secret environment, and avoid exposing environment contents in Git, HTML, or browser bundles. Do not run production database migrations or real payments as tests; test migrations against an isolated test database and payment behavior with mocks/sandbox contracts.

## Phased delivery

### Phase 1 — Foundation, schema, authorization, and auditability

- Inventory current schemas, handlers, rendered admin pages, data fields, and production deployment assumptions before changing them.
- Add explicit migration/version tracking and additive schema for admin users, roles, permissions, user-role assignments, content revisions/publication status, prayer requests and assignments, sermons/videos, and published financial reports, as appropriate after confirming existing tables and field overlap.
- Migrate from one environment-defined administrator gate to database-backed users with securely hashed passwords, session identity, role-based authorization, server-side validation, login throttling, and audited administrator actions. Preserve a safe bootstrap path for the existing owner account and protect backward compatibility during cutover.
- Define roles and least-privilege rules: Super Administrator has full control; Pastor manages church information, sermons, announcements, and assigned prayer requests; Treasurer manages donations, income, expenses, and reports; Media Administrator manages media, gallery, and sermons; Prayer Team Member can access only assigned prayer requests. Ordinary administrators cannot access restricted financial/user data.
- Review CSRF/origin controls, security headers, session invalidation and expiry, rate limits, upload validation, input/output encoding, and backup/restore procedures. Do not weaken the existing payment callback or session cookie security.

### Phase 2 — Content management and dynamic public pages

- Extend existing content/admin features rather than duplicating them. Provide admin editing for homepage headings/descriptions, hero/banner images, promotional announcements, ordered homepage sections, church history, mission/vision, leadership, ministries, service schedules, announcements, events, contact information, testimonials, and website settings.
- Provide media metadata management: upload/replace/delete images, captions/descriptions, categories, and publish/unpublish controls. Add video URL/upload records, title/description/category, replace/delete operations, and sermon/event classification.
- Add protected admin forms and REST endpoints for sermons and livestream configuration; keep public lists/search/filter restricted to published records.
- Update public pages to fetch published CMS records and render them safely. Maintain current fallback content for outages during migration, then retire duplicated hard-coded content only after the database-backed replacement is verified. New content changes must appear after publication without source edits.
- Keep existing admin views usable and responsive; add audit history for management changes.

### Phase 3 — Events, sermons, media library, and public routes

- Add public pages/routes for Ministries, Sermons, Gallery, Prayer Requests, and Financial Transparency, while maintaining all current pages and navigation behavior.
- Public sermon library: browse/search/filter published sermons by preacher, topic, and date; show descriptions, Bible references, audio/video and supported external embeds. Add a livestream area with an editable link and a clear not-streaming state.
- Events: create/edit/publish/unpublish events with date/time, location, poster, and optional registration; show upcoming and previous events and a calendar view.
- Gallery: show only published media with captions/categories; private/unpublished content remains inaccessible via public endpoints.
- Preserve responsive layouts, semantic HTML, keyboard access, reduced-motion preferences, useful empty/loading/error states, metadata, and existing multilingual controls across new routes.

### Phase 4 — Private prayer request system

- Add a public form with optional full name, email, and phone; request category (Family, Health, Financial needs, Spiritual growth, Employment, Education, Marriage, Other); request description; anonymous option; confidentiality preference; consent to be contacted when details are supplied; and a clear privacy explanation.
- Validate and rate-limit submissions server-side, use anti-abuse controls that do not leak submitted content, and return a minimal acknowledgement. Requests are private by default and never appear on public pages or in public search/API results.
- Provide authorized admin/prayer-team search/filter, assignment, private response where consent/contact details allow, status transitions (pending, being prayed for, answered), archive/delete actions with audit history, and strict assignment-based access for Prayer Team Members.
- Offer voluntary testimony submission as a separate flow. Require explicit publication permission before any testimony becomes public; do not assume permission from the initial request.

### Phase 5 — Financial transparency, accounting and reports

- Add a public Financial Transparency page that reads only explicitly published summaries and approved transaction detail. Display total income, expenditure, calculated available balance, monthly income/expenditure, annual summaries, income/expense categories, charts, monthly/annual reports, approved transaction tables, downloadable PDF reports, and fundraising progress where a campaign target is configured.
- Keep public disclosure configurable and aggregated by default; never expose private donor details, phone/email, provider credentials, transaction secrets, unpublished records, receipts, or confidential narratives. Clearly label the result as a calculated accounting balance, not a verified bank/M-PESA balance.
- Add Treasurer-authorized workflows to record/edit/categorize income and expenses, descriptions, reporting period, approved supporting documents/receipts, publish/unpublish reports, and generate traceable summaries. Deletion requires a retained audit trail; prefer reversal/voiding for posted accounting entries where appropriate.
- Include completed, verified M-PESA/PayPal donations exactly once as received income; exclude pending, failed, canceled, or unverified donations. Preserve donor/payment records and current donation behavior. Reconcile using stable provider transaction references and database constraints to prevent duplicates.

### Phase 6 — Consolidated dashboard, operations, and hardening

- Extend the overview to show total completed donations, recorded expenses, calculated balance, prayer-request count, upcoming events, published sermons, website content count, and recent administrative activity, with each metric scoped to the viewer's permissions.
- Provide dashboard sections for Overview, Website Content, Homepage Editor, Media Library, Photo Gallery, Video Management, Sermon Management, Events Management, Leadership Management, Ministries Management, Announcements, Prayer Requests, Donations, Expenses, Financial Reports, User Management, Activity Logs, and Website Settings; hide and server-deny functions outside each user's permissions.
- Improve small-screen dashboard navigation and forms. Document role setup, backup/recovery, migration order, upload configuration, environment variable names (never values), database reporting semantics, and release/rollback procedures.
- Run repository-level checks and feature-specific tests. Verify APIs and rendered pages using a non-production database/test configuration; test payment callback/capture processing using fixtures/mocks and idempotency assertions, never live transactions. Review authorization with positive and negative role cases and verify no private financial/prayer payload is public.

## Project structure and responsibilities

- Root `*.html`, `*.css`, and `*.js`: current public pages and shared browser behavior. Add new public route files and page scripts/styles incrementally; reuse `site.js`, `i18n.js`, shared design tokens, and existing navigation/footer patterns.
- `locales/*/translation.json`: existing static translations; add keys for new interfaces consistently across the ten catalogs.
- `manus-routes.json`: complete public-page route manifest, kept synchronized as new routes are added.
- `mpesa-backend/server.js`: existing server bootstrap and stable routes during early migrations; gradually mount route modules without changing endpoint contracts for donations.
- `mpesa-backend/cms-content.js` and `admin-content.html`: localized public content reads, role-protected CMS listing/upserts, and the backend-served editor; current bindings cover only Home and About while the broader page inventory remains in scope.
- `mpesa-backend/admin-views.js`: current backend-served protected admin UI; retain the same origin and session model while expanding sections/forms.
- `mpesa-backend/routes/`: proposed REST routes grouped by auth/users, content, media, events/sermons, prayer, finance/reports, and existing payments where extraction is safe.
- `mpesa-backend/services/`: proposed business logic for permissions, content publication, finance aggregation, media storage, and payment-to-ledger reconciliation.
- `mpesa-backend/migrations/`: ordered PostgreSQL schema/data migrations with safe rollback notes; no destructive table replacement for existing records.
- `mpesa-backend/test/`: API, migration, authorization, privacy, and mocked-payment tests against an isolated test database/configuration.
- `mpesa-backend/README.md` and `.env.example`: deployment, migration, security, and configuration documentation using variable names only.

## Design direction

- Preserve and refine the existing church identity: quiet editorial warmth, dark evergreen, warm gold, soft paper backgrounds, real church/community photography, and clear layouts. Respect the supplied request for Poppins typography, using a legible Poppins family for navigation, body text, and dashboard controls; retain the existing display serif only as a restrained accent if it supports the current brand rather than competing with it.
- Core principles: trustworthy, welcoming, calm, readable, and transparent. Avoid flashy patterns around donations, prayer, or financial data.
- Color philosophy: evergreen signals rootedness and trust; gold marks invitations and important actions; light warm neutrals keep long content and reports readable. Keep status meanings distinguishable without relying on color alone.
- Layout paradigm: editorial, section-led pages with varied left-aligned content and contextual calls to action; dashboard uses a compact information hierarchy with clear mobile navigation rather than forcing public-site marketing layouts into admin workflows.
- Signature elements: restrained gold rule/eyebrow labels; photographic church-life panels with accessible captions; carefully typeset service/report cards with clear “published,” “private,” and “calculated” labels.
- Interaction philosophy: publication state is explicit and previewable; sensitive workflows confirm intent and explain consequences; forms show progress, validation, success, and recoverable errors without exposing private details.
- Animation: preserve existing transitions; use short, subtle entrance and focus transitions only, honor reduced-motion preferences, and avoid animation on sensitive content or financial metrics.
- Typography system: Poppins for body, forms, navigation, and data; existing Playfair Display only for selected editorial display headings; maintain readable line lengths, strong contrast, and responsive type scaling.
- Brand essence: a rooted, Scripture-centered church community serving Kitale through worship, care, and transparent stewardship; personality: welcoming, faithful, accountable.
- Brand voice: clear, pastoral, and respectful. Examples: “Find your next step in the life of our church.” “Every published figure is a calculated summary of recorded, verified activity.”
- Wordmark/logo: preserve the existing Imperishable Crown church mark and wordmark; do not invent a replacement. Use the supplied church imagery in the project and add image assets only where they have a specific page role.
- Signature brand color: the current warm church gold `#b88a50`, balanced with the existing dark green palette.

## Dependencies and material constraints

- Preserve current runtime dependencies unless a specific feature requires a justified addition. Express, `pg`, Cloudinary, and Multer are already present in the backend manifest; inspect actual upload paths and versions before reuse. The frontend currently has no build/test package scripts, so prefer browser-native modules and add only focused test tooling if needed.
- A PostgreSQL connection and Render environment are required for the existing API. Testing must use an isolated database; current production data may include live donations and private member/contact records.
- Cloudinary/object-storage uploads require privately configured provider credentials at the backend and durable storage policy. Do not assume those secrets are already configured or commit them.
- Backend administration and public dynamic data remain on Render; static pages remain on GitHub Pages. Admin content must not be moved into public static files or rely on client-side hiding for authorization.
- New deployment/release actions must preserve the existing callback URL, environment variables, origin allowlists, donation endpoints, and database rows. Do not publish or run destructive migrations without a reviewed migration and verified backup/rollback path.
