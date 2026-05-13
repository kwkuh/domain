import { getDb } from "./db.js";

export type Role = "owner" | "editor" | "viewer";

// Returns list of owner_ids the user has any access to (incl. themselves).
export function accessibleOwners(userId: number): number[] {
  const rows = getDb()
    .prepare("SELECT owner_id FROM team_members WHERE member_id = ?")
    .all(userId) as { owner_id: number }[];
  return [userId, ...rows.map((r) => r.owner_id)];
}

// Role check against a specific domain.
export function roleFor(userId: number, domain: string): Role | null {
  const owner = getDb()
    .prepare("SELECT owner_id FROM domains WHERE name = ?")
    .get(domain) as { owner_id: number } | undefined;
  if (!owner) return null;
  if (owner.owner_id === userId) return "owner";
  const m = getDb()
    .prepare("SELECT role FROM team_members WHERE owner_id = ? AND member_id = ?")
    .get(owner.owner_id, userId) as { role: Role } | undefined;
  return m?.role ?? null;
}

export function canRead(userId: number, domain: string): boolean {
  return roleFor(userId, domain) !== null;
}

export function canWrite(userId: number, domain: string): boolean {
  const r = roleFor(userId, domain);
  return r === "owner" || r === "editor";
}
