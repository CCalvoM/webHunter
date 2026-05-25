-- Bonus de bienvenida: se consume primero; cuando llega a 0 entran los límites diarios
ALTER TABLE credits
  ADD COLUMN IF NOT EXISTS bonus_searches INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_audits   INT NOT NULL DEFAULT 0;

-- Dar bonus a todos los usuarios existentes
UPDATE credits SET bonus_searches = 20, bonus_audits = 5;
