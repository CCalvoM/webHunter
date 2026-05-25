-- Cambiar a límites diarios: 5 búsquedas y 2 audits
-- El reset lo gestiona el cliente al cargar créditos

UPDATE credits
SET
  searches_limit = 5,
  audits_limit   = 2,
  reset_date     = NOW()
WHERE plan = 'free';

UPDATE credits
SET
  searches_limit = 20,
  audits_limit   = 5,
  reset_date     = NOW()
WHERE plan = 'pro';

-- Si existe un trigger o función que crea filas nuevas en credits,
-- actualizar también los valores por defecto:
-- ALTER TABLE credits ALTER COLUMN searches_limit SET DEFAULT 5;
-- ALTER TABLE credits ALTER COLUMN audits_limit SET DEFAULT 2;
