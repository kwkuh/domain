// WHOIS port-43 fallback for TLDs without RDAP (e.g. some ccTLDs).
// IANA-driven referral chain. Free, no key.

import net from "node:net";

const IANA_WHOIS = "whois.iana.org";
const PORT = 43;
const TIMEOUT_MS = 8000;

export type WhoisResult = {
  ok: boolean;
  status: "registered" | "available" | "unknown";
  registrar?: string;
  expiry?: string;
  createdAt?: string;
  updatedAt?: string;
  nameservers?: string[];
  rawText?: string;
  whoisServer?: string;
  error?: string;
};

async function query(server: string, q: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(PORT, server);
    let buf = "";
    sock.setTimeout(TIMEOUT_MS, () => {
      sock.destroy();
      reject(new Error(`timeout: ${server}`));
    });
    sock.on("connect", () => sock.write(q + "\r\n"));
    sock.on("data", (d) => (buf += d.toString("utf8")));
    sock.on("end", () => resolve(buf));
    sock.on("error", reject);
  });
}

function parseRefer(text: string): string | null {
  const m = text.match(/^(?:whois|refer):\s*(\S+)/im);
  return m ? m[1].trim() : null;
}

const AVAIL_HINTS = [
  /no match/i,
  /not found/i,
  /no entries found/i,
  /no data found/i,
  /status:\s*free/i,
  /status:\s*available/i,
  /domain.*not.*registered/i,
];

function looksAvailable(text: string): boolean {
  return AVAIL_HINTS.some((rx) => rx.test(text));
}

function pickFirst(text: string, keys: string[]): string | undefined {
  for (const k of keys) {
    const rx = new RegExp(`^\\s*${k}\\s*:\\s*(.+?)\\s*$`, "im");
    const m = text.match(rx);
    if (m) return m[1].trim();
  }
}

function pickAll(text: string, keys: string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const rx = new RegExp(`^\\s*${k}\\s*:\\s*(.+?)\\s*$`, "gim");
    for (const m of text.matchAll(rx)) out.push(m[1].trim());
  }
  return [...new Set(out)];
}

function normDate(s: string | undefined): string | undefined {
  if (!s) return;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return s;
}

export async function whoisLookup(domain: string): Promise<WhoisResult> {
  const d = domain.trim().toLowerCase();
  const tld = d.split(".").pop()!;
  try {
    const referText = await query(IANA_WHOIS, tld);
    const refer = parseRefer(referText);
    if (!refer) {
      // No referral — TLD likely has no whois server.
      return { ok: false, status: "unknown", error: "no whois server for TLD" };
    }
    const text = await query(refer, d);
    if (looksAvailable(text)) {
      return { ok: true, status: "available", whoisServer: refer, rawText: text };
    }
    const registrar = pickFirst(text, ["Registrar", "Sponsoring Registrar", "registrar name"]);
    const expiry = normDate(
      pickFirst(text, [
        "Registry Expiry Date",
        "Registrar Registration Expiration Date",
        "Expiration Date",
        "Expiry Date",
        "expires",
        "paid-till",
        "renewal date",
      ]),
    );
    const createdAt = normDate(
      pickFirst(text, ["Creation Date", "Created", "Registered", "created", "registered on"]),
    );
    const updatedAt = normDate(pickFirst(text, ["Updated Date", "Last Modified", "changed"]));
    const ns = pickAll(text, ["Name Server", "nserver", "Nameserver"]).map((s) => s.toLowerCase());
    return {
      ok: true,
      status: "registered",
      registrar,
      expiry,
      createdAt,
      updatedAt,
      nameservers: ns,
      whoisServer: refer,
      rawText: text,
    };
  } catch (err: any) {
    return { ok: false, status: "unknown", error: err?.message || String(err) };
  }
}
