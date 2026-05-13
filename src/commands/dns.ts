import type { Bot, Context } from "grammy";
import { parseDomain } from "../lib/rdap.js";
import { resolveAll, safeResolve, detectParking } from "../lib/dns.js";

function arg(ctx: Context): string | null {
  const t = (ctx.message?.text || "").split(/\s+/).slice(1)[0];
  return t ? parseDomain(t) : null;
}

export function register(bot: Bot) {
  bot.command("dns", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /dns <domain>");
    const records = await resolveAll(d);
    if (!records.length) return ctx.reply(`No DNS records for ${d}.`);
    const lines = records.map((r) => `${r.type.padEnd(6)} ${r.values.join("\n       ")}`);
    return ctx.reply(`${d}\n${lines.join("\n")}`);
  });

  for (const t of ["a", "aaaa", "mx", "txt", "cname", "soa"] as const) {
    bot.command(t, async (ctx) => {
      const d = arg(ctx);
      if (!d) return ctx.reply(`Usage: /${t} <domain>`);
      const vals = await safeResolve(d, t.toUpperCase() as any);
      return ctx.reply(vals.length ? vals.join("\n") : `(no ${t.toUpperCase()} records)`);
    });
  }

  bot.command("spf", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /spf <domain>");
    const txt = await safeResolve(d, "TXT");
    const spf = txt.filter((r) => r.toLowerCase().startsWith("v=spf1"));
    return ctx.reply(spf.length ? spf.join("\n") : "(no SPF record)");
  });

  bot.command("dmarc", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /dmarc <domain>");
    const txt = await safeResolve(`_dmarc.${d}`, "TXT");
    return ctx.reply(txt.length ? txt.join("\n") : "(no DMARC record)");
  });

  bot.command("parking", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /parking <domain>");
    const ns = await safeResolve(d, "NS");
    const provider = detectParking(ns);
    return ctx.reply(provider ? `${d} is parked at: ${provider}` : `${d} no parking provider detected.\nNS: ${ns.join(", ") || "—"}`);
  });
}
