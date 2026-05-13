import { promises as dns } from "node:dns";

export type DnsRecord = { type: string; values: string[] };

const TYPES = ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA"] as const;
type RecType = (typeof TYPES)[number];

export async function resolveAll(domain: string): Promise<DnsRecord[]> {
  const out: DnsRecord[] = [];
  for (const t of TYPES) {
    const values = await safeResolve(domain, t);
    if (values.length) out.push({ type: t, values });
  }
  return out;
}

export async function safeResolve(domain: string, type: RecType): Promise<string[]> {
  try {
    const res = await dns.resolve(domain, type);
    if (type === "MX") return (res as any[]).map((r) => `${r.priority} ${r.exchange}`);
    if (type === "SOA") {
      const r = res as any;
      return [`${r.nsname} ${r.hostmaster} serial=${r.serial}`];
    }
    if (type === "TXT") return (res as string[][]).map((arr) => arr.join(""));
    return res as string[];
  } catch {
    return [];
  }
}

// Parking detection via NS fingerprints.
const PARKING_NS: Record<string, string> = {
  sedoparking: "Sedo",
  "sedo.com": "Sedo",
  "dan.com": "Dan",
  "afternic.com": "Afternic",
  "above.com": "Above (DropCatch)",
  bodis: "Bodis",
  parkingcrew: "ParkingCrew",
  "uniregistry-dns": "Uniregistry",
  "hugedomains.com": "HugeDomains",
  "fabulous.com": "Fabulous",
  "godaddy.com": "GoDaddy (parked)",
  cashparking: "GoDaddy CashParking",
};

export function detectParking(nameservers: string[]): string | null {
  const lc = nameservers.map((n) => n.toLowerCase());
  for (const [needle, provider] of Object.entries(PARKING_NS)) {
    if (lc.some((n) => n.includes(needle))) return provider;
  }
  return null;
}
