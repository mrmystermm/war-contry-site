-- À exécuter dans la base D1 warcontry-accounts-db.
-- Historique des votes confirmés, rattaché à l'identifiant du compte.
CREATE TABLE IF NOT EXISTS account_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  pseudo TEXT NOT NULL,
  UNIQUE (account_id, source, voted_at),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_votes_account_time
ON account_votes(account_id, voted_at DESC);
