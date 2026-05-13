# Contributing to Domainer

First off, thank you. Domainer is built by and for domain investors — every PR sharpens the tool.

## Ground rules

1. **No paid APIs.** The project's defining promise is "self-hosted, zero recurring cost." Free public services (RDAP bootstrap, public DNS resolvers) are fine. Anything that needs an API key is out, unless it's pluggable and disabled by default.
2. **Small surface area.** Runtime deps live on a short list: `grammy`, `better-sqlite3`, `dotenv`. Adding to it requires a clear justification.
3. **TypeScript strict.** Tame `any`, prefer narrow types, return values over thrown errors when behavior is part of the protocol.
4. **One command, one file.** Each Telegram command group lives under `src/commands/<group>.ts`. Library code goes in `src/lib/`.

## Dev setup

```bash
git clone https://github.com/kwkuh/domainer.git
cd domainer
cp .env.example .env  # paste a BOT_TOKEN from @BotFather
npm install
npm run dev           # hot-reload TS via tsx
```

Use a *separate* bot for development. Don't point your production token at hot-reload — your users will see crashes.

## Project layout

```
src/
├── index.ts          entry point
├── cron.ts           hourly worker: RDAP refresh, alerts
├── lib/              pure modules (db, rdap, dns, score, format)
└── commands/         one file per command group
```

## Submitting a change

1. Open or claim an issue first — even a one-liner — for non-trivial work.
2. Branch from `main`. Name it `feat/...`, `fix/...`, `docs/...`.
3. Write the change. Run `npm run typecheck && npm run build` locally.
4. Open a PR. Fill in the template.
5. CI runs typecheck + build on Node 20 and 22. Both must pass.

## Code style

- 2-space indent, double quotes, trailing commas in multiline literals (the TS compiler is happy with whatever — no Prettier config to avoid bikeshedding).
- Prefer `for…of` over `.forEach` when there's any chance of awaiting.
- Avoid clever abstractions. Domainer is meant to be read end-to-end in under an hour.
- Comments only when the *why* isn't obvious. Don't narrate the *what*.

## Commit messages

Conventional Commits encouraged but not required:
- `feat: /export accepts --tag filter`
- `fix: handle RDAP 422 from Donuts TLDs`
- `docs: clarify ALLOWED_USERS behavior`

## Database changes

Schema lives in `src/lib/db.ts`. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`). If you're altering an existing column, add a new column rather than rewriting — the SQLite file is the user's data, treat it like a forwards-only ledger.

## Reporting security issues

**Do not open public issues for security problems.** Use [GitHub Security Advisories](https://github.com/kwkuh/domainer/security/advisories/new). See [SECURITY.md](SECURITY.md).

## Code of conduct

Be kind. Assume good intent. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
