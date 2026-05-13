#!/usr/bin/env node
// Minimal HTTP server: serves generated landing pages + read-only JSON API.
// No deps — uses node:http.

import "dotenv/config";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { URL } from "node:url";
import { getDb, type DomainRow } from "./lib/db.js";

const PORT = Number(process.env.PORT || process.env.HTTP_PORT || 7777);
const LANDING_DIR = process.env.LANDING_DIR || "./landings";
const API_TOKEN = process.env.HTTP_API_TOKEN || ""; // optional; if set, /api/* requires it
const INQUIRY_FORWARD_CHAT = Number(process.env.INQUIRY_TG_CHAT_ID || 0); // bot owner chat id for inquiries
const BOT_TOKEN = process.env.BOT_TOKEN || "";

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

function html(res: http.ServerResponse, code: number, body: string) {
  res.writeHead(code, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

function authed(req: http.IncomingMessage): boolean {
  if (!API_TOKEN) return true;
  const h = req.headers["authorization"];
  if (typeof h !== "string") return false;
  return h === `Bearer ${API_TOKEN}`;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c.toString("utf8")));
    req.on("end", () => resolve(buf));
  });
}

async function forwardInquiry(payload: Record<string, string>) {
  if (!BOT_TOKEN || !INQUIRY_FORWARD_CHAT) return;
  const lines = ["📩 New inquiry"];
  for (const [k, v] of Object.entries(payload)) lines.push(`${k}: ${v}`);
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: INQUIRY_FORWARD_CHAT, text: lines.join("\n") }),
  }).catch(() => {});
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    });
    return res.end();
  }

  try {
    // --- Landing pages ---
    if (path === "/" || path === "/index.html") {
      return html(res, 200, indexPage());
    }
    if (path.match(/^\/[a-z0-9.-]+\.html$/i)) {
      const file = join(LANDING_DIR, path.slice(1));
      if (!existsSync(file)) return html(res, 404, "<h1>404</h1>");
      return html(res, 200, readFileSync(file, "utf8"));
    }

    // --- API ---
    if (path === "/api/health") {
      return json(res, 200, { ok: true, ts: new Date().toISOString() });
    }

    if (path.startsWith("/api/")) {
      if (!authed(req)) return json(res, 401, { error: "unauthorized" });
    }

    if (path === "/api/portfolio" && req.method === "GET") {
      const ownerParam = url.searchParams.get("owner");
      if (ownerParam == null || !/^-?\d+$/.test(ownerParam)) {
        return json(res, 400, { error: "owner query param required (integer)" });
      }
      const owner = Number(ownerParam);
      const rows = getDb()
        .prepare("SELECT * FROM domains WHERE owner_id = ? AND archived = 0 ORDER BY name")
        .all(owner) as DomainRow[];
      return json(res, 200, { count: rows.length, domains: rows });
    }

    if (path === "/api/for-sale" && req.method === "GET") {
      const rows = getDb()
        .prepare("SELECT name, bin, floor, registrar FROM domains WHERE status = 'for_sale' AND archived = 0 ORDER BY name")
        .all();
      return json(res, 200, { count: (rows as unknown[]).length, domains: rows });
    }

    if (path === "/api/inquiry" && req.method === "POST") {
      const body = await readBody(req);
      let payload: Record<string, string> = {};
      try {
        if ((req.headers["content-type"] || "").includes("json")) {
          payload = JSON.parse(body);
        } else {
          for (const [k, v] of new URLSearchParams(body)) payload[k] = v;
        }
      } catch {}
      if (!payload.domain || !payload.email) return json(res, 400, { error: "domain and email required" });
      const db = getDb();
      const owns = db.prepare("SELECT owner_id FROM domains WHERE name = ?").get(payload.domain) as { owner_id: number } | undefined;
      if (!owns) return json(res, 404, { error: "domain not in any portfolio" });
      db.prepare(
        "INSERT INTO leads (domain, buyer, offer, note, status) VALUES (?, ?, ?, ?, 'open')",
      ).run(
        payload.domain,
        payload.email || payload.from || null,
        payload.offer ? Number(payload.offer) : null,
        payload.message || null,
      );
      db.prepare("INSERT INTO events (domain, kind, payload) VALUES (?, 'inquiry', ?)").run(
        payload.domain,
        JSON.stringify(payload),
      );
      await forwardInquiry(payload);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/domain" && req.method === "GET") {
      const name = url.searchParams.get("name");
      if (!name) return json(res, 400, { error: "name required" });
      const row = getDb().prepare("SELECT * FROM domains WHERE name = ?").get(name);
      if (!row) return json(res, 404, { error: "not found" });
      return json(res, 200, row);
    }

    return json(res, 404, { error: "not found", path });
  } catch (e: any) {
    return json(res, 500, { error: e?.message || "server error" });
  }
});

function indexPage(): string {
  const rows = getDb()
    .prepare("SELECT name, bin FROM domains WHERE status='for_sale' AND archived=0 ORDER BY name")
    .all() as { name: string; bin: number | null }[];
  const items = rows
    .map(
      (r) =>
        `<li><a href="/${r.name}.html"><strong>${r.name}</strong></a>${r.bin ? ` <span class=p>$${r.bin.toLocaleString()}</span>` : ""}</li>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset=utf-8><title>Domain portfolio</title>
<style>body{font:16px/1.6 system-ui;max-width:640px;margin:64px auto;padding:0 24px}
ul{list-style:none;padding:0}li{padding:8px 0;border-bottom:1px solid #eee}
.p{color:#888;float:right}a{color:#06f;text-decoration:none}</style></head>
<body><h1>Portfolio</h1><p>${rows.length} domain${rows.length === 1 ? "" : "s"} for sale</p>
<ul>${items || "<li>(nothing listed)</li>"}</ul>
<footer style="margin-top:48px;color:#888;font-size:.85rem">Powered by domain.</footer>
</body></html>`;
}

getDb();
server.listen(PORT, () => {
  console.log(`HTTP server listening on :${PORT} (landings from ${LANDING_DIR})`);
});
