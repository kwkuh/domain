import type { Bot, Context } from "grammy";
import { getDb, type DomainRow } from "../lib/db.js";
import { parseDomain, rdapLookup } from "../lib/rdap.js";
import { fmtDomainDetail, fmtMoney, fmtExpiry, daysUntil } from "../lib/format.js";

function args(ctx: Context): string[] {
  const t = ctx.message?.text || "";
  return t.split(/\s+/).slice(1);
}

function ownerId(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

function parseFlags(parts: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const p of parts) {
    const m = p.match(/^--([a-zA-Z_-]+)(?:=(.+))?$/);
    if (m) flags[m[1]] = m[2] ?? "true";
    else positional.push(p);
  }
  return { positional, flags };
}

function getDomain(name: string, owner: number): DomainRow | undefined {
  return getDb()
    .prepare("SELECT * FROM domains WHERE name = ? AND owner_id = ?")
    .get(name, owner) as DomainRow | undefined;
}

function getTags(name: string): string[] {
  return getDb()
    .prepare("SELECT tag FROM tags WHERE domain = ? ORDER BY tag")
    .all(name)
    .map((r: any) => r.tag);
}

export function register(bot: Bot) {
  bot.command("add", async (ctx) => {
    const { positional, flags } = parseFlags(args(ctx));
    if (!positional[0]) return ctx.reply("Usage: /add <domain> [--buy=N] [--bin=N] [--tag=a,b]");
    const domain = parseDomain(positional[0]);
    if (!domain) return ctx.reply("Invalid domain.");
    const owner = ownerId(ctx);
    const db = getDb();
    const exists = getDomain(domain, owner);
    if (exists) return ctx.reply(`${domain} already in portfolio.`);
    db.prepare(
      `INSERT INTO domains (name, owner_id, buy_price, bin) VALUES (?, ?, ?, ?)`,
    ).run(domain, owner, flags.buy ? Number(flags.buy) : null, flags.bin ? Number(flags.bin) : null);
    if (flags.tag) {
      const stmt = db.prepare("INSERT OR IGNORE INTO tags (domain, tag) VALUES (?, ?)");
      for (const t of flags.tag.split(",").map((x) => x.trim()).filter(Boolean)) stmt.run(domain, t);
    }
    await ctx.reply(`Added ${domain}. Looking up RDAP…`);
    const rdap = await rdapLookup(domain);
    if (rdap.ok && rdap.status === "registered") {
      db.prepare(
        `UPDATE domains SET registrar=?, expiry=?, created_at_rdap=?, updated_at_rdap=?,
         nameservers=?, dnssec=?, rdap_status=?, last_rdap_at=CURRENT_TIMESTAMP WHERE name=?`,
      ).run(
        rdap.registrar || null,
        rdap.expiry || null,
        rdap.createdAt || null,
        rdap.updatedAt || null,
        (rdap.nameservers || []).join(","),
        rdap.dnssec ? 1 : 0,
        (rdap.rdapStatus || []).join(","),
        domain,
      );
      const row = getDomain(domain, owner)!;
      return ctx.reply(fmtDomainDetail(row, getTags(domain)), { parse_mode: "MarkdownV2" });
    }
    return ctx.reply(`RDAP: ${rdap.status}${rdap.error ? ` (${rdap.error})` : ""}`);
  });

  bot.command("list", async (ctx) => {
    const { flags } = parseFlags(args(ctx));
    const owner = ownerId(ctx);
    const db = getDb();
    let sql = "SELECT * FROM domains WHERE owner_id = ? AND archived = 0";
    const params: any[] = [owner];
    if (flags.status) {
      sql += " AND status = ?";
      params.push(flags.status);
    }
    if (flags.tag) {
      sql += " AND name IN (SELECT domain FROM tags WHERE tag = ?)";
      params.push(flags.tag);
    }
    if (flags.expiring) {
      const days = Number(flags.expiring);
      sql += " AND expiry IS NOT NULL AND julianday(expiry) - julianday('now') <= ?";
      params.push(days);
    }
    sql += " ORDER BY pinned DESC, expiry ASC NULLS LAST, name ASC LIMIT 50";
    const rows = db.prepare(sql).all(...params) as DomainRow[];
    if (!rows.length) return ctx.reply("No domains. Use /add <domain> to start.");
    const lines = rows.map((r) => {
      const d = daysUntil(r.expiry);
      const exp = d == null ? "—" : `${d}d`;
      const bin = r.bin ? fmtMoney(r.bin) : "";
      return `${r.pinned ? "📌 " : ""}${r.name}  ${exp}  ${bin}`;
    });
    await ctx.reply(`Portfolio (${rows.length}):\n` + lines.join("\n"));
  });

  bot.command("detail", async (ctx) => {
    const [name] = args(ctx);
    if (!name) return ctx.reply("Usage: /detail <domain>");
    const domain = parseDomain(name);
    if (!domain) return ctx.reply("Invalid domain.");
    const row = getDomain(domain, ownerId(ctx));
    if (!row) return ctx.reply(`${domain} not in portfolio.`);
    return ctx.reply(fmtDomainDetail(row, getTags(domain)), { parse_mode: "MarkdownV2" });
  });

  bot.command(["remove", "delete"], async (ctx) => {
    const [name] = args(ctx);
    if (!name) return ctx.reply("Usage: /remove <domain>");
    const domain = parseDomain(name);
    if (!domain) return ctx.reply("Invalid domain.");
    const res = getDb()
      .prepare("UPDATE domains SET archived = 1 WHERE name = ? AND owner_id = ?")
      .run(domain, ownerId(ctx));
    return ctx.reply(res.changes ? `Archived ${domain}. /restore to undo.` : `${domain} not found.`);
  });

  bot.command("restore", async (ctx) => {
    const [name] = args(ctx);
    if (!name) return ctx.reply("Usage: /restore <domain>");
    const domain = parseDomain(name)!;
    const res = getDb()
      .prepare("UPDATE domains SET archived = 0 WHERE name = ? AND owner_id = ?")
      .run(domain, ownerId(ctx));
    return ctx.reply(res.changes ? `Restored ${domain}.` : `${domain} not found.`);
  });

  bot.command("purge", async (ctx) => {
    const [name] = args(ctx);
    if (!name) return ctx.reply("Usage: /purge <domain>");
    const domain = parseDomain(name)!;
    const res = getDb()
      .prepare("DELETE FROM domains WHERE name = ? AND owner_id = ?")
      .run(domain, ownerId(ctx));
    return ctx.reply(res.changes ? `Purged ${domain} permanently.` : `${domain} not found.`);
  });

  bot.command("pin", async (ctx) => togglePin(ctx, 1));
  bot.command("unpin", async (ctx) => togglePin(ctx, 0));
  bot.command("star", async (ctx) => toggleStar(ctx, 1));
  bot.command("unstar", async (ctx) => toggleStar(ctx, 0));
}

async function togglePin(ctx: Context, v: number) {
  const [name] = (ctx.message?.text || "").split(/\s+/).slice(1);
  const domain = parseDomain(name || "");
  if (!domain) return ctx.reply("Usage: /pin <domain>");
  getDb()
    .prepare("UPDATE domains SET pinned = ? WHERE name = ? AND owner_id = ?")
    .run(v, domain, ctx.from?.id ?? 0);
  return ctx.reply(`${domain} ${v ? "pinned" : "unpinned"}.`);
}

async function toggleStar(ctx: Context, v: number) {
  const [name] = (ctx.message?.text || "").split(/\s+/).slice(1);
  const domain = parseDomain(name || "");
  if (!domain) return ctx.reply("Usage: /star <domain>");
  getDb()
    .prepare("UPDATE domains SET starred = ? WHERE name = ? AND owner_id = ?")
    .run(v, domain, ctx.from?.id ?? 0);
  return ctx.reply(`${domain} ${v ? "starred" : "unstarred"}.`);
}
