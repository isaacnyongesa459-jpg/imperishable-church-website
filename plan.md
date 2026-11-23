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
