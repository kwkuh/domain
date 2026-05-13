import type { Bot, Context } from "grammy";
import { getDb } from "../lib/db.js";
import { parseDomain } from "../lib/rdap.js";

function parts(ctx: Context): string[] {
  return (ctx.message?.text || "").split(/\s+/).slice(1);
}
function owner(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

function ensureOwned(domain: string, ownerId: number): boolean {
  return !!getDb()
    .prepare("SELECT 1 FROM domains WHERE name = ? AND owner_id = ?")
    .get(domain, ownerId);
}

export function register(bot: Bot) {
  bot.command("tag", async (ctx) => {
    const [name, ...tags] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d || !tags.length) return ctx.reply("Usage: /tag <domain> <tag1> [tag2 …]");
    if (!ensureOwned(d, owner(ctx))) return ctx.reply(`${d} not in portfolio. /add first.`);
    const stmt = getDb().prepare("INSERT OR IGNORE INTO tags (domain, tag) VALUES (?, ?)");
    for (const t of tags) stmt.run(d, t.toLowerCase());
    return ctx.reply(`Tagged ${d}: ${tags.join(", ")}`);
  });

  bot.command("untag", async (ctx) => {
    const [name, ...tags] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d || !tags.length) return ctx.reply("Usage: /untag <domain> <tag>");
    const stmt = getDb().prepare("DELETE FROM tags WHERE domain = ? AND tag = ?");
    for (const t of tags) stmt.run(d, t.toLowerCase());
    return ctx.reply(`Removed tags from ${d}.`);
  });

  bot.command("tags", async (ctx) => {
    const [name] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /tags <domain>");
    const rows = getDb()
      .prepare("SELECT tag FROM tags WHERE domain = ?")
      .all(d) as { tag: string }[];
    return ctx.reply(rows.length ? rows.map((r) => r.tag).join(", ") : "(no tags)");
  });

  bot.command("note", async (ctx) => {
    const [name, ...rest] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d || !rest.length) return ctx.reply("Usage: /note <domain> <text>");
    if (!ensureOwned(d, owner(ctx))) return ctx.reply(`${d} not in portfolio.`);
    getDb().prepare("INSERT INTO notes (domain, body) VALUES (?, ?)").run(d, rest.join(" "));
    return ctx.reply(`Note saved for ${d}.`);
  });

  bot.command("notes", async (ctx) => {
    const [name] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /notes <domain>");
    const rows = getDb()
      .prepare("SELECT id, body, created_at FROM notes WHERE domain = ? ORDER BY id")
      .all(d) as { id: number; body: string; created_at: string }[];
    if (!rows.length) return ctx.reply("(no notes)");
    return ctx.reply(rows.map((r) => `[${r.id}] ${r.created_at?.slice(0, 10)}: ${r.body}`).join("\n"));
  });

  bot.command("cost", async (ctx) => setNumeric(ctx, "buy_price", "Usage: /cost <domain> <amount>"));
  bot.command("bin", async (ctx) => setNumeric(ctx, "bin", "Usage: /bin <domain> <amount>"));
  bot.command("floor", async (ctx) => setNumeric(ctx, "floor", "Usage: /floor <domain> <amount>"));

  bot.command("category", async (ctx) => {
    const [name, cat] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d || !cat) return ctx.reply("Usage: /category <domain> <category>");
    if (!ensureOwned(d, owner(ctx))) return ctx.reply(`${d} not in portfolio.`);
    getDb()
      .prepare("UPDATE domains SET category = ? WHERE name = ? AND owner_id = ?")
      .run(cat.toLowerCase(), d, owner(ctx));
    return ctx.reply(`Category set: ${d} → ${cat}`);
  });
}

function setNumeric(ctx: Context, col: string, usage: string) {
  const [name, val] = parts(ctx);
  const d = parseDomain(name || "");
  if (!d || !val) return ctx.reply(usage);
  const n = Number(val.replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) return ctx.reply("Invalid number.");
  if (!ensureOwned(d, owner(ctx))) return ctx.reply(`${d} not in portfolio.`);
  getDb()
    .prepare(`UPDATE domains SET ${col} = ? WHERE name = ? AND owner_id = ?`)
    .run(n, d, owner(ctx));
  return ctx.reply(`Updated ${d} ${col} = ${n}`);
}
