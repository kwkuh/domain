import type { DomainRow } from "./db.js";

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / 86400000);
}

export function fmtAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const days = Math.floor((Date.now() - t) / 86400000);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}y ${months}m`;
  return `${days}d`;
}

export function fmtExpiry(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = daysUntil(iso);
  const date = iso.slice(0, 10);
  if (d == null) return date;
  if (d < 0) return `${date} (EXPIRED ${-d}d ago)`;
  return `${date} (${d}d)`;
}

export function fmtDomainDetail(row: DomainRow, tags: string[]): string {
  const lines = [
    `*${escMd(row.name)}*`,
    `Status:     ${row.status || "—"}`,
    `Registrar:  ${row.registrar || "—"}`,
    `Expiry:     ${fmtExpiry(row.expiry)}`,
    `Age:        ${fmtAge(row.created_at_rdap)}`,
    `NS:         ${(row.nameservers || "").split(",").filter(Boolean).slice(0, 2).join(", ") || "—"}`,
    `BIN:        ${fmtMoney(row.bin)}`,
    `Buy:        ${fmtMoney(row.buy_price)}`,
    `Tags:       ${tags.length ? tags.join(", ") : "—"}`,
  ];
  if (row.category) lines.push(`Category:   ${row.category}`);
  return lines.join("\n");
}

export function escMd(s: string): string {
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
