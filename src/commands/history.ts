import type { Bot, Context } from "grammy";
import { getDb } from "../lib/db.js";
import { parseDomain } from "../lib/rdap.js";

function arg(ctx: Context): string | null {
  const t = (ctx.message?.text || "").split(/\s+/).slice(1)[0];
  return t ? parseDomain(t) : null;
}

function fmtEvent(e: { kind: string; payload: string | null; created_at: string }): string {
  const date = (e.created_at || "").slice(0, 16).replace("T", " ");
  let detail = "";
  if (e.payload) {
    try {
      const p = JSON.parse(e.payload);
      if (p.old != null && p.new != null) detail = `\n   ${p.old || "(empty)"} → ${p.new}`;
      else detail = `\n   ${JSON.stringify(p)}`;
    } catch {
      detail = `\n   ${e.payload}`;
    }
  }
  return `[${date}] ${e.kind}${detail}`;
}

export function register(bot: Bot) {
  bot.command(["history", "events"], async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /history <domain>");
    const rows = getDb()
      .prepare("SELECT kind, payload, created_at FROM events WHERE domain=? ORDER BY id DESC LIMIT 50")
      .all(d) as { kind: string; payload: string | null; created_at: string }[];
    if (!rows.length) return ctx.reply(`No events for ${d}.`);
    return ctx.reply(`History — ${d}\n\n` + rows.map(fmtEvent).join("\n"));
  });

  bot.command("timeline", async (ctx) => {
    // Recent events across portfolio.
    const limit = Number((ctx.message?.text || "").match(/--limit=(\d+)/)?.[1] || 30);
    const rows = getDb()
      .prepare(
        `SELECT e.domain, e.kind, e.payload, e.created_at
         FROM events e JOIN domains d ON d.name = e.domain
         WHERE d.owner_id = ?
         ORDER BY e.id DESC LIMIT ?`,
      )
      .all(ctx.from?.id ?? 0, limit) as {
      domain: string;
      kind: string;
      payload: string | null;
      created_at: string;
    }[];
    if (!rows.length) return ctx.reply("No portfolio activity yet.");
    return ctx.reply(
      rows
        .map((r) => `[${r.created_at.slice(5, 16).replace("T", " ")}] ${r.domain} — ${r.kind}`)
        .join("\n"),
    );
  });

  bot.command(["changes", "diff"], async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /changes <domain>");
    const rows = getDb()
      .prepare(
        `SELECT kind, payload, created_at FROM events
         WHERE domain=? AND kind IN ('ns_change','status_change','expiry_change','registrar_change','available','sold','offer','renewed')
         ORDER BY id DESC LIMIT 30`,
      )
      .all(d) as { kind: string; payload: string | null; created_at: string }[];
    if (!rows.length) return ctx.reply(`No tracked changes for ${d}.`);
    return ctx.reply(`Changes — ${d}\n\n` + rows.map(fmtEvent).join("\n"));
  });
}
