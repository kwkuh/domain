import type { Bot, Context } from "grammy";
import { getDb, type DomainRow } from "../lib/db.js";

function owner(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

export function register(bot: Bot) {
  bot.command("find", async (ctx) => {
    const text = ctx.message?.text || "";
    const parts = text.split(/\s+/).slice(1);
    const flags: Record<string, string> = {};
    const free: string[] = [];
    for (const p of parts) {
      const m = p.match(/^--([a-z-]+)(?:=(.+))?$/);
      if (m) flags[m[1]] = m[2] ?? "true";
      else free.push(p);
    }
    const sql: string[] = ["SELECT * FROM domains WHERE owner_id = ? AND archived = 0"];
    const params: any[] = [owner(ctx)];
    if (free.length) {
      sql.push("AND name LIKE ?");
      params.push(`%${free.join(" ")}%`);
    }
    if (flags.contains) {
      sql.push("AND name LIKE ?");
      params.push(`%${flags.contains}%`);
    }
    if (flags["starts-with"]) {
      sql.push("AND name LIKE ?");
      params.push(`${flags["starts-with"]}%`);
    }
    if (flags["ends-with"]) {
      sql.push("AND name LIKE ?");
      params.push(`%${flags["ends-with"]}`);
    }
    if (flags.tld) {
      sql.push("AND name LIKE ?");
      params.push(`%.${flags.tld}`);
    }
    if (flags.length) {
      sql.push("AND length(substr(name, 1, instr(name, '.') - 1)) = ?");
      params.push(Number(flags.length));
    }
    if (flags.tag) {
      sql.push("AND name IN (SELECT domain FROM tags WHERE tag = ?)");
      params.push(flags.tag);
    }
    if (flags.expiring) {
      sql.push("AND expiry IS NOT NULL AND julianday(expiry) - julianday('now') <= ?");
      params.push(Number(flags.expiring));
    }
    if (flags.registrar) {
      sql.push("AND lower(registrar) LIKE ?");
      params.push(`%${flags.registrar.toLowerCase()}%`);
    }
    sql.push("ORDER BY name LIMIT 100");
    const rows = getDb()
      .prepare(sql.join(" "))
      .all(...params) as DomainRow[];
    if (!rows.length) return ctx.reply("No matches.");
    return ctx.reply(rows.map((r) => r.name).join("\n"));
  });
}
