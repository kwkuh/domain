```
$ whois domain

% IANA WHOIS server
% This query returned 1 object

██████╗  ██████╗ ███╗   ███╗ █████╗ ██╗███╗   ██╗
██╔══██╗██╔═══██╗████╗ ████║██╔══██╗██║████╗  ██║
██║  ██║██║   ██║██╔████╔██║███████║██║██╔██╗ ██║
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║██║██║╚██╗██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║██║  ██║██║██║ ╚████║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝

domain:       DOMAIN
status:       ACTIVE
status:       SHIPPING
status:       COLLECTING

registrant:   Kukuh Laksana
country:      ID
url:          https://kukuh.la

source:       WHOIS.KUKUH.LA
```

# 🌐 Domainer — Telegram bot for domain investors

**Open-source Telegram bot for domain portfolio management.** Built for domain investors who want a self-hosted, scriptable control panel for their portfolio — without renting a SaaS.

- **Zero paid APIs.** WHOIS via RDAP (free, IANA bootstrap). DNS via your resolver. Parking detection via NS fingerprints. Scoring is pure local heuristics.
- **Single binary, single file.** Node + SQLite. No Postgres, no Redis, no cloud.
- **Self-hosted.** Run on a $4 VPS, a Raspberry Pi, or your laptop.
- **MIT licensed.**

---

## Features

- 📋 Portfolio CRUD with tags, notes, categories, BIN/buy/floor prices
- 🔍 RDAP-based WHOIS, expiry, registrar, NS, age, status
- ⏰ Expiry reminders (configurable days-before) + automatic alerts
- 🎯 Availability checks + multi-TLD keyword scan (`/check fintech --tlds=com,io,ai`)
- 🏆 Deterministic scoring: brandability, length, vowel ratio, pronounceability, TLD weight, keyword match
- 🔄 Variant generators: typo, plural, singular, hyphen
- 🌐 DNS lookups (A/AAAA/MX/TXT/CNAME/SOA/SPF/DMARC)
- 🅿️ Parking provider detection via NS fingerprints (Sedo, Dan, Afternic, Bodis, ParkingCrew, GoDaddy, …)
- 👀 Watchlist: alert on NS change, status change, expiry approach, becoming available
- 📊 Dashboard: totals, expiring counts, top TLDs/registrars, BIN values, ROI
- 💾 Import/Export CSV / JSON / NDJSON / TXT (just send a file to the bot)
- 🩺 Health check: domains missing BIN/tag/note, expired entries

---

## Quick start

### 1. Get a bot token

Talk to [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → save the token.

### 2. Run with Docker (recommended)

```bash
git clone https://github.com/kwkuh/domain.git
cd domain
cp .env.example .env
# edit .env, paste BOT_TOKEN
docker compose up -d
```

That's it. Open Telegram, find your bot, send `/help`.

### 3. Run from source

Requires Node.js 20+ (or Bun).

```bash
git clone https://github.com/kwkuh/domain.git
cd domain
cp .env.example .env  # set BOT_TOKEN
npm install
npm run build
npm start
```

For dev with hot reload:

```bash
npm run dev
```

### 4. Run with npx (no clone needed)

```bash
BOT_TOKEN=xxx npx @kwkuh/domainer
```

*(After the package is published to npm.)*

---

## Configuration

All via `.env`:

| Variable         | Default                | Description                                                          |
| ---------------- | ---------------------- | -------------------------------------------------------------------- |
| `BOT_TOKEN`      | *(required)*           | Telegram bot token from @BotFather                                   |
| `ALLOWED_USERS`  | *(empty = open)*       | Comma-separated Telegram user IDs allowed to use the bot             |
| `DATA_DIR`       | `./data`               | Where SQLite database is stored                                      |
| `TICK_MINUTES`   | `60`                   | How often the cron worker refreshes RDAP + fires alerts              |
| `RDAP_BOOTSTRAP` | `https://rdap.org`     | RDAP bootstrap URL (override only if you're running a mirror)        |

**Get your Telegram user ID:** message [@userinfobot](https://t.me/userinfobot).

---

## Command reference

Send `/help` to the bot for the full list. Highlights:

```text
/add domain.com --buy=12 --bin=2500 --tag=ai,brandable
/list --expiring=30
/detail domain.com
/whois domain.com
/score domain.com
/check fintech --tlds=com,io,ai,co
/typo tokopedia.com
/upcoming --days=14
/remind domain.com --days=7
/watch domain.com
/dashboard
/export --format=csv
```

Send any `.csv` / `.json` / `.txt` file with one domain per line to bulk import.

---

## Architecture

```
src/
├── index.ts          # entry point, grammY bot setup
├── cron.ts           # hourly worker: RDAP refresh, alerts, watch dispatch
├── lib/
│   ├── db.ts         # SQLite schema + migrations (better-sqlite3)
│   ├── rdap.ts       # RDAP client via rdap.org bootstrap
│   ├── dns.ts        # node:dns wrappers + parking detection
│   ├── score.ts      # deterministic scoring + similarity engine
│   └── format.ts     # output formatting helpers
└── commands/
    ├── help.ts       # /help, /start
    ├── portfolio.ts  # /add /list /detail /remove /pin …
    ├── whois.ts      # /whois /expiry /registrar /ns /check …
    ├── expiry.ts     # /upcoming /expired /renew /remind
    ├── meta.ts       # /tag /note /cost /bin /category
    ├── search.ts     # /find with filter flags
    ├── dashboard.ts  # /dashboard /stats /health
    ├── score.ts      # /score /typo /plural /hyphen
    ├── dns.ts        # /dns /a /mx /spf /dmarc /parking
    ├── watch.ts      # /watch /watchlist /watchns …
    └── io.ts         # /export + document-upload import
```

**Storage**: single SQLite file at `$DATA_DIR/domainer.sqlite`. WAL mode. Back it up by copying the file.

**No external state**: no Redis, no queues. The cron tick is `setInterval` in-process.

---

## Roadmap

- [ ] **Vendor registrar adapters** (plugin folder): Namecheap, Porkbun, Spaceship, Cloudflare, Dynadot
- [ ] **Auction watchers**: ExpiredDomains.net scraper, GoDaddy auctions RSS
- [ ] **Team workspaces** with role-based access (viewer / editor / owner)
- [ ] **Sales pipeline**: `/lead`, `/offer`, `/counter`, `/sold`
- [ ] **Bulk command DSL** (`--filter=tag:premium length<10`)
- [ ] **Web UI** read-only dashboard (optional, same DB)
- [ ] **Inbound offer parser** (forward an email to the bot → auto-extract offer)

---

## Contributing

PRs welcome. The codebase is intentionally small (~1500 LOC) and uses no exotic patterns. Pick something from the roadmap or scratch your own itch.

Code style: TypeScript strict, no runtime deps beyond `grammy`, `better-sqlite3`, `dotenv`. Keep it that way.

---

## Why?

Existing domain managers are either:
- Locked into a single registrar (Namecheap/GoDaddy dashboards)
- Expensive SaaS that ask for your registrar API keys (DomainIQ, Estibot)
- Spreadsheets

This is the open-source middle ground: **your portfolio, your data, your bot.**

---

## License

MIT. See [LICENSE](LICENSE).
