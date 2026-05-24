-- ─────────────────────────────────────────────────────────────────────────────
-- Follow-up system — ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Añadir columnas (sin DEFAULT para poder inicializar con updated_at)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS stage_updated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS follow_up_dismissed_at TIMESTAMPTZ NULL;

-- 2. Inicializar stage_updated_at con updated_at en filas existentes
--    (así los leads que llevan días en una etapa ya entran en el contador)
UPDATE prospects SET stage_updated_at = updated_at WHERE stage_updated_at IS NULL;

-- 3. A partir de ahora, insertar con NOW() por defecto
ALTER TABLE prospects ALTER COLUMN stage_updated_at SET DEFAULT NOW();

-- 4. Trigger: resetear follow-up al cambiar de etapa
CREATE OR REPLACE FUNCTION update_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_updated_at        = NOW();
    NEW.follow_up_sent_at       = NULL;
    NEW.follow_up_dismissed_at  = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stage_timestamp ON prospects;
CREATE TRIGGER trigger_stage_timestamp
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_stage_timestamp();

-- ─────────────────────────────────────────────────────────────────────────────
-- Cron job — ejecutar DESPUÉS de desplegar la edge function
-- Requiere la extensión pg_cron (activa por defecto en Supabase)
-- Sustituir REEMPLAZA_CON_TU_CRON_SECRET por el valor que elijas
-- ─────────────────────────────────────────────────────────────────────────────
/*
SELECT cron.schedule(
  'follow-up-reminders',
  '0 8 * * *',
  $$SELECT net.http_post(
    url:='https://eandeidsiljaellamrhi.supabase.co/functions/v1/send-followup-reminders',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhbmRlaWRzaWxqYWVsbGFtcmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjA2NTAsImV4cCI6MjA5NDU5NjY1MH0.bLqQx0xOLTWSJmXMsXlg2kYMfhYSbNkyLBD0g-Js0O0", "x-cron-secret": "REEMPLAZA_CON_TU_CRON_SECRET"}'::jsonb
  )$$
);
*/

-- Para verificar que el cron quedó registrado:
-- SELECT * FROM cron.job;

-- Para borrar el cron si necesitas reconfigurarlo:
-- SELECT cron.unschedule('follow-up-reminders');
