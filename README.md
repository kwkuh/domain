<div align="center">

```
██████╗  ██████╗ ███╗   ███╗ █████╗ ██╗███╗   ██╗███████╗██████╗
██╔══██╗██╔═══██╗████╗ ████║██╔══██╗██║████╗  ██║██╔════╝██╔══██╗
██║  ██║██║   ██║██╔████╔██║███████║██║██╔██╗ ██║█████╗  ██████╔╝
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║██║██║╚██╗██║██╔══╝  ██╔══██╗
██████╔╝╚██████╔╝██║ ╚═╝ ██║██║  ██║██║██║ ╚████║███████╗██║  ██║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
```

# Domainer — Telegram bot for domain investors

**Self-hosted, open-source domain portfolio manager. A free alternative to DomainIQ, Estibot, and NameBio.**

Manage your domain portfolio from Telegram chat: WHOIS lookups via RDAP, expiry alerts, DNS & parking checks, deterministic brandability scoring, watchlist for NS / status / expiry changes, CSV / JSON import & export. Works with any registrar (Namecheap, Porkbun, GoDaddy, Spaceship, Cloudflare, Dynadot, …) because it only reads public registry data — no API keys required.

[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero paid APIs](https://img.shields.io/badge/paid%20APIs-zero-success)](#-features)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/kwkuh/domain-portfolio?style=social)](https://github.com/kwkuh/domain-portfolio/stargazers)

[Quick start](#-quick-start) · [Commands](#-commands) · [Self-hosting](#%EF%B8%8F-self-hosting) · [Why](#-why-domainer) · [Roadmap](#%EF%B8%8F-roadmap) · [Contributing](CONTRIBUTING.md)

</div>

---

> [!NOTE]
> Domainer is in **active early development** (`v0.1.x`). The command surface is stable; the schema and config may still shift. Pin to a tag if you want strict reproducibility.

## ✨ Features

|     | What it does                                                                                       |
| --- | -------------------------------------------------------------------------------------------------- |
| 📋  | Full portfolio CRUD with tags, notes, categories, BIN / buy / floor prices                         |
| 🔍  | RDAP-based WHOIS, expiry, registrar, NS, age, status (free, IANA-blessed bootstrap)                |
| ⏰  | Configurable expiry reminders + automatic alerts via cron worker                                   |
| 🎯  | Availability check + multi-TLD keyword scan (`/check fintech --tlds=com,io,ai,co`)                 |
| 🏆  | Deterministic brandability scoring — length, vowel ratio, pronounceability, TLD weight, keywords  |
| 🔄  | Variant generators: typo / plural / singular / hyphen permutations                                 |
| 🌐  | DNS lookups (A / AAAA / MX / TXT / CNAME / SOA / SPF / DMARC)                                      |
| 🅿️  | Parking provider detection via NS fingerprints (Sedo, Dan, Afternic, Bodis, ParkingCrew, GoDaddy)  |
| 👀  | Watchlist — alert on NS change, status change, expiry approach, becoming available                 |
| 📊  | Dashboard: totals, expiring counts, top TLDs / registrars, BIN values, ROI                         |
| 💾  | Import / export CSV / JSON / NDJSON / TXT — just send the file to the bot                          |
| 🩺  | Health audit — domains missing BIN, tag, or note; expired entries                                  |

---

## 🚀 Quick start

The fastest way is Docker. You'll need a Telegram bot token from [@BotFather](https://t.me/BotFather).

```bash
git clone https://github.com/kwkuh/domain-portfolio.git
cd domain-portfolio
cp .env.example .env       # paste your BOT_TOKEN
docker compose up -d
```

Open Telegram, find your bot, send `/help`. You're in.

<details>
<summary><strong>Other ways to run it</strong></summary>

### From source (Node 20+ or Bun)

```bash
git clone https://github.com/kwkuh/domain-portfolio.git
cd domain-portfolio
cp .env.example .env       # paste your BOT_TOKEN
npm install
npm run build
npm start
```

For hot reload during development:

```bash
npm run dev
```

### One-shot with `npx`

After the package is published to npm:

```bash
BOT_TOKEN=xxx npx @kwkuh/domainer
```

### Pre-built Docker image (GHCR)

```bash
docker run -d \
  --name domainer \
  --restart unless-stopped \
  -e BOT_TOKEN=xxx \
  -v $(pwd)/data:/data \
  ghcr.io/kwkuh/domainer:latest
```

</details>

---

## 💬 Commands

Send `/help` to your bot for the live list. A taste:

```text
/add domain.com --buy=12 --bin=2500 --tag=ai,brandable
/list --expiring=30
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

Send any `.csv` / `.json` / `.txt` file (one domain per line) to bulk import.

<details>
<summary><strong>Full command reference</strong></summary>

**Portfolio** — `/add` `/list` `/detail` `/remove` `/restore` `/purge` `/pin` `/unpin` `/star` `/unstar`

**WHOIS / RDAP** — `/whois` `/expiry` `/registrar` `/ns` `/age` `/available` `/check`

**Expiry & renewals** — `/upcoming` `/expired` `/renew` `/remind`

**Metadata** — `/tag` `/untag` `/tags` `/note` `/notes` `/cost` `/bin` `/floor` `/category`

**Search** — `/find` with `--contains` `--starts-with` `--ends-with` `--length` `--tld` `--tag` `--expiring` `--registrar`

**Scoring** — `/score` `/brandability` `/length` `/vowel-ratio` `/typo` `/plural` `/singular` `/hyphen`

**DNS** — `/dns` `/a` `/aaaa` `/mx` `/txt` `/cname` `/soa` `/spf` `/dmarc` `/parking`

**Watchlist** — `/watch` `/unwatch` `/watchlist` `/watchns` `/watchexpiry` `/watchstatus`

**Dashboard** — `/dashboard` `/stats` `/summary` `/health`

**Import / export** — `/export` + send a `.csv` / `.json` / `.txt` document to import

</details>

---

## ⚙️ Self-hosting

All config via `.env`:

| Variable         | Default              | Description                                                     |
| ---------------- | -------------------- | --------------------------------------------------------------- |
| `BOT_TOKEN`      | _(required)_         | Telegram bot token from @BotFather                              |
| `ALLOWED_USERS`  | _(empty = open)_     | Comma-separated Telegram user IDs allowed to use the bot        |
| `DATA_DIR`       | `./data`             | Where the SQLite database is stored                             |
| `TICK_MINUTES`   | `60`                 | How often the cron worker refreshes RDAP and fires alerts       |
| `RDAP_BOOTSTRAP` | `https://rdap.org`   | RDAP bootstrap URL (override only if you run a mirror)          |

> Get your Telegram user ID from [@userinfobot](https://t.me/userinfobot).

### Backup

Your portfolio is a single SQLite file at `$DATA_DIR/domainer.sqlite` (WAL mode). Copy it. That's the entire backup procedure.

```bash
cp data/domainer.sqlite "backups/domainer-$(date +%F).sqlite"
```

---

## 🧱 Architecture

```mermaid
flowchart LR
    TG[Telegram] <-->|long poll| Bot
    Bot[grammY handler] --> Cmd[command modules]
    Cmd --> DB[(SQLite WAL)]
    Cron[cron worker] --> RDAP[RDAP / rdap.org]
    Cron --> DNS[node:dns]
    Cron --> DB
    Cron -->|alerts| TG
```

```
src/
├── index.ts          entry point — grammY setup + command registry
├── cron.ts           hourly worker: RDAP refresh + alert dispatch
├── lib/
│   ├── db.ts         SQLite schema + migrations (better-sqlite3)
│   ├── rdap.ts       RDAP client with port-43 WHOIS fallback
│   ├── whois.ts      legacy WHOIS over TCP/43 for non-RDAP TLDs
│   ├── dns.ts        node:dns wrappers + parking detection
│   ├── score.ts      deterministic scoring + similarity engine
│   └── format.ts     output formatting helpers
└── commands/
    ├── portfolio.ts  whois.ts  expiry.ts  meta.ts  search.ts
    ├── score.ts      dns.ts    watch.ts   dashboard.ts
    ├── sales.ts      drop.ts   landing.ts history.ts
    └── io.ts         help.ts
```

---

## 🤔 Why Domainer

|                                          | Registrar dashboard | DomainIQ / Estibot SaaS | Spreadsheet | **Domainer** |
| ---------------------------------------- | :-----------------: | :---------------------: | :---------: | :----------: |
| Works across all your registrars         |         ❌          |           ✅            |     ✅      |      ✅      |
| Live WHOIS / expiry / NS monitoring      |         🟡          |           ✅            |     ❌      |      ✅      |
| Brandability scoring                     |         ❌          |           ✅            |     ❌      |      ✅      |
| Watchlist alerts in chat                 |         ❌          |           🟡            |     ❌      |      ✅      |
| Costs nothing per month                  |         ✅          |           ❌            |     ✅      |      ✅      |
| Self-hosted — your data stays yours      |         ❌          |           ❌            |     ✅      |      ✅      |
| Open source, scriptable, hackable        |         ❌          |           ❌            |     🟡      |      ✅      |

Domainer is the open-source middle ground: **your portfolio, your data, your bot, in your pocket.**

---

## 🗺️ Roadmap

- [ ] Vendor registrar adapters (Namecheap, Porkbun, Spaceship, Cloudflare, Dynadot) — plugin folder, disabled by default
- [ ] Auction watchers — ExpiredDomains.net, GoDaddy auctions RSS
- [ ] Team workspaces with role-based access (viewer / editor / owner)
- [ ] Sales pipeline — `/lead`, `/offer`, `/counter`, `/sold`
- [ ] Bulk filter DSL — `/bulk-tag --filter=tag:premium length<10`
- [ ] Read-only web dashboard (same SQLite, optional)
- [ ] Inbound-offer parser — forward an email, auto-extract the offer

Vote with 👍 on [issues](https://github.com/kwkuh/domain-portfolio/issues) or open one.

---

## 👥 Who is Domainer for

- **Domain investors** managing 20 – 5,000 names across multiple registrars who want a single inbox for expiry, NS changes, and offer leads.
- **Indie hackers** sitting on a brandable portfolio they bought at NameSilo / Porkbun / Spaceship and forgot they had.
- **Agencies & resellers** that need a chat-native way to track client portfolios without buying DomainIQ seats.
- **Drop catchers** who want a personal watchlist of expiring names without paying for ExpiredDomains.net Premium.
- **Anyone who hates spreadsheets** more than they hate writing `.env` files.

---

## ❓ FAQ

<details>
<summary><strong>Is Domainer really free? What's the catch?</strong></summary>

Yes. MIT licensed, self-hosted, zero recurring cost. You pay only for whatever box you run it on — a $4 / month VPS, a Raspberry Pi, or your laptop. WHOIS data comes from the public RDAP bootstrap at `rdap.org` (free, IANA-blessed). No API keys, no SaaS subscription.

</details>

<details>
<summary><strong>How does this compare to DomainIQ, Estibot, or NameBio?</strong></summary>

Those are paid commercial services with rich appraisal data and historical sales archives. Domainer doesn't try to replace that. It replaces the **portfolio-management bookkeeping** layer — the part you spend the most time in — with a free, scriptable, chat-native alternative. Use Domainer for daily ops; check the paid services when you actually need an appraisal.

</details>

<details>
<summary><strong>Does it work with Namecheap / Porkbun / GoDaddy / Cloudflare / Spaceship / Dynadot?</strong></summary>

Yes, with any registrar. Domainer reads public registry data (RDAP / DNS), not registrar APIs. You manually add domains via `/add`, or bulk-import a CSV exported from your registrar dashboard. Registrar-API adapters are on the roadmap as opt-in plugins.

</details>

<details>
<summary><strong>Will it work for me if I only have 5 domains?</strong></summary>

Absolutely. Domainer is just as comfy with 5 domains as it is with 5,000. The SQLite footprint at 5 domains is a few KB; expiry alerts and dashboard summaries still work.

</details>

<details>
<summary><strong>Can I run it on a Raspberry Pi or NAS?</strong></summary>

Yes. The Docker image is multi-arch (amd64 + arm64). A Pi 4 or Synology DSM 7 NAS handles the workload trivially.

</details>

<details>
<summary><strong>Is my portfolio data private?</strong></summary>

Yes — Domainer is self-hosted. The SQLite file lives on your machine. The only outbound traffic is to (1) Telegram's Bot API and (2) the public RDAP bootstrap. No analytics, no telemetry, no third-party services.

</details>

<details>
<summary><strong>What's the difference between an RDAP and a legacy WHOIS lookup?</strong></summary>

RDAP is the modern, structured, JSON replacement for the legacy port-43 WHOIS protocol. It's official IETF standard (RFC 9082 / 9083), supported by all gTLD registries and most ccTLDs. Domainer uses RDAP first and falls back to legacy WHOIS for the handful of TLDs that haven't adopted it yet.

</details>

<details>
<summary><strong>Can I run multiple bots / users on one instance?</strong></summary>

Yes. Each Telegram user gets their own portfolio scoped by their user ID. Set `ALLOWED_USERS` to gatekeep — or leave it empty for a public bot.

</details>

<details>
<summary><strong>How do I back up my data?</strong></summary>

`cp data/domainer.sqlite backups/`. That's it. The whole portfolio is one SQLite file.

</details>

<details>
<summary><strong>Can I export to a spreadsheet?</strong></summary>

`/export --format=csv` in the bot. Drops a CSV ready for Excel / Google Sheets / Numbers / Airtable.

</details>

---

## 🤝 Contributing

PRs are very welcome. The codebase is ~2k lines of TypeScript with no exotic patterns — read it end to end in an hour. Start with [CONTRIBUTING.md](CONTRIBUTING.md), pick something from the roadmap, or scratch your own itch.

Ground rule: **no paid APIs, ever.**

---

## 🔐 Security

Please report vulnerabilities privately via [GitHub Security Advisories](https://github.com/kwkuh/domain-portfolio/security/advisories/new). See [SECURITY.md](SECURITY.md).

---

## 📄 License

[MIT](LICENSE) © Domainer contributors

---

<div align="center">

<sub>Built by domain investors, for domain investors. No SaaS, no API bills, no lock-in.</sub>

</div>
