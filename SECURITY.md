# Security Policy

## Supported versions

Until a stable 1.0 release, only the latest `main` branch receives security fixes.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Use [GitHub Security Advisories](https://github.com/kwkuh/domainer/security/advisories/new) to file a private report.

When reporting, please include:

- A description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- The affected version / commit SHA
- Suggested fix, if you have one

You'll get an initial response within **72 hours**. Disclosure happens after a fix is shipped, with credit (unless you prefer anonymity).

## Threat model — quick notes

Domainer is designed to run on your own infrastructure. Key assumptions:

- The Telegram bot token is treated as a secret. **Do not commit `.env`.**
- The SQLite database contains your portfolio metadata. Back it up. Encrypt the disk if your VPS is in a shared environment.
- `ALLOWED_USERS` is the only auth mechanism. Leaving it empty makes the bot public — only do that on a private bot you control.
- RDAP queries leave a network trail. If you're researching sensitive acquisitions, route the bot through a VPN.

## Out of scope

- Telegram-side compromises (a stolen bot token is your responsibility — rotate via @BotFather)
- Self-hosted infrastructure security (your VPS, your firewall, your OS patches)
- Denial-of-service from Telegram API rate limits
