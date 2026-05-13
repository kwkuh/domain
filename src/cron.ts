import type { Bot } from "grammy";
import { getDb, type DomainRow } from "./lib/db.js";
import { rdapLookup } from "./lib/rdap.js";

const TICK_MS = (Number(process.env.TICK_MINUTES || 60)) * 60 * 1000;
// Re-poll RDAP for any domain not refreshed in this many hours.
const RDAP_REFRESH_HOURS = 24;

export function startCron(bot: Bot) {
  setTimeout(() => tick(bot).catch(console.error), 30_000);
  setInterval(() => tick(bot).catch(console.error), TICK_MS);
}

async function tick(bot: Bot) {
  await refreshStale();
  await fireExpiryAlerts(bot);
  await fireWatchAlerts(bot);
}

async function refreshStale() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM domains
       WHERE archived = 0
         AND (last_rdap_at IS NULL OR julianday('now') - julianday(last_rdap_at) > ?)
       ORDER BY last_rdap_at ASC NULLS FIRST
       LIMIT 20`,
    )
    .all(RDAP_REFRESH_HOURS / 24) as DomainRow[];
  for (const r of rows) {
    const res = await rdapLookup(r.name);
    if (!res.ok) continue;
    if (res.status === "available") {
      db.prepare(`UPDATE domains SET status='available', last_rdap_at=CURRENT_TIMESTAMP WHERE name=?`).run(r.name);
      db.prepare(`INSERT INTO events (domain, kind, payload) VALUES (?, 'available', NULL)`).run(r.name);
      continue;
    }
    const oldNs = r.nameservers || "";
    const newNs = (res.nameservers || []).join(",");
    const oldStatus = r.rdap_status || "";
    const newStatus = (res.rdapStatus || []).join(",");
    db.prepare(
      `UPDATE domains SET registrar=?, expiry=?, created_at_rdap=?, updated_at_rdap=?,
       nameservers=?, dnssec=?, rdap_status=?, last_rdap_at=CURRENT_TIMESTAMP, status='active'
       WHERE name=?`,
    ).run(
      res.registrar || null,
      res.expiry || null,
      res.createdAt || null,
      res.updatedAt || null,
      newNs,
      res.dnssec ? 1 : 0,
      newStatus,
      r.name,
    );
    if (oldNs && oldNs !== newNs) {
      db.prepare(`INSERT INTO events (domain, kind, payload) VALUES (?, 'ns_change', ?)`).run(
        r.name,
        JSON.stringify({ old: oldNs, new: newNs }),
      );
    }
    if (oldStatus && oldStatus !== newStatus) {
      db.prepare(`INSERT INTO events (domain, kind, payload) VALUES (?, 'status_change', ?)`).run(
        r.name,
        JSON.stringify({ old: oldStatus, new: newStatus }),
      );
    }
    await sleep(500); // be polite to RDAP
  }
}

async function fireExpiryAlerts(bot: Bot) {
  const db = getDb();
  const pending = db
    .prepare(
      `SELECT r.id, r.domain, r.days_before, d.expiry, d.owner_id
       FROM reminders r
       JOIN domains d ON d.name = r.domain
       WHERE r.fired = 0 AND d.expiry IS NOT NULL
         AND julianday(d.expiry) - julianday('now') <= r.days_before
         AND julianday(d.expiry) - julianday('now') >= 0`,
    )
    .all() as { id: number; domain: string; days_before: number; expiry: string; owner_id: number }[];
  for (const p of pending) {
    try {
      await bot.api.sendMessage(
        p.owner_id,
        `⏰ Reminder: ${p.domain} expires in ${p.days_before}d (${p.expiry.slice(0, 10)})`,
      );
      db.prepare("UPDATE reminders SET fired = 1 WHERE id = ?").run(p.id);
    } catch {
      /* user blocked bot etc. */
    }
  }
}

async function fireWatchAlerts(bot: Bot) {
  const db = getDb();
  const events = db
    .prepare(
      `SELECT e.id, e.domain, e.kind, e.payload, d.owner_id
       FROM events e
       JOIN domains d ON d.name = e.domain
       LEFT JOIN watches w ON w.domain = e.domain AND (w.kind = e.kind OR w.kind = 'all')
       WHERE w.domain IS NOT NULL
         AND e.id > COALESCE((SELECT CAST(value AS INTEGER) FROM prefs WHERE key='last_event_id' AND owner_id=d.owner_id), 0)
       ORDER BY e.id`,
    )
    .all() as { id: number; domain: string; kind: string; payload: string | null; owner_id: number }[];
  let lastByOwner = new Map<number, number>();
  for (const e of events) {
    try {
      await bot.api.sendMessage(e.owner_id, `🔔 ${e.domain} — ${e.kind}${e.payload ? `\n${e.payload}` : ""}`);
      lastByOwner.set(e.owner_id, Math.max(lastByOwner.get(e.owner_id) || 0, e.id));
    } catch {
      /* ignore */
    }
  }
  const stmt = db.prepare(
    `INSERT INTO prefs (owner_id, key, value) VALUES (?, 'last_event_id', ?)
     ON CONFLICT(owner_id, key) DO UPDATE SET value = excluded.value`,
  );
  for (const [owner, id] of lastByOwner) stmt.run(owner, String(id));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
