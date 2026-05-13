import type { Bot, Context } from "grammy";
import { getDb, type DomainRow } from "../lib/db.js";
import { fmtMoney } from "../lib/format.js";

function owner(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

export function register(bot: Bot) {
  bot.command(["dashboard", "stats", "summary"], async (ctx) => {
    const db = getDb();
    const o = owner(ctx);
    const rows = db
      .prepare("SELECT * FROM domains WHERE owner_id = ? AND archived = 0")
      .all(o) as DomainRow[];
    if (!rows.length) return ctx.reply("Empty portfolio. /add <domain> to start.");
    const total = rows.length;
    const expiring30 = rows.filter((r) => {
      if (!r.expiry) return false;
      const d = (Date.parse(r.expiry) - Date.now()) / 86400000;
      return d >= 0 && d <= 30;
    }).length;
    const expired = rows.filter((r) => r.expiry && Date.parse(r.expiry) < Date.now()).length;
    const totalBuy = rows.reduce((a, r) => a + (r.buy_price || 0), 0);
    const totalBin = rows.reduce((a, r) => a + (r.bin || 0), 0);
    const avgBin = rows.filter((r) => r.bin).length
      ? totalBin / rows.filter((r) => r.bin).length
      : 0;
    const tldCount = new Map<string, number>();
    for (const r of rows) {
      const tld = r.name.split(".").slice(1).join(".");
      tldCount.set(tld, (tldCount.get(tld) || 0) + 1);
    }
    const topTld = [...tldCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const regCount = new Map<string, number>();
    for (const r of rows) {
      if (r.registrar) regCount.set(r.registrar, (regCount.get(r.registrar) || 0) + 1);
    }
    const topReg = [...regCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const lines = [
      `📊 Portfolio Dashboard`,
      ``,
      `Total domains:    ${total}`,
      `Expiring ≤30d:    ${expiring30}`,
      `Expired:          ${expired}`,
      `Total buy cost:   ${fmtMoney(totalBuy)}`,
      `Total BIN value:  ${fmtMoney(totalBin)}`,
      `Avg BIN:          ${fmtMoney(avgBin)}`,
      ``,
      `Top TLDs:         ${topTld.map(([t, c]) => `.${t}(${c})`).join(" ") || "—"}`,
      `Top registrars:   ${topReg.map(([r, c]) => `${r}(${c})`).join(" ") || "—"}`,
    ];
    return ctx.reply(lines.join("\n"));
  });

  bot.command("health", async (ctx) => {
    const db = getDb();
    const o = owner(ctx);
    const flag = (ctx.message?.text || "").split(/\s+/)[1];
    const all = db
      .prepare("SELECT * FROM domains WHERE owner_id = ? AND archived = 0")
      .all(o) as DomainRow[];
    const noBin = all.filter((r) => !r.bin);
    const noTag = all.filter(
      (r) => !db.prepare("SELECT 1 FROM tags WHERE domain = ?").get(r.name),
    );
    const noNote = all.filter(
      (r) => !db.prepare("SELECT 1 FROM notes WHERE domain = ?").get(r.name),
    );
    const expired = all.filter((r) => r.expiry && Date.parse(r.expiry) < Date.now());
    if (flag === "--no-bin") return ctx.reply(noBin.map((r) => r.name).join("\n") || "(none)");
    if (flag === "--no-tag") return ctx.reply(noTag.map((r) => r.name).join("\n") || "(none)");
    if (flag === "--no-note") return ctx.reply(noNote.map((r) => r.name).join("\n") || "(none)");
    if (flag === "--expired") return ctx.reply(expired.map((r) => r.name).join("\n") || "(none)");
    return ctx.reply(
      [
        `Health summary:`,
        `  No BIN:   ${noBin.length}`,
        `  No tag:   ${noTag.length}`,
        `  No note:  ${noNote.length}`,
        `  Expired:  ${expired.length}`,
        ``,
        `Filter: --no-bin --no-tag --no-note --expired`,
      ].join("\n"),
    );
  });
}
