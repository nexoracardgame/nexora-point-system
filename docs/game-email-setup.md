# Game Email Verification

New username/password registrations remain pending until the recipient confirms
the emailed link. Pending registrations do not create a login credential or user.
Existing accounts and Google/LINE sign-in are unchanged.

## Deployment Configuration

Set server-only environment variables in the hosting dashboard:

- `RESEND_API_KEY`: sending API key from Resend. Never commit it or expose it to client code.
- `GAME_MAIL_FROM`: sender address on a verified sending domain, for example `NEXORA <accounts@example.com>`.
- `GAME_PUBLIC_ORIGIN`: canonical HTTPS site origin, currently `https://nexora-point-system.vercel.app`.

Verify the sender domain's DNS records with the mail provider before enabling.
Redeploy after changing environment variables. Missing configuration fails closed
with a clear registration error; it does not claim that an email was sent.

## Verification

1. Register with a real test mailbox through `/game/login`.
2. Confirm the inbox notification contains that address and no login occurs yet.
3. Open the email, click its link, then explicitly confirm on the website.
4. Sign in using the chosen username and password.
5. Confirm that reusing the link fails and an expired link cannot create an account.

Tokens contain 32 cryptographically random bytes; only SHA-256 hashes are stored.
They expire after 30 minutes and are consumed atomically with account creation.
Confirmation uses POST so mail-link scanners do not activate accounts on GET.
Email sending is rate limited by request address and recipient. Failed sends remove
their matching pending token; no password or token is returned to the browser.
Passwords are stored as scrypt hashes. Provider acceptance is not a delivery guarantee;
check spam and provider logs when diagnosing delivery.
