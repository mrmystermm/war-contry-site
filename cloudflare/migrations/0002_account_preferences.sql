-- Préférences personnelles synchronisées entre les appareils.
CREATE TABLE IF NOT EXISTS account_preferences (
  account_id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  updated_at INTEGER NOT NULL
);
