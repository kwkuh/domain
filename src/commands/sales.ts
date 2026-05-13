import type { Bot, Context } from "grammy";
import { getDb } from "../lib/db.js";
import { parseDomain } from "../lib/rdap.js";
import { fmtMoney } from "../lib/format.js";

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
  bot.command(["forsale", "for-sale"], async (ctx) => {
    const [name, price] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /forsale <domain> [bin]");
    if (!ensureOwned(d, owner(ctx))) return ctx.reply(`${d} not in portfolio.`);
    const db = getDb();
    db.prepare("UPDATE domains SET status='for_sale' WHERE name=? AND owner_id=?").run(d, owner(ctx));
    if (price) {
      const n = Number(price.replace(/[$,]/g, ""));
      if (Number.isFinite(n)) db.prepare("UPDATE domains SET bin=? WHERE name=?").run(n, d);
    }
    return ctx.reply(`${d} listed for sale${price ? ` at ${fmtMoney(Number(price))}` : ""}.`);
  });

  bot.command(["unlist", "delist"], async (ctx) => {
    const [name] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Usage: /unlist <domain>");
    getDb().prepare("UPDATE domains SET status='active' WHERE name=? AND owner_id=?").run(d, owner(ctx));
    return ctx.reply(`${d} delisted.`);
  });

  bot.command("offer", async (ctx) => {
    const [name, amount, ...rest] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d || !amount) return ctx.reply("Usage: /offer <domain> <amount> [buyer note...]");
    if (!ensureOwned(d, owner(ctx))) return ctx.reply(`${d} not in portfolio.`);
    const n = Number(amount.replace(/[$,]/g, ""));
    if (!Number.isFinite(n)) return ctx.reply("Invalid amount.");
    const note = rest.join(" ");
    const r = getDb()
      .prepare("INSERT INTO leads (domain, offer, buyer, note, status) VALUES (?, ?, ?, ?, 'open')")
      .run(d, n, note ? note.split(" ")[0] : null, note || null);
    getDb()
      .prepare("INSERT INTO events (domain, kind, payload) VALUES (?, 'offer', ?)")
      .run(d, JSON.stringify({ offer: n, note }));
    return ctx.reply(`Offer #${r.lastInsertRowid} logged: ${d} = ${fmtMoney(n)}`);
  });

  bot.command("counter", async (ctx) => {
    const [name, amount] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d || !amount) return ctx.reply("Usage: /counter <domain> <amount>");
    const n = Number(amount.replace(/[$,]/g, ""));
    if (!Number.isFinite(n)) return ctx.reply("Invalid amount.");
    getDb()
      .prepare(
        "UPDATE leads SET status='countered', note=COALESCE(note,'') || ' [counter ' || ? || ']' WHERE id=(SELECT id FROM leads WHERE domain=? ORDER BY id DESC LIMIT 1)",
      )
      .run(String(n), d);
    return ctx.reply(`Countered latest offer on ${d} with ${fmtMoney(n)}.`);
  });

  bot.command("sold", async (ctx) => {
    const [name, price] = parts(ctx);
    const d = parseDomain(name || "");
    if (!d || !price) return ctx.reply("Usage: /sold <domain> <price>");
    if (!ensureOwned(d, owner(ctx))) return ctx.reply(`${d} not in portfolio.`);
    const n = Number(price.replace(/[$,]/g, ""));
    if (!Number.isFinite(n)) return ctx.reply("Invalid amount.");
    const db = getDb();
    db.prepare(
      "INSERT INTO sales (domain, sold_price, sold_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(domain) DO UPDATE SET sold_price=excluded.sold_price, sold_at=excluded.sold_at",
    ).run(d, n);
    db.prepare("UPDATE domains SET status='sold' WHERE name=?").run(d);
    db.prepare("INSERT INTO events (domain, kind, payload) VALUES (?, 'sold', ?)").run(
      d,
      JSON.stringify({ price: n }),
    );
    const buy = (db.prepare("SELECT buy_price FROM domains WHERE name=?").get(d) as any)?.buy_price || 0;
    const profit = n - buy;
    return ctx.reply(`💰 Sold ${d} for ${fmtMoney(n)} (profit ${fmtMoney(profit)}).`);
  });

  bot.command("lead", async (ctx) => {
    const [sub, name, ...rest] = parts(ctx);
    if (!sub) return ctx.reply("Usage: /lead add|note|close <domain> [...]");
    const d = parseDomain(name || "");
    if (!d) return ctx.reply("Invalid domain.");
    const db = getDb();
    if (sub === "add") {
      const buyer = rest[0] || null;
      const r = db
        .prepare("INSERT INTO leads (domain, buyer, status) VALUES (?, ?, 'open')")
        .run(d, buyer);
      return ctx.reply(`Lead #${r.lastInsertRowid} added for ${d}.`);
    }
    if (sub === "note") {
      const note = rest.join(" ");
      if (!note) return ctx.reply("Usage: /lead note <domain> <text>");
      db.prepare(
        "UPDATE leads SET note = COALESCE(note,'') || ' | ' || ? WHERE id=(SELECT id FROM leads WHERE domain=? ORDER BY id DESC LIMIT 1)",
      ).run(note, d);
      return ctx.reply("Note appended to latest lead.");
    }
    if (sub === "close") {
      db.prepare("UPDATE leads SET status='closed' WHERE domain=? AND status='open'").run(d);
      return ctx.reply(`Closed open leads on ${d}.`);
    }
    return ctx.reply("Unknown subcommand. Use: add|note|close");
  });

  bot.command("leads", async (ctx) => {
    const [name] = parts(ctx);
    const d = name ? parseDomain(name) : null;
    const sql = d
      ? "SELECT * FROM leads WHERE domain=? ORDER BY id DESC LIMIT 50"
      : "SELECT * FROM leads ORDER BY id DESC LIMIT 30";
    const rows = d ? getDb().prepare(sql).all(d) : getDb().prepare(sql).all();
    const ls = rows as any[];
    if (!ls.length) return ctx.reply("No leads.");
    return ctx.reply(
      ls
        .map(
          (l) =>
            `#${l.id} ${l.domain} ${l.offer ? fmtMoney(l.offer) : "—"} [${l.status}]${l.buyer ? " " + l.buyer : ""}${l.note ? `\n   ${l.note}` : ""}`,
        )
        .join("\n"),
    );
  });

  bot.command(["forsale-list", "marketplace"], async (ctx) => {
    const rows = getDb()
      .prepare("SELECT name, bin, floor FROM domains WHERE owner_id=? AND status='for_sale' ORDER BY name")
      .all(owner(ctx)) as { name: string; bin: number | null; floor: number | null }[];
    if (!rows.length) return ctx.reply("Nothing listed for sale. /forsale <domain> [bin].");
    return ctx.reply(
      rows.map((r) => `${r.name}  BIN ${fmtMoney(r.bin)}${r.floor ? `  floor ${fmtMoney(r.floor)}` : ""}`).join("\n"),
    );
  });
}
