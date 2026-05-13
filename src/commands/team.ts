import type { Bot, Context } from "grammy";
import { getDb } from "../lib/db.js";

function parts(ctx: Context): string[] {
  return (ctx.message?.text || "").split(/\s+/).slice(1);
}
function owner(ctx: Context): number {
  return ctx.from?.id ?? 0;
}

const ROLES = ["viewer", "editor"] as const;

export function register(bot: Bot) {
  bot.command("team", async (ctx) => {
    const [sub, target, role] = parts(ctx);
    const db = getDb();
    if (!sub || sub === "list") {
      const rows = db
        .prepare("SELECT member_id, handle, role, created_at FROM team_members WHERE owner_id = ? ORDER BY created_at")
        .all(owner(ctx)) as { member_id: number; handle: string | null; role: string; created_at: string }[];
      if (!rows.length) return ctx.reply("No team members. /team add <user_id> [role]");
      return ctx.reply(
        ["Team members:", ...rows.map((r) => `  ${r.handle || r.member_id} — ${r.role}`)].join("\n"),
      );
    }
    if (sub === "add") {
      if (!target) return ctx.reply("Usage: /team add <user_id|@handle> [viewer|editor]");
      const r = (role && (ROLES as readonly string[]).includes(role) ? role : "viewer") as string;
      const isNumeric = /^\d+$/.test(target);
      if (!isNumeric) {
        return ctx.reply(
          "Telegram bots can only add by numeric user ID (Telegram doesn't resolve @handles for bots). Ask the user to send /whoami to get their ID.",
        );
      }
      const id = Number(target);
      db.prepare(
        "INSERT OR REPLACE INTO team_members (owner_id, member_id, handle, role) VALUES (?, ?, ?, ?)",
      ).run(owner(ctx), id, null, r);
      return ctx.reply(`Added user ${id} as ${r}.`);
    }
    if (sub === "remove") {
      if (!target) return ctx.reply("Usage: /team remove <user_id>");
      const id = Number(target);
      const res = db.prepare("DELETE FROM team_members WHERE owner_id = ? AND member_id = ?").run(owner(ctx), id);
      return ctx.reply(res.changes ? `Removed ${id}.` : `${id} not in team.`);
    }
    if (sub === "role") {
      if (!target || !role) return ctx.reply("Usage: /team role <user_id> <viewer|editor>");
      if (!(ROLES as readonly string[]).includes(role)) return ctx.reply("Role must be viewer or editor.");
      const id = Number(target);
      const res = db
        .prepare("UPDATE team_members SET role = ? WHERE owner_id = ? AND member_id = ?")
        .run(role, owner(ctx), id);
      return ctx.reply(res.changes ? `Updated ${id} → ${role}.` : `${id} not in team.`);
    }
    return ctx.reply("Usage: /team list|add|remove|role <user_id> [role]");
  });

  bot.command("whoami", async (ctx) => {
    const u = ctx.from;
    if (!u) return ctx.reply("?");
    return ctx.reply(
      `ID: ${u.id}\nHandle: ${u.username ? "@" + u.username : "—"}\nName: ${u.first_name || ""} ${u.last_name || ""}`.trim(),
    );
  });

  // Shared portfolio view across teams you belong to.
  bot.command(["shared", "shared-list"], async (ctx) => {
    const rows = getDb()
      .prepare(
        `SELECT d.name, d.expiry, t.owner_id, t.role
         FROM team_members t
         JOIN domains d ON d.owner_id = t.owner_id AND d.archived = 0
         WHERE t.member_id = ?
         ORDER BY t.owner_id, d.name LIMIT 100`,
      )
      .all(owner(ctx)) as { name: string; expiry: string | null; owner_id: number; role: string }[];
    if (!rows.length) return ctx.reply("You're not a member of any other team.");
    const groups = new Map<number, { role: string; names: string[] }>();
    for (const r of rows) {
      if (!groups.has(r.owner_id)) groups.set(r.owner_id, { role: r.role, names: [] });
      groups.get(r.owner_id)!.names.push(r.name);
    }
    return ctx.reply(
      [...groups.entries()]
        .map(([oid, g]) => `Owner ${oid} [${g.role}]:\n  ${g.names.join("\n  ")}`)
        .join("\n\n"),
    );
  });
}
