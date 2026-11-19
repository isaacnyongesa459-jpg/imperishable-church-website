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
