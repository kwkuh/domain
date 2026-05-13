import type { Bot, Context } from "grammy";
import { parseDomain, rdapLookup } from "../lib/rdap.js";
import { fmtAge, fmtExpiry } from "../lib/format.js";

function arg(ctx: Context): string | null {
  const t = (ctx.message?.text || "").split(/\s+/).slice(1)[0];
  return t ? parseDomain(t) : null;
}

export function register(bot: Bot) {
  bot.command(["whois", "rdap"], async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /whois <domain>");
    const r = await rdapLookup(d);
    if (!r.ok) return ctx.reply(`Error: ${r.error}`);
    if (r.status === "available") return ctx.reply(`${d} appears AVAILABLE (no RDAP record).`);
    const lines = [
      `${d}`,
      `Status:     ${(r.rdapStatus || []).join(", ") || "—"}`,
      `Registrar:  ${r.registrar || "—"}`,
      `Created:    ${r.createdAt?.slice(0, 10) || "—"} (${fmtAge(r.createdAt)})`,
      `Updated:    ${r.updatedAt?.slice(0, 10) || "—"}`,
      `Expiry:     ${fmtExpiry(r.expiry)}`,
      `NS:         ${(r.nameservers || []).join(", ") || "—"}`,
      `DNSSEC:     ${r.dnssec ? "yes" : "no"}`,
    ];
    return ctx.reply(lines.join("\n"));
  });

  bot.command("expiry", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /expiry <domain>");
    const r = await rdapLookup(d);
    if (!r.ok) return ctx.reply(`Error: ${r.error}`);
    return ctx.reply(`${d} expiry: ${fmtExpiry(r.expiry)}`);
  });

  bot.command("registrar", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /registrar <domain>");
    const r = await rdapLookup(d);
    return ctx.reply(`${d} registrar: ${r.registrar || "—"}`);
  });

  bot.command("ns", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /ns <domain>");
    const r = await rdapLookup(d);
    return ctx.reply(`${d} NS:\n${(r.nameservers || []).join("\n") || "—"}`);
  });

  bot.command("age", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /age <domain>");
    const r = await rdapLookup(d);
    return ctx.reply(`${d} age: ${fmtAge(r.createdAt)} (created ${r.createdAt?.slice(0, 10) || "—"})`);
  });

  bot.command("available", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /available <domain>");
    const r = await rdapLookup(d);
    if (!r.ok) return ctx.reply(`Unknown (${r.error})`);
    return ctx.reply(r.status === "available" ? `✅ ${d} appears available` : `❌ ${d} is registered`);
  });

  bot.command("check", async (ctx) => {
    const parts = (ctx.message?.text || "").split(/\s+/).slice(1);
    const kw = parts.find((p) => !p.startsWith("--"));
    const tldsArg = parts.find((p) => p.startsWith("--tlds="))?.split("=")[1];
    if (!kw) return ctx.reply("Usage: /check <keyword> [--tlds=com,id,ai,io]");
    const tlds = (tldsArg || "com,net,io,ai,co,id,dev,xyz").split(",");
    await ctx.reply(`Checking ${tlds.length} TLDs for "${kw}"…`);
    const results: string[] = [];
    for (const tld of tlds) {
      const dom = `${kw}.${tld}`;
      const r = await rdapLookup(dom);
      const mark = r.status === "available" ? "✅" : r.status === "registered" ? "❌" : "?";
      results.push(`${mark} ${dom}`);
    }
    return ctx.reply(results.join("\n"));
  });
}
