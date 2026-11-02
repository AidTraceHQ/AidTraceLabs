# Security Policy

## Reporting a vulnerability

Please do not report exploitable vulnerabilities in a public issue. Use the repository's **Security** tab and **Report a vulnerability** option to send a private report. If private reporting is unavailable, contact the repository owner, [@nazteeemba](https://github.com/nazteeemba), privately through GitHub.

Include the affected component, impact, reproduction conditions, and any safe proof needed to validate the report. Do not include real wallet secrets, live beneficiary information, or other people's credentials. We will acknowledge reports as capacity allows; no response or remediation timeline is guaranteed.

## Scope

Security reports are especially relevant to:

- Wallet challenge signing, signature validation, sessions, CSRF, origins, and logout-everywhere.
- Server-side authorization, role changes, record edits/voids, and admin routes.
- Stellar transaction verification, network selection, and mismatch handling.
- Beneficiary consent, public data projection, pseudonym generation, and secret handling.
- SQL access, migrations, rate limits, audit records, and deployment configuration.

Do not test against a live deployment or third-party wallet without permission. Use a local environment or a dedicated test database and Stellar testnet.

## Supported versions

Only the current default branch is covered by this policy. No deployed service or service-level response commitment is represented here.
