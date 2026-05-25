-- Añadir columna verified_at para rastrear cuándo el usuario verificó el lead en Maps
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;
