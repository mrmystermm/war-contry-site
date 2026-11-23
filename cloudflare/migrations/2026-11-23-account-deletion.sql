-- War Contry account deletion confirmation tokens
CREATE TABLE IF NOT EXISTS account_deletion_tokens (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_tokens_account
ON account_deletion_tokens(account_id);