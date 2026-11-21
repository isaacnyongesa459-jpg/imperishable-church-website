# Imperishable Crown Website Upgrade — Outcome Checklist

## Delivered increment — localized CMS foundation

- [x] Added ordered migration `002_multilingual_cms_content.sql` that extends the existing `church_content` table, preserves/backfills its legacy About row, and adds locale, page/section, HTTPS image URL plus alternative text, ordering, publication, updater, and lookup-index fields without dropping existing content.
- [x] Added a permission-protected website-content editor and list/upsert API using the existing `content:manage` capability. Drafts are absent from public APIs; writes validate page/section keys, supported locale, lengths, HTTPS image URLs and required alt text, display order, and explicit publish state, and audit metadata without storing the section copy in the audit event.
- [x] Added a published-only public content API with per-section English fallback across the ten existing locale codes; connected Home `hero`/`story` and About `main`/`history` bindings through `textContent`, preserving static fallback copy and HTTPS-only CMS images.
- [x] Verified 14 backend unit tests, JavaScript syntax, whitespace checks, and migration/publication/upsert behavior against a disposable local PostgreSQL database; no Render/production database or live payment was used.

## Verified existing foundation to preserve

- [x] The existing project is an HTML/CSS/JavaScript public website with eight current HTML entries, ten locale catalogs, shared site behavior, a PWA manifest/service worker, and a separate Node.js/Express backend using PostgreSQL.
- [x] The public static pages remain hosted separately from the backend; protected admin pages and admin data operations are served by the backend, not treated as secure static GitHub Pages content.
- [x] Existing public pages, church branding, responsive behavior, service schedules, contact information, current content APIs, admin access, existing PostgreSQL records, and multilingual selector/runtime are identified for preservation rather than replacement.
- [x] Existing M-PESA STK Push, Daraja callback, donation status and verified-record flow, and PayPal Live order/capture verification are identified and must remain intact; existing donations count as completed only after provider verification.
- [x] Existing PostgreSQL tables and admin modules include church content, announcements, leaders, services, events, contact messages, gallery, members, attendance, expenses, ministries, financial categories, activity logs, donation providers, reports, and dashboard statistics. Existing features are to be extended, not duplicated unnecessarily.

## 1. Public site and content-managed pages

- [ ] Maintain and improve public pages for Home, About Us, Church Leadership, Ministries, Services, Events, Sermons, Gallery, Prayer Requests, Financial Transparency, Donate, and Contact Us.
- [ ] Include a professional navigation bar, responsive mobile hamburger menu, professional footer, church logo and branding, attractive homepage hero, church service schedules, social media links, clear calls to action, and professional animations/transitions.
- [ ] Keep the website responsive/mobile-friendly, secure, accessible, and professionally designed; use Poppins typography, suitable church imagery, professional spacing, and a coherent color scheme while preserving the existing church identity and functionality.
- [ ] Administrators can change homepage headings/descriptions, upload/replace hero images, change homepage banners, add promotional announcements, and manage homepage sections without hand-editing HTML, CSS, or JavaScript.
- [ ] Administrators can upload, replace, and delete images; add image captions/descriptions; organize images into categories; and publish/unpublish images.
- [ ] Administrators can add videos through supported uploads or video URLs; edit titles/descriptions; replace/delete video content; organize video categories; and manage sermon and church-event videos.
- [ ] Administrators can edit church history, mission/vision, leadership (including adding/removing leaders), ministry descriptions, service schedules, announcements, events, sermons, testimonials, and contact information.
- [ ] Every manageable frontend section is connected to the backend/database; administrators' published changes appear automatically on the public website; content intended for management is not permanently hardcoded as the only source of truth.
- [ ] Public data APIs expose only published/approved records; draft, unpublished, private, or permission-restricted information is never exposed by hiding it only in client code.

## 2. Authenticated administration, dashboard, and activity history

- [ ] Provide secure backend-served admin login and dashboard routes, including `/admin/login` and `/admin/dashboard`, with authentication and server-enforced role-based access control.
- [ ] Dashboard overview displays total donations received, total recorded expenses, calculated financial balance, number of prayer requests, upcoming church events, published sermons, total website content items, and recent administrative activities; each metric respects the viewer's permissions.
- [ ] Dashboard management sections cover Overview, Website Content, Homepage Editor, Media Library, Photo Gallery, Video Management, Sermon Management, Events Management, Leadership Management, Ministries Management, Announcements, Prayer Requests, Donations, Expenses, Financial Reports, User Management, Activity Logs, and Website Settings.
- [ ] Dashboard is responsive and usable on computers and mobile phones.
- [ ] Authorized administrators can manage content and media through protected UI/API rather than modifying source files.
- [ ] Administrative actions, including sensitive access and financial/prayer changes, are traceable in activity/audit records; deletes affecting financial records retain an audit trail.

## 3. Public financial transparency and reporting

- [ ] Add a dedicated public Financial Transparency page that displays approved total income, total expenditure, calculated available balance, monthly income, monthly expenditure, and annual financial summaries.
- [ ] Support approved financial income categories for general church contributions, tithes and offerings, building fund, missions and outreach, special fundraising campaigns, and other approved income categories.
- [ ] Support approved expense categories for church operations, utilities, maintenance, ministry activities, outreach programmes, administrative expenses, and other approved expenditure categories.
- [ ] Provide approved income/expenditure charts, monthly summaries, annual reports, transaction tables, downloadable PDF reports, and fundraising progress indicators.
- [ ] Only approved/published financial information appears publicly. Never expose private donor details, M-PESA credentials, transaction secrets, receipts or confidential financial information.
- [ ] Clearly label accounting totals/balances as calculated from recorded activity and distinguish them from verified bank or M-PESA balances.
- [ ] Treasurer/authorized financial administrators can record income and expenses; edit financial entries; delete entries with an audit trail; categorize transactions; add descriptions; attach supporting documents/receipts; select reporting periods; generate reports; and publish/unpublish reports.
- [ ] Financial reports are accurate, traceable, and auditable. Count only completed and provider-verified donations as received income; exclude failed, pending, cancelled, and unverified attempts; prevent duplicate recognition of a donation; preserve existing donation records.

## 4. Private prayer requests and testimonies

- [ ] Add a public Prayer Requests page/form with optional full name, optional email, optional phone, prayer request category, request description, anonymous-submission option, confidentiality preference, and consent to be contacted when contact details are supplied.
- [ ] Provide categories Family, Health, Financial needs, Spiritual growth, Employment, Education, Marriage, and Other.
- [ ] Prayer requests remain private by default. Never publish a request or personal information without explicit permission; do not expose submissions through public listings, search, or API responses.
- [ ] Administrators/authorized prayer-team members can view, search, and filter requests; assign requests to prayer-team members; change status; mark requests pending, being prayed for, or answered; respond privately when contact details/consent allow; and archive/delete requests.
- [ ] Prayer Team Members can access only requests assigned to them, subject to permissions; sensitive prayer-request access and changes are audited.
- [ ] Visitors may voluntarily submit testimonies of answered prayers; publication requires explicit permission and is not implied by a prayer request.

## 5. Existing donations and payment integrations

- [ ] Preserve existing Safaricom Daraja M-PESA integration and do not break the donation form, STK Push, donation-status checking, M-PESA callback processing, donation records, or authorized-admin donation history.
- [ ] Connect successful/verified donations to financial management without recording failed or pending payments as received income; prevent duplicate transaction recording.
- [ ] Keep all M-PESA credentials and payment secrets in server-side environment configuration, never frontend JavaScript or public GitHub files.
- [ ] Keep the existing professional donation experience and support existing PayPal donation behavior without altering the M-PESA payment contract; consider international card donations only as a future extension and do not disrupt M-PESA.

## 6. Sermons, livestream, gallery, and video

- [ ] Public sermon library lets visitors browse previous sermons, watch sermon videos, listen to audio sermons, search/filter by preacher/topic/date, view descriptions, and access associated Bible references.
- [ ] Administrators can upload sermons or embed videos from supported external platforms and manage sermon metadata/publication state.
- [ ] Provide a livestream section whose live service link is editable by administrators and display a clear message when the church is not currently streaming.
- [ ] Public gallery/video pages show only published media and support appropriate categories/captions; secure media storage and upload validation protect files and unpublished content.

## 7. Events and announcements

- [ ] Administrators can create/edit events, upload posters, set event dates/times and locations, publish/unpublish events, and manage registrations where needed.
- [ ] Public website displays upcoming events and previous events, with a church calendar.
- [ ] Announcements are manageable and publishable by authorized administrators; only published announcements appear publicly.

## 8. User roles and permissions

- [ ] Super Administrator has full control of the website, administrators, settings, content, and financial systems.
- [ ] Pastor can manage sermons, announcements, church information, and assigned prayer requests.
- [ ] Treasurer can manage income, expenses, donations, and financial reports.
- [ ] Media Administrator can manage images, videos, sermons, and website media content.
- [ ] Prayer Team Member can access only prayer requests assigned to them, subject to permissions.
- [ ] Ordinary administrators cannot access sensitive financial or user information without authorization; every role restriction is enforced server-side on APIs and admin views.

## 9. Security, privacy, and operational integrity

- [ ] Implement secure authentication, password hashing, session management, role-based authorization, server-side input validation, SQL-injection protection, XSS protection, CSRF protection where applicable, rate limiting, secure file-upload validation/size limits, environment-managed secrets, and audit logs.
- [ ] Never expose API keys, database passwords, M-PESA secrets, private configuration, or other credentials in frontend code or public GitHub repositories.
- [ ] Maintain database backups and a documented recovery/migration approach; do not run destructive production migrations without a reviewed backup/rollback path.
- [ ] Protect prayer requests, donor/contact details, member data, financial source records, private receipts, and unpublished media from unauthorized access; publish only expressly approved information.
- [ ] Use additive, versioned PostgreSQL migrations with suitable primary keys, foreign keys, timestamps, indexes, and constraints for admin users, roles/permissions, pages/content, media, gallery, videos/sermons, events, announcements, ministries, leadership, prayer requests/assignments, donations, financial income, expenses, reports, and activity logs. Keep donation and financial records consistent and retain existing historical records.

## 10. Existing stack, delivery, and completion discipline

- [ ] Preserve the existing technology stack wherever possible: HTML5/CSS3/JavaScript public frontend, Node.js/Express backend, PostgreSQL database, existing payment integrations, and appropriate secure media storage.
- [ ] Use REST APIs between the frontend, protected admin dashboard, and backend; keep frontend, backend, database logic, migrations, and configuration organized.
- [ ] Continue building on the existing Imperishable Crown project; do not start from scratch, discard existing files, redesign unrelated pages unnecessarily, duplicate working features, or remove working functionality for convenience.
- [ ] Inspect affected existing code/schema/integration before changes, implement incrementally, preserve working M-PESA integration, and explain each delivered file's path, purpose, and relationship to existing components.
- [ ] Add no unnecessary frameworks/dependencies. Do not claim a feature works unless its backend, database, storage integration, permissions, and relevant configuration are implemented.
- [ ] Test each major implemented feature using an isolated test database and non-live/mock payment paths; preserve production data and never create a real donation during tests.
- [ ] Native/human review of church copy, public financial disclosures, and privacy language is required before production publication where appropriate.
