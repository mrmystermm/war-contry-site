CREATE TABLE IF NOT EXISTS minecraft_link_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  minecraft_uuid TEXT NOT NULL,
  minecraft_username TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_minecraft_link_codes_expiry
  ON minecraft_link_codes(expires_at);

CREATE TABLE IF NOT EXISTS minecraft_links (
  account_id TEXT PRIMARY KEY,
  minecraft_uuid TEXT NOT NULL UNIQUE,
  minecraft_username TEXT NOT NULL,
  linked_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
