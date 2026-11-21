CREATE TABLE claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_day TINYINT UNSIGNED NOT NULL,
  pseudo VARCHAR(32) NOT NULL,
  pseudo_normalized VARCHAR(64) NOT NULL,
  claimed_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unique_day_pseudo (claim_day, pseudo_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
