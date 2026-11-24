# Three-Currency Donation Integration Plan

## Scope

Extend the existing Imperishable Crown donation page and Node/PostgreSQL backend without rebuilding unrelated pages. Support KES, USD, and INR reference-rate conversions through Frankfurter, retain M-PESA for KES payments and PayPal Live for USD settlement, and remove Paystack from active frontend/backend flows while preserving historical records.

## Implementation

- Add a backend Frankfurter rate client for all six requested currency pairs with a short in-memory cache, rate dates, indicative-rate labeling, and graceful failures.
- Add a public rates endpoint used by the donation page; the server remains the source of truth for conversion used before PayPal order creation.
- Update the donation UI with a currency selector, amount input, all-three-currency equivalents, rate date/status, and PayPal amount conversion. M-PESA remains KES-only.
- Update PayPal order creation to accept the donor’s original amount/currency, retrieve the server-side rate, convert to USD, and verify the captured USD amount before recording completion.
- Add durable original/payment currency, exchange rate/date, provider, and payment amount fields to existing donation records through additive startup migrations. Preserve historical Paystack rows but remove Paystack routes, frontend, environment documentation, and active aggregation.
- Keep the current church branding and responsive layout.

## Project structure

- `donate.html`, `donate.js`, `site.css`: public donation UI and browser interactions.
- `mpesa-backend/server.js`: Express API, Frankfurter cache, M-PESA/PayPal verification, PostgreSQL initialization, admin donation reporting.
- `mpesa-backend/.env.example`, `README.md`: deployment configuration and operational documentation.

## Design

- Movement: calm editorial church-giving interface.
- Core principles: trustworthy, readable, restrained, mobile-first.
- Color philosophy: preserve the existing dark green, warm gold, and paper palette to make financial information feel clear and pastoral rather than transactional.
- Layout paradigm: a stacked giving story with the conversion panel acting as the bridge between donor intent and payment action.
- Signature elements: gold eyebrow labels, dark-green confirmation card, and compact indicative-rate note.
- Interaction philosophy: change one input and make every equivalent update immediately; distinguish reference estimates from confirmed payments.
- Animation: no distracting motion; use existing transitions only.
- Typography: existing DM Sans for controls and Playfair Display for values/headings.
- Brand essence: a transparent, welcoming church giving experience; trustworthy, warm, clear.
- Brand voice: “Give with a joyful heart.” and “Your generosity supports the Gospel ministry.”
- Signature brand color: warm church gold `#b88a50`.

## Fixed church location and weather

The homepage uses one central `window.CHURCH_CONFIG` in `site.js` with the permanent church latitude `1.233251`, longitude `34.936605`, country Kenya, currency KES, and timezone `Africa/Nairobi`. The local clock and date use `Intl.DateTimeFormat` with that timezone, never the visitor’s device timezone. The weather panel calls the exact Open-Meteo forecast URL for those coordinates, refreshes every ten minutes, and shows a graceful unavailable state if the provider cannot be reached. No browser geolocation API is used.

The complete widget is rendered once on `contact.html`, at the bottom of the contact content immediately before the footer, beside the existing live church map/location block. It uses a responsive two-column layout that stacks on small screens; the previous homepage and service-strip copies are removed so the live widget is not duplicated.

## Requested public integrations

The contact page exposes only the supplied YouTube channel, Facebook profile, and Instagram profile. Google Maps uses official Maps URLs for a named church-place search and driving navigation to the permanent church coordinates, alongside the existing embedded map. No additional social links or visitor-location API are introduced.


# Children Sponsorship Programme Implementation

## Scope and architecture
Extend the existing static church website and Node/Express/PostgreSQL backend without replacing pages or touching the M-Pesa/Daraja payment flow. Public pages use the current HTML/CSS/vanilla-JavaScript setup and existing green, gold and paper palette. The backend retains the existing administrator session and PostgreSQL connection. No additional database is introduced.

## Implementation
- Add `children-sponsorship.html`, `children-sponsorship.css` and `children-sponsorship.js`. The shared top navigation has the requested eight-item order; keep the existing donation page reachable through its footer and programme giving link. The directory fetches only an explicit public-field allowlist from the backend and shows neutral empty states rather than inventing children or real-looking sponsor identities.
- Add `mpesa-backend/children-sponsors.js` for additive PostgreSQL tables (`sponsors`, `sponsored_children`, `sponsorships`, and an audit log), 30 clearly marked inactive sponsor placeholders, public consent-filtered queries, admin-only CRUD, assignment/reassignment history, statistics, and protected media routes. Enforce one active sponsor per child while allowing one sponsor to support multiple children.
- Add `mpesa-backend/children-admin-view.js` and integrate it as an authenticated section in the existing backend-served dashboard. Reuse the current `requireAdmin` and `requireAdminOrigin` middleware; do not serve the management UI or sensitive child data through static GitHub Pages.
- Reuse current `multer` and `cloudinary` dependencies for max-5-MB image uploads, validate actual file signatures, and store images using Cloudinary authenticated delivery. Image read routes proxy private assets after verifying admin authorization or (for the public directory) an approved, consented profile. Cloudinary environment credentials remain server-only and optional until uploads are configured.
- Update navigation links, `manus-routes.json`, service-worker precache/version, backend documentation, and these outcomes while retaining existing donation work.

## Safeguarding and public disclosure
Do not collect exact birth dates, addresses, school locations, telephone numbers or sensitive family histories in public profiles. Keep child and sponsor image references private at rest. Only profiles explicitly marked public and consented are returned by the public endpoint; public images additionally require photo consent. Sponsorship changes, archiving and deactivation retain prior relationship records in PostgreSQL.

## Design
Continue the site’s existing calm editorial church style: dark green, warm gold and paper colors, Playfair Display/DM Sans hierarchy, a restrained hero illustration and profile placeholders (not fabricated photographs), responsive cards, keyboard-accessible forms and reduced-motion support. The brand promise is dignified practical care; microcopy emphasizes consent, privacy and a safe route to inquire.


# Authenticated Multi-Page Church Administration Plan

## Scope and preservation constraints

Upgrade the existing Express-served admin at `mpesa-backend/server.js` into independent protected page documents, while leaving the static public site, PostgreSQL records, M-Pesa Daraja initiation/callback/reconciliation, PayPal processing, Cloudinary storage, and already-working admin CRUD behavior in place. No admin documents or private child/member/donor data will be moved to GitHub Pages. Use additive, idempotent PostgreSQL schema changes only; this workspace has no connection to the production database, so implementation validation must not perform writes to a live database.

The existing integrated modules map as follows: Dashboard; Donations (existing M-Pesa/PayPal records); Finances (existing expenses and financial reports); Events; Announcements; Services; Leadership; Ministries; Sponsorships; Members; Attendance (retained as its own page because it is an existing navigation feature omitted from the new requested list); Messages; Gallery. Existing attendance forms, reports, uploads, consent gates, and public content APIs must remain functional. New database-backed modules are Sermons, Administrator accounts/roles, and Settings (editing the existing public About record plus per-administrator preferences). Do not seed fictional sermons, accounts beyond the configured bootstrap owner, site settings, children, or other records.

## Implementation architecture

- Serve each HTML document from the Express backend under a fixed allowlist, with a canonical route for each module and a server-side page-authentication/authorization guard. Unauthenticated page requests redirect to `/admin/login`; unsupported paths return 404 and unauthorized roles receive 403. Preserve old route aliases by redirecting to their corresponding page, not by restoring the one-document hide/show dashboard.
- Add `mpesa-backend/admin-pages/` for the 16 independent HTML page documents, `mpesa-backend/admin-assets/css/` for shared and page-specific styling, and `mpesa-backend/admin-assets/js/` for the shared shell plus one module script per page. Each document includes only its own module markup and script, while sharing branded navigation/header assets. Sidebar links are real protected backend routes.
- Preserve current database-backed endpoints and connect existing page functionality to those same endpoints. The Donations page reads existing M-Pesa and PayPal records without changing payment state. Finances composes the existing expense and financial-report APIs. Services/Leadership use their existing tables and public GET endpoints, with new authenticated CRUD routes where management is currently missing. Sermons use a new additive PostgreSQL table and authenticated CRUD endpoints. Settings use the existing `church_content` About record and a per-admin preferences column/table; no secret or payment configuration is exposed in the UI.
- Introduce an additive administrator-user schema and a bootstrap migration that imports only the existing environment-configured admin identity as the initial Owner, hashing its password with Node's built-in `crypto.scrypt`. Do not log or return hashes or raw passwords. Preserve the signed, HttpOnly, Secure, host-only cookie and eight-hour session behavior. New accounts require owner authorization, role assignment, strong passwords, and active-state controls. Load the current account/role server-side on requests so disabled or demoted accounts lose access immediately.
- Use least-privilege role defaults: Owner (all modules and user/role/settings management); Administrator (routine church operations but no user/role administration); Finance Manager (donations and finances); Content Manager (events, announcements, sermons, services, leadership, ministries and gallery); Pastoral Care (members, attendance, messages and sponsorships). Protect every data/API route on the server, not only by hiding navigation. The dashboard exposes only non-identifying aggregate summaries to operational roles.
- Add new services/leadership/sermons/settings/users routers in focused backend modules; retain existing API paths for working features. Validate writes, use parameterized queries, CSRF/origin checks on mutations, soft archive/deactivation where records have history, and Cloudinary for uploadable media only when its existing server-only credentials are configured. Sponsorship consent and child-protection rules remain authoritative.
- Update backend documentation to describe pages, permissions, migration behavior, new configuration/initial-owner behavior, and upload prerequisites. Preserve existing root plans/TODO items. Keep the church's emerald, white/ivory and subtle gold visual language.

## Project structure

- `mpesa-backend/server.js`: existing Express server, payment integrations, schema startup, authentication/session boundary and protected route mounting.
- `mpesa-backend/children-sponsors.js` and `children-admin-view.js`: existing safeguarded sponsorship APIs and records; integrate into a standalone sponsorship page without replacing their logic.
- `mpesa-backend/admin-pages/admin-*.html`: one independently served HTML document per requested admin module, plus the retained attendance module.
- `mpesa-backend/admin-assets/css/admin-global.css` and page CSS: responsive navigation, header, cards, forms, tables, accessibility and page-specific layout.
- `mpesa-backend/admin-assets/js/admin-global.js` and page scripts: authenticated shell, shared status/loading states, and feature-specific API/data interactions.
- `mpesa-backend/admin-modules.js`: authenticated CRUD and role-aware APIs for new sermon, service, leadership, settings, gallery-upload and message-triage behavior.
- Existing public `*.html`, CSS/JS, donation endpoints, and M-Pesa/PayPal handlers remain in place.

## Design

Continue the user's specified premium emerald-and-gold church identity rather than introducing another style. Use a refined editorial administration workspace with warm ivory page canvas, clean white data surfaces, deep emerald navigation and primary actions, and gold as a restrained accent for status/active-page cues. Core principles are clarity, trustworthy financial presentation, privacy by default, and accessible responsive behavior. Use a persistent collapsible sidebar on desktop and a keyboard-operable slide-out drawer on mobile; page titles, breadcrumbs, administrator avatar/identity, notifications, relevant search, local date/time, and appropriate actions share a consistent header. Favor tabular-nums for amounts, compact readable tables with mobile overflow handling, and real empty/loading/error/success states. Motion is limited to brief drawer/hover/focus transitions and respects reduced-motion settings. Reuse the site's DM Sans and Playfair Display where already available; keep UI copy concise, specific, and calm. Brand essence: an orderly, trustworthy church office for staff with different responsibilities; clear, dignified, secure. Signature color: the existing deep emerald, complemented by the site's warm church gold `#b88a50`.

## Validation and delivery constraints

Use static/syntax checks and inspect endpoint/page mappings without connecting to or mutating production PostgreSQL. Confirm payment source remains untouched except where necessary to add independent admin authorization around existing read APIs. Browser-facing admin pages must return private/no-store headers and use only real backend/database/storage data. Commit and push the completed change to the existing `origin/main` because the user explicitly requested GitHub delivery; the push may trigger the repository's configured deployment, but this task does not independently change deployment configuration or claim a production database migration has run.


# Holy Bible Reader — External Scripture Architecture
## Scope and non-negotiable data boundary
Add a distinct `bible.html` page to the current static GitHub Pages church site. Bible books, chapters, verses, translation catalogs, and search results are retrieved on demand from external Bible services through the existing Express service at `mpesa-backend`; never add scripture tables, verse imports, chapter dumps, or translation datasets to PostgreSQL. PostgreSQL remains exclusively under existing functionality. Browser-local IndexedDB may retain only the chapters the reader explicitly chooses to save, and only where the translation's license permits it. Personal bookmarks, notes, reading progress, and preferences stay on the user's browser unless a later authenticated sync feature is explicitly implemented.
## Provider boundary and licensing
Use API.Bible as the primary source when `API_BIBLE_KEY` is configured only on the backend. The server discovers only English and Swahili Bibles made available to that API application, makes requests server-side, and forwards attribution/copyright metadata and FUMS tokens; the reader reports FUMS tokens with the API.Bible JavaScript tracker. Never return the API key to the browser. Use bible-api.com only as a graceful public fallback for public-domain KJV reference, chapter and verse reading. Do not silently switch a selected copyrighted translation to another version. Keyword search depends on API.Bible; return a clear provider-unavailable/configuration state when no compatible search source is available. Require the API operator to verify the specific Kiswahili/English translation license and account plan before enabling it; do not assume NIV or offline redistribution rights. Allow offline saving for verified public-domain KJV chapters only, never bulk-download a complete Bible, and expire browser scripture cache at 30 days or sooner if the source terms demand it.
## Reader behavior and frontend files
Create `bible.html`, `bible.css`, and `bible.js`, preserving the site shell and established emerald/gold/ivory styling. Add a Holy Bible link to each public page's main navigation in the requested sequence and update `manus-routes.json`, service-worker precache/version, and backend deployment documentation. Provide translation selection, book/chapter/passage navigation, previous/next chapter controls, keyword/reference search, responsive loading/error states, adjustable text size, and reading mode. Local browser storage manages notes, bookmarks, highlights, reading position, preferences, and explicitly saved licensed offline chapters. Clearly distinguish study content from scripture; do not generate or invent Scripture text.
## Backend files and operations
Add `mpesa-backend/bible-api.js` as an isolated Express router mounted after the existing CORS middleware. It validates translation IDs and passage/book/chapter/search inputs, calls only fixed trusted provider hosts with an abort timeout, returns provider errors without leaking secrets, and uses a bounded in-memory cache for metadata/content where source terms permit. The module performs no database initialization or PostgreSQL reads/writes. Configure `API_BIBLE_KEY` and any translation access/IDs privately in the existing Render service environment; document that KJV fallback works without a key and API.Bible-only licensed translations/search require an authorized key and appropriate active translation access.
## Visual and interaction design
Continue the live church identity: calm editorial reading surface, warm ivory in light mode, deep green ink, gold scripture-reference accents, and a deliberately quiet reading column. Use the existing DM Sans/Playfair hierarchy, accessible labelled controls, keyboard focus, reduced-motion support, and responsive single-column layout on small screens. Reading-mode changes are local to the Bible view and must not change other site pages.
