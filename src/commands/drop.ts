import type { Bot, Context } from "grammy";
import { parseDomain, rdapLookup } from "../lib/rdap.js";
import { getDb } from "../lib/db.js";
import { fmtExpiry, daysUntil } from "../lib/format.js";

// RDAP status codes that indicate dropping lifecycle.
// See ICANN domain lifecycle: active → autorenew period (45d) → redemption (30d) → pending delete (5d) → drop.
const REDEMPTION_STATUSES = ["redemptionperiod", "pendingrestore", "redemption period"];
const PENDING_DELETE_STATUSES = ["pendingdelete", "pending delete"];

function arg(ctx: Context): string | null {
  const t = (ctx.message?.text || "").split(/\s+/).slice(1)[0];
  return t ? parseDomain(t) : null;
}

function phase(status: string[] | undefined, expiry: string | undefined): {
  phase: string;
  estDropAt?: Date;
  daysToDrop?: number;
} {
  const s = (status || []).map((x) => x.toLowerCase());
  const exp = expiry ? new Date(expiry) : null;
  if (s.some((x) => PENDING_DELETE_STATUSES.some((p) => x.includes(p)))) {
    // Pending delete = 5 days then drop.
    const est = new Date(Date.now() + 5 * 86400000);
    return { phase: "pending-delete", estDropAt: est, daysToDrop: 5 };
  }
  if (s.some((x) => REDEMPTION_STATUSES.some((p) => x.includes(p)))) {
    // Redemption = 30d, then pending delete 5d.
    const est = exp ? new Date(exp.getTime() + 35 * 86400000) : new Date(Date.now() + 35 * 86400000);
    const dd = Math.ceil((est.getTime() - Date.now()) / 86400000);
    return { phase: "redemption", estDropAt: est, daysToDrop: dd };
  }
  if (exp && exp.getTime() < Date.now()) {
    // Expired but no special status — likely in auto-renew grace (45d default), then redemption (30d), then pending delete (5d).
    const est = new Date(exp.getTime() + 80 * 86400000);
    const dd = Math.ceil((est.getTime() - Date.now()) / 86400000);
    return { phase: "auto-renew-grace", estDropAt: est, daysToDrop: dd };
  }
  if (exp) {
    const d = daysUntil(expiry);
    if (d != null && d < 30) return { phase: "near-expiry" };
  }
  return { phase: "active" };
}

export function register(bot: Bot) {
  bot.command("drop", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /drop <domain>");
    const r = await rdapLookup(d);
    if (!r.ok) return ctx.reply(`Error: ${r.error}`);
    if (r.status === "available") return ctx.reply(`✅ ${d} appears AVAILABLE right now.`);
    const p = phase(r.rdapStatus, r.expiry);
    const lines = [
      `🔍 Drop analysis: ${d}`,
      `Status:       ${(r.rdapStatus || []).join(", ") || "—"}`,
      `Expiry:       ${fmtExpiry(r.expiry)}`,
      `Phase:        ${p.phase}`,
    ];
    if (p.estDropAt) {
      lines.push(`Est. drop:    ${p.estDropAt.toISOString().slice(0, 10)} (${p.daysToDrop}d)`);
    }
    return ctx.reply(lines.join("\n"));
  });

  bot.command(["pending", "pending-delete"], async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /pending <domain>");
    const r = await rdapLookup(d);
    if (!r.ok) return ctx.reply(`Error: ${r.error}`);
    const p = phase(r.rdapStatus, r.expiry);
    const tag =
      p.phase === "pending-delete"
        ? "🔥 PENDING DELETE"
        : p.phase === "redemption"
          ? "⏳ in redemption"
          : p.phase === "auto-renew-grace"
            ? "⌛ auto-renew grace"
            : "—";
    return ctx.reply(`${d}: ${tag}${p.daysToDrop ? ` (≈${p.daysToDrop}d to drop)` : ""}`);
  });

  bot.command(["dropwatch", "drop-watch"], async (ctx) => {
    const [name] = (ctx.message?.text || "").split(/\s+/).slice(1);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /dropwatch <domain>");
    getDb()
      .prepare("INSERT OR IGNORE INTO watches (domain, kind) VALUES (?, 'status')")
      .run(d);
    return ctx.reply(`Watching ${d} for drop-phase status changes. Scheduler will alert on transitions.`);
  });

  bot.command("droplist", async (ctx) => {
    // Show portfolio domains currently in any drop phase.
    const rows = getDb()
      .prepare(
        `SELECT name, expiry, rdap_status FROM domains
         WHERE owner_id = ? AND archived = 0
           AND (rdap_status LIKE '%redemption%' OR rdap_status LIKE '%pendingDelete%' OR rdap_status LIKE '%pending delete%'
                OR (expiry IS NOT NULL AND julianday(expiry) < julianday('now')))
         ORDER BY expiry`,
      )
      .all(ctx.from?.id ?? 0) as { name: string; expiry: string | null; rdap_status: string | null }[];
    if (!rows.length) return ctx.reply("No domains in drop phase. 🎉");
    return ctx.reply(
      rows
        .map((r) => {
          const p = phase((r.rdap_status || "").split(","), r.expiry || undefined);
          return `${r.name} — ${p.phase}${p.daysToDrop ? ` (~${p.daysToDrop}d)` : ""}`;
        })
        .join("\n"),
    );
  });
}
