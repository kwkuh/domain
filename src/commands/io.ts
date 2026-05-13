import type { Bot, Context } from "grammy";
import { getDb, type DomainRow } from "../lib/db.js";
import { parseDomain } from "../lib/rdap.js";

function owner(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

export function register(bot: Bot) {
  bot.command("export", async (ctx) => {
    const format = (ctx.message?.text || "").match(/--format=(\w+)/)?.[1] || "csv";
    const rows = getDb()
      .prepare("SELECT * FROM domains WHERE owner_id = ? AND archived = 0 ORDER BY name")
      .all(owner(ctx)) as DomainRow[];
    if (!rows.length) return ctx.reply("Nothing to export.");
    let body = "";
    if (format === "json" || format === "ndjson") {
      body =
        format === "ndjson"
          ? rows.map((r) => JSON.stringify(r)).join("\n")
          : JSON.stringify(rows, null, 2);
    } else if (format === "txt") {
      body = rows.map((r) => r.name).join("\n");
    } else {
      const cols = ["name", "status", "registrar", "expiry", "buy_price", "bin", "category"] as const;
      body =
        cols.join(",") +
        "\n" +
        rows
          .map((r) => cols.map((c) => csvCell((r as any)[c])).join(","))
          .join("\n");
    }
    const filename = `portfolio.${format === "ndjson" ? "ndjson" : format}`;
    return ctx.replyWithDocument(
      new (await import("grammy")).InputFile(Buffer.from(body, "utf8"), filename),
    );
  });

  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    if (!doc.file_name?.match(/\.(csv|txt|ndjson|json)$/i)) return;
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const res = await fetch(url);
    const text = await res.text();
    const ext = doc.file_name.split(".").pop()!.toLowerCase();
    const names = parseImport(text, ext);
    let added = 0;
    const stmt = getDb().prepare(
      `INSERT OR IGNORE INTO domains (name, owner_id) VALUES (?, ?)`,
    );
    for (const n of names) {
      const d = parseDomain(n);
      if (!d) continue;
      const res = stmt.run(d, owner(ctx));
      if (res.changes) added++;
    }
    return ctx.reply(`Imported ${added} new domains (skipped duplicates/invalid).`);
  });
}

function csvCell(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseImport(text: string, ext: string): string[] {
  if (ext === "txt") return text.split(/\r?\n/).filter(Boolean);
  if (ext === "ndjson") {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l).name;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];
  }
  if (ext === "json") {
    try {
      const arr = JSON.parse(text);
      return Array.isArray(arr) ? arr.map((r: any) => r.name || r).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  // CSV: first column = name (or header includes "name")
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  const nameIdx = header.split(",").indexOf("name");
  const start = nameIdx >= 0 ? 1 : 0;
  const idx = nameIdx >= 0 ? nameIdx : 0;
  return lines.slice(start).map((l) => l.split(",")[idx]?.trim()).filter(Boolean) as string[];
}
