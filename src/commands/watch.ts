import type { Bot, Context } from "grammy";
import { getDb } from "../lib/db.js";
import { parseDomain } from "../lib/rdap.js";

function parts(ctx: Context): string[] {
  return (ctx.message?.text || "").split(/\s+/).slice(1);
}

export function register(bot: Bot) {
  bot.command("watch", async (ctx) => {
    const [name, kind = "all"] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /watch <domain> [expiry|ns|status|all]");
    getDb()
      .prepare("INSERT OR IGNORE INTO watches (domain, kind) VALUES (?, ?)")
      .run(d, kind);
    return ctx.reply(`Watching ${d} for ${kind} changes.`);
  });

  bot.command("unwatch", async (ctx) => {
    const [name, kind] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /unwatch <domain> [kind]");
    if (kind) {
      getDb().prepare("DELETE FROM watches WHERE domain = ? AND kind = ?").run(d, kind);
    } else {
      getDb().prepare("DELETE FROM watches WHERE domain = ?").run(d);
    }
    return ctx.reply(`Unwatched ${d}.`);
  });

  bot.command("watchlist", async (ctx) => {
    const rows = getDb()
      .prepare("SELECT domain, kind FROM watches ORDER BY domain")
      .all() as { domain: string; kind: string }[];
    if (!rows.length) return ctx.reply("Watchlist empty.");
    return ctx.reply(rows.map((r) => `${r.domain}  [${r.kind}]`).join("\n"));
  });

  for (const k of ["watchns", "watchexpiry", "watchstatus"] as const) {
    bot.command(k, async (ctx) => {
      const [name] = parts(ctx);
      const d = parseDomain(name || "");
      if (!d) return ctx.reply(`Usage: /${k} <domain>`);
      const kind = k.replace("watch", "");
      getDb()
        .prepare("INSERT OR IGNORE INTO watches (domain, kind) VALUES (?, ?)")
        .run(d, kind);
      return ctx.reply(`Watching ${d} for ${kind} changes.`);
    });
  }
}
