import type { Bot, Context } from "grammy";
import { getDb, type DomainRow } from "../lib/db.js";
import { parseDomain } from "../lib/rdap.js";
import { daysUntil } from "../lib/format.js";

function ownerId(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

export function register(bot: Bot) {
  bot.command("upcoming", async (ctx) => {
    const flagDays = (ctx.message?.text || "").match(/--days=(\d+)/)?.[1];
    const days = flagDays ? Number(flagDays) : 30;
    const rows = getDb()
      .prepare(
        `SELECT * FROM domains
         WHERE owner_id = ? AND archived = 0
           AND expiry IS NOT NULL
           AND julianday(expiry) - julianday('now') BETWEEN 0 AND ?
         ORDER BY expiry ASC LIMIT 100`,
      )
      .all(ownerId(ctx), days) as DomainRow[];
    if (!rows.length) return ctx.reply(`No domains expiring in next ${days} days.`);
    const lines = rows.map((r) => `${r.name} — ${daysUntil(r.expiry)}d (${r.expiry?.slice(0, 10)})`);
    return ctx.reply(`Expiring in ${days}d:\n` + lines.join("\n"));
  });

  bot.command("expired", async (ctx) => {
    const rows = getDb()
      .prepare(
        `SELECT * FROM domains
         WHERE owner_id = ? AND archived = 0
           AND expiry IS NOT NULL
           AND julianday(expiry) < julianday('now')
         ORDER BY expiry DESC LIMIT 100`,
      )
      .all(ownerId(ctx)) as DomainRow[];
    if (!rows.length) return ctx.reply("No expired domains.");
    const lines = rows.map((r) => `${r.name} — expired ${-(daysUntil(r.expiry) || 0)}d ago`);
    return ctx.reply(`Expired:\n` + lines.join("\n"));
  });

  bot.command("renew", async (ctx) => {
    const [name] = (ctx.message?.text || "").split(/\s+/).slice(1);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /renew <domain>");
    getDb()
      .prepare("INSERT INTO events (domain, kind) VALUES (?, 'renewed')")
      .run(d);
    return ctx.reply(`Marked ${d} as renewed. Run /whois ${d} to refresh expiry from RDAP.`);
  });

  bot.command("remind", async (ctx) => {
    const parts = (ctx.message?.text || "").split(/\s+/).slice(1);
    const name = parts.find((p) => !p.startsWith("--"));
    const days = Number(parts.find((p) => p.startsWith("--days="))?.split("=")[1] || 30);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /remind <domain> --days=N");
    getDb()
      .prepare("INSERT INTO reminders (domain, days_before) VALUES (?, ?)")
      .run(d, days);
    return ctx.reply(`Reminder set: ${d} when ${days}d before expiry.`);
  });
}
