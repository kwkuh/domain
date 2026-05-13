import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dataDir = process.env.DATA_DIR || "./data";
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, "domainer.sqlite");
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      name           TEXT PRIMARY KEY,
      owner_id       INTEGER NOT NULL,
      status         TEXT DEFAULT 'active',
      buy_price      REAL,
      bin            REAL,
      floor          REAL,
      registrar      TEXT,
      expiry         TEXT,
      created_at_rdap TEXT,
      updated_at_rdap TEXT,
      nameservers    TEXT,
      dnssec         INTEGER,
      rdap_status    TEXT,
      last_rdap_at   TEXT,
      category       TEXT,
      pinned         INTEGER DEFAULT 0,
      starred        INTEGER DEFAULT 0,
      archived       INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      domain TEXT NOT NULL,
      tag    TEXT NOT NULL,
      PRIMARY KEY (domain, tag),
      FOREIGN KEY (domain) REFERENCES domains(name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      domain    TEXT NOT NULL,
      body      TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (domain) REFERENCES domains(name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      domain    TEXT NOT NULL,
      kind      TEXT NOT NULL,
      payload   TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watches (
      domain    TEXT NOT NULL,
      kind      TEXT NOT NULL,
      PRIMARY KEY (domain, kind)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      domain    TEXT NOT NULL,
      days_before INTEGER NOT NULL,
      fired     INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales (
      domain    TEXT PRIMARY KEY,
      sold_price REAL,
      sold_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      domain     TEXT NOT NULL,
      buyer      TEXT,
      offer      REAL,
      status     TEXT DEFAULT 'open',
      note       TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      domain    TEXT NOT NULL,
      kind      TEXT NOT NULL,
      value     TEXT,
      taken_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscribers (
      chat_id   INTEGER PRIMARY KEY,
      user_id   INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain);
    CREATE INDEX IF NOT EXISTS idx_snapshots ON snapshots(domain, kind);
    CREATE INDEX IF NOT EXISTS idx_events_domain ON events(domain);

    CREATE TABLE IF NOT EXISTS prefs (
      owner_id  INTEGER NOT NULL,
      key       TEXT NOT NULL,
      value     TEXT,
      PRIMARY KEY (owner_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_domains_owner ON domains(owner_id);
    CREATE INDEX IF NOT EXISTS idx_domains_expiry ON domains(expiry);
    CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
  `);
}

export type DomainRow = {
  name: string;
  owner_id: number;
  status: string | null;
  buy_price: number | null;
  bin: number | null;
  floor: number | null;
  registrar: string | null;
  expiry: string | null;
  created_at_rdap: string | null;
  updated_at_rdap: string | null;
  nameservers: string | null;
  dnssec: number | null;
  rdap_status: string | null;
  last_rdap_at: string | null;
  category: string | null;
  pinned: number;
  starred: number;
  archived: number;
};
