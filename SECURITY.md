# Security policy

## Reporting a vulnerability

Please do not open a public issue. Report privately through GitHub:
**Security → Report a vulnerability** on this repository.

Include what you found, steps to reproduce, and the impact. We aim to acknowledge reports within 3 business days.

## Secrets and personal data

- Never commit secrets or `.env` files; use the `.env.example` in each app as the template.
- The Drupal export under `data/legacy/` contains personal data and must never be committed.
- If a secret is committed by mistake, rotate it immediately, then remove it from history.
