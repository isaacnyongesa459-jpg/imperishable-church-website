# Three-Currency Donation Outcomes

- [x] Frankfurter integration retrieves KES/USD/INR rates for all six directions, caches them, displays the exchange-rate date, labels them as indicative reference rates, and fails gracefully.
- [x] Donation UI lets visitors select KES, USD, or INR, enter an amount, and see all three equivalents update responsively with `Intl.NumberFormat`.
- [x] M-PESA remains KES-only and continues using the existing Daraja callback and verification flow.
- [x] PayPal Live remains the only card/wallet gateway, charges USD, converts donor-selected KES or INR through a server-side Frankfurter rate, and verifies the captured USD amount before completion.
- [x] Donation persistence stores original amount/currency, converted payment amount/currency, exchange rate/date, provider, transaction reference, and verified status without deleting historical records.
- [x] Paystack frontend, routes, webhooks, environment documentation, and active totals are removed while unrelated M-PESA, PayPal, church-admin, and historical database records remain intact.
- [x] Existing website branding, responsive behavior, navigation, admin access, and non-donation pages remain unchanged.
