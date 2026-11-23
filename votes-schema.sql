-- À exécuter dans la base D1 liée au Worker warcontry-votes.
CREATE TABLE IF NOT EXISTS sp_vote_sessions (
  id TEXT PRIMARY KEY,
  pseudo TEXT NOT NULL,
  otp_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'expired')),
  created_at INTEGER NOT NULL,
  voted_at INTEGER,
  next_vote_seconds INTEGER,
  baseline_voted_at INTEGER NOT NULL DEFAULT 0,
  account_id TEXT
);

CREATE TABLE IF NOT EXISTS sp_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudo TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  next_vote_seconds INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  UNIQUE (source, voted_at)
);

CREATE INDEX IF NOT EXISTS idx_sp_votes_pseudo ON sp_votes(pseudo);
