// RDAP client — uses rdap.org bootstrap (free, IANA-blessed, no key needed).
// Falls back to port-43 WHOIS for TLDs without RDAP coverage.

import { whoisLookup } from "./whois.js";

export type RdapResult = {
  ok: boolean;
  status: "registered" | "available" | "unknown";
  registrar?: string;
  expiry?: string;
  createdAt?: string;
  updatedAt?: string;
  nameservers?: string[];
  dnssec?: boolean;
  rdapStatus?: string[];
  raw?: unknown;
  error?: string;
};

const BOOTSTRAP = process.env.RDAP_BOOTSTRAP || "https://rdap.org";

export async function rdapLookup(domain: string): Promise<RdapResult> {
  const d = domain.trim().toLowerCase();
  try {
    const res = await fetch(`${BOOTSTRAP}/domain/${encodeURIComponent(d)}`, {
      headers: { Accept: "application/rdap+json" },
      redirect: "follow",
    });
    if (res.status === 404) {
      return { ok: true, status: "available" };
    }
    if (res.status === 501 || res.status === 400 || res.status === 422) {
      // TLD not supported by RDAP bootstrap — try WHOIS.
      return await whoisToRdap(d);
    }
    if (!res.ok) {
      // Network/server issue — try WHOIS as last resort.
      const fb = await whoisToRdap(d);
      if (fb.ok) return fb;
      return { ok: false, status: "unknown", error: `HTTP ${res.status}` };
    }
    const json: any = await res.json();
    const events: any[] = json.events || [];
    const findEvent = (action: string) =>
      events.find((e) => e.eventAction === action)?.eventDate;
    const registrarEntity = (json.entities || []).find((e: any) =>
      (e.roles || []).includes("registrar"),
    );
    const registrar =
      registrarEntity?.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3] ||
      registrarEntity?.handle;
    const nameservers = (json.nameservers || [])
      .map((n: any) => (n.ldhName || "").toLowerCase())
      .filter(Boolean);
    return {
      ok: true,
      status: "registered",
      registrar,
      expiry: findEvent("expiration"),
      createdAt: findEvent("registration"),
      updatedAt: findEvent("last changed"),
      nameservers,
      dnssec: json.secureDNS?.delegationSigned === true,
      rdapStatus: json.status,
      raw: json,
    };
  } catch (err: any) {
    // Network failure — try WHOIS fallback.
    const fb = await whoisToRdap(d).catch(() => null);
    if (fb && fb.ok) return fb;
    return { ok: false, status: "unknown", error: err?.message || String(err) };
  }
}

async function whoisToRdap(domain: string): Promise<RdapResult> {
  const w = await whoisLookup(domain);
  if (!w.ok) return { ok: false, status: w.status, error: w.error };
  if (w.status === "available") return { ok: true, status: "available" };
  return {
    ok: true,
    status: "registered",
    registrar: w.registrar,
    expiry: w.expiry,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    nameservers: w.nameservers,
    rdapStatus: [],
    raw: { source: "whois", server: w.whoisServer },
  };
}

export function parseDomain(input: string): string | null {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}
