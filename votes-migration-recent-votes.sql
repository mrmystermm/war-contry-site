-- À exécuter UNE SEULE FOIS dans la base D1 warcontry-votes existante.
ALTER TABLE sp_vote_sessions ADD COLUMN baseline_voted_at INTEGER NOT NULL DEFAULT 0;
