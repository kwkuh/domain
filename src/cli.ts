#!/usr/bin/env node
import "dotenv/config";
import { getDb, type DomainRow } from "./lib/db.js";
import { parseDomain, rdapLookup } from "./lib/rdap.js";
import { whoisLookup } from "./lib/whois.js";
import { resolveAll, detectParking } from "./lib/dns.js";
import { scoreDomain } from "./lib/score.js";
import { fmtExpiry, fmtMoney, daysUntil } from "./lib/format.js";

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1);

// CLI owner: env var or fallback 0 (single-user local mode).
const OWNER = Number(process.env.CLI_USER_ID || 0);

function flag(name: string): string | undefined {
  const m = rest.find((a) => a.startsWith(`--${name}=`));
  return m?.split("=").slice(1).join("=");
}
function positional(): string[] {
  return rest.filter((a) => !a.startsWith("--"));
}

async function main() {
  switch (cmd) {
    case "add": {
      const [name] = positional();
      const d = parseDomain(name || "");
      if (!d) return die("Usage: domainer add <domain> [--buy=N] [--bin=N]");
      const db = getDb();
      db.prepare("INSERT OR IGNORE INTO domains (name, owner_id, buy_price, bin) VALUES (?, ?, ?, ?)").run(
        d,
        OWNER,
        flag("buy") ? Number(flag("buy")) : null,
        flag("bin") ? Number(flag("bin")) : null,
      );
      const r = await rdapLookup(d);
      if (r.ok && r.status === "registered") {
        db.prepare(
          `UPDATE domains SET registrar=?, expiry=?, created_at_rdap=?, nameservers=?, last_rdap_at=CURRENT_TIMESTAMP WHERE name=?`,
        ).run(r.registrar || null, r.expiry || null, r.createdAt || null, (r.nameservers || []).join(","), d);
      }
      console.log(`Added ${d}. ${r.status === "available" ? "(AVAILABLE)" : r.registrar ? `→ ${r.registrar}` : ""}`);
      break;
    }
    case "list": {
      const rows = getDb()
        .prepare("SELECT * FROM domains WHERE owner_id = ? AND archived = 0 ORDER BY expiry NULLS LAST, name")
        .all(OWNER) as DomainRow[];
      if (!rows.length) return console.log("(empty portfolio)");
      for (const r of rows) {
        const d = daysUntil(r.expiry);
        console.log(`${r.name.padEnd(32)} ${(d == null ? "—" : `${d}d`).padStart(6)}  ${fmtMoney(r.bin)}`);
      }
      break;
    }
    case "detail":
    case "show": {
      const [name] = positional();
      const d = parseDomain(name || "");
      if (!d) return die("Usage: domainer detail <domain>");
      const row = getDb()
        .prepare("SELECT * FROM domains WHERE name = ? AND owner_id = ?")
        .get(d, OWNER) as DomainRow | undefined;
      if (!row) return die(`${d} not in portfolio.`);
      console.log(JSON.stringify(row, null, 2));
      break;
    }
    case "remove":
    case "rm": {
      const [name] = positional();
      const d = parseDomain(name || "");
      if (!d) return die("Usage: domainer remove <domain>");
      getDb().prepare("UPDATE domains SET archived = 1 WHERE name = ? AND owner_id = ?").run(d, OWNER);
      console.log(`Archived ${d}.`);
      break;
    }
    case "whois":
    case "rdap": {
      const [name] = positional();
      const d = parseDomain(name || "");
      if (!d) return die("Usage: domainer whois <domain>");
      const r = await rdapLookup(d);
      if (!r.ok) return die(`Error: ${r.error}`);
      if (r.status === "available") return console.log(`${d}: AVAILABLE`);
      console.log(
        [
          `${d}`,
          `  Registrar: ${r.registrar || "—"}`,
          `  Created:   ${r.createdAt?.slice(0, 10) || "—"}`,
          `  Expiry:    ${fmtExpiry(r.expiry)}`,
          `  NS:        ${(r.nameservers || []).join(", ") || "—"}`,
        ].join("\n"),
      );
      break;
    }
    case "whois-raw": {
      const [name] = positional();
      const d = parseDomain(name || "");
      if (!d) return die("Usage: domainer whois-raw <domain>");
      const w = await whoisLookup(d);
      if (!w.ok) return die(`Error: ${w.error}`);
      console.log(w.rawText || "(empty)");
      break;
    }
    case "dns": {
      const [name] = positional();
      const d = parseDomain(name || "");
      if (!d) return die("Usage: domainer dns <domain>");
      const recs = await resolveAll(d);
      for (const r of recs) console.log(`${r.type.padEnd(6)} ${r.values.join(", ")}`);
      const park = detectParking(recs.find((r) => r.type === "NS")?.values || []);
      if (park) console.log(`(parked at ${park})`);
      break;
    }
    case "score": {
      const [name] = positional();
      const d = parseDomain(name || "") || name;
      if (!d) return die("Usage: domainer score <domain>");
      const s = scoreDomain(d);
      console.log(JSON.stringify(s, null, 2));
      break;
    }
    case "upcoming": {
      const days = Number(positional()[0] || flag("days") || 30);
      const rows = getDb()
        .prepare(
          `SELECT * FROM domains WHERE owner_id = ? AND archived = 0 AND expiry IS NOT NULL
           AND julianday(expiry) - julianday('now') BETWEEN 0 AND ? ORDER BY expiry`,
        )
        .all(OWNER, days) as DomainRow[];
      if (!rows.length) return console.log(`(none expiring in ${days}d)`);
      for (const r of rows) console.log(`${r.name.padEnd(32)} ${daysUntil(r.expiry)}d  ${r.expiry?.slice(0, 10)}`);
      break;
    }
    case "export": {
      const fmt = flag("format") || "csv";
      const rows = getDb()
        .prepare("SELECT * FROM domains WHERE owner_id = ? AND archived = 0 ORDER BY name")
        .all(OWNER) as DomainRow[];
      if (fmt === "json") return console.log(JSON.stringify(rows, null, 2));
      if (fmt === "txt") return console.log(rows.map((r) => r.name).join("\n"));
      const cols = ["name", "registrar", "expiry", "buy_price", "bin"];
      console.log(cols.join(","));
      for (const r of rows) console.log(cols.map((c) => (r as any)[c] ?? "").join(","));
      break;
    }
    case "help":
    case "--help":
    case "-h":
    case undefined: {
      console.log(
        [
          "domainer — CLI companion for domain",
          "",
          "Usage: domainer <command> [args]",
          "",
          "Commands:",
          "  add <domain> [--buy=N --bin=N]   Track a domain",
          "  list                              List portfolio",
          "  detail <domain>                   Domain detail (JSON)",
          "  remove <domain>                   Archive a domain",
          "  whois <domain>                    RDAP lookup (WHOIS fallback)",
          "  whois-raw <domain>                Raw WHOIS text",
          "  dns <domain>                      DNS records + parking detection",
          "  score <domain>                    Brandability score (JSON)",
          "  upcoming [days]                   Expiring soon",
          "  export [--format=csv|json|txt]    Dump portfolio",
          "",
          "Environment:",
          "  DATA_DIR        SQLite location (shared with bot)",
          "  CLI_USER_ID     Owner ID (must match your bot user ID to share data)",
        ].join("\n"),
      );
      break;
    }
    default:
      die(`Unknown command: ${cmd}. Try: domainer help`);
  }
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
