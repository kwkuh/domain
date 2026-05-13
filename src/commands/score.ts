import type { Bot, Context } from "grammy";
import { parseDomain } from "../lib/rdap.js";
import {
  scoreDomain,
  typoVariants,
  pluralVariant,
  singularVariant,
  hyphenVariants,
} from "../lib/score.js";

function arg(ctx: Context): string | null {
  const t = (ctx.message?.text || "").split(/\s+/).slice(1)[0];
  return t ? parseDomain(t) || t.toLowerCase() : null;
}

export function register(bot: Bot) {
  bot.command("score", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /score <domain>");
    const s = scoreDomain(d);
    return ctx.reply(
      [
        `Score: ${d}`,
        ``,
        `Total:         ${s.total}/100`,
        `Brandability:  ${s.brandability}/100`,
        `Length:        ${s.length}/100`,
        `Pronounce:     ${s.pronounce}/100`,
        `Vowel ratio:   ${s.vowelRatio}`,
        `TLD:           ${s.tld}/100`,
        `Keyword:       ${s.keyword}/100`,
        `Hyphen:        ${s.hasHyphen ? "yes (penalty)" : "no"}`,
        `Number:        ${s.hasNumber ? "yes (penalty)" : "no"}`,
      ].join("\n"),
    );
  });

  bot.command("brandability", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /brandability <domain>");
    const s = scoreDomain(d);
    return ctx.reply(`${d} brandability: ${s.brandability}/100`);
  });

  bot.command("length", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /length <domain>");
    const sld = d.split(".")[0];
    return ctx.reply(`${d} SLD length: ${sld.length}`);
  });

  bot.command(["vowel-ratio", "vowel"], async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /vowel-ratio <domain>");
    const s = scoreDomain(d);
    return ctx.reply(`${d} vowel ratio: ${s.vowelRatio}`);
  });

  bot.command("typo", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /typo <domain>");
    const [sld, ...rest] = d.split(".");
    const tld = rest.join(".") || "com";
    const variants = typoVariants(sld).slice(0, 40);
    return ctx.reply(`Typos (40 of ${typoVariants(sld).length}):\n` + variants.map((v) => `${v}.${tld}`).join("\n"));
  });

  bot.command("plural", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /plural <domain>");
    const [sld, ...rest] = d.split(".");
    return ctx.reply(`${pluralVariant(sld)}.${rest.join(".") || "com"}`);
  });

  bot.command("singular", async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /singular <domain>");
    const [sld, ...rest] = d.split(".");
    return ctx.reply(`${singularVariant(sld)}.${rest.join(".") || "com"}`);
  });

  bot.command(["hyphen", "nohyphen"], async (ctx) => {
    const d = arg(ctx);
    if (!d) return ctx.reply("Usage: /hyphen <domain>");
    const [sld, ...rest] = d.split(".");
    const tld = rest.join(".") || "com";
    const v = hyphenVariants(sld);
    return ctx.reply(v.map((s) => `${s}.${tld}`).join("\n"));
  });
}
