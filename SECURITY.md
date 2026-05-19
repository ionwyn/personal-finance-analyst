# Security Policy

## Supported Versions

This is a private, local-first personal finance application. Security fixes should target the default branch unless a release branch is explicitly maintained.

## Reporting A Vulnerability

Use GitHub private vulnerability reporting when available:

https://github.com/ionwyn/personal-finance-analyst/security/advisories/new

If private reporting is unavailable, contact the repository owner directly before opening a public issue. Do not include secrets, access tokens, account numbers, institution identifiers, transaction details, screenshots with balances, or any other private financial data in public GitHub issues, pull requests, commits, or logs.

## Sensitive Data

This project integrates with financial-data providers and stores linked-account metadata. Treat the following as sensitive:

- Plaid access tokens, item IDs, webhook payloads, and account identifiers.
- SnapTrade user secrets, authorization IDs, holdings, balances, and account identifiers.
- `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, database URLs, and provider credentials.
- Raw transaction descriptions, balances, account names, institution names, and screenshots that reveal personal financial activity.

## Local Development Expectations

- Keep all credentials in `.env` or a local secret manager.
- Use generated demo or sandbox data for screenshots, fixtures, tests, and issues.
- Redact logs before sharing them.
- Rotate credentials immediately if they are committed, pasted into an issue, or exposed in a build log.

## Dependency And Code Security

Dependabot is configured for npm and GitHub Actions updates in `.github/dependabot.yml`. Review dependency updates with extra care when they affect authentication, encryption, Prisma, Plaid, SnapTrade, or server-side request handling.
