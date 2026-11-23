-- À exécuter dans la base D1 warcontry-votes.
-- Associe les nouvelles sessions de vote au compte War Contry connecté.
ALTER TABLE sp_vote_sessions ADD COLUMN account_id TEXT;
