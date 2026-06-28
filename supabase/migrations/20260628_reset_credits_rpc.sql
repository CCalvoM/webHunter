-- La tabla credits solo tiene política RLS de SELECT, no de UPDATE.
-- useCredits.ts intentaba hacer un UPDATE directo desde el cliente para resetear
-- el contador diario, pero RLS lo bloqueaba (0 filas afectadas -> PGRST116/406).
-- Esto significa que searches_used/audits_used nunca volvían a 0 cada día.
--
-- Esta función RPC corre con privilegios elevados (bypassa RLS) pero está acotada:
-- solo puede tocar la fila del propio usuario autenticado y solo si reset_date es
-- de un día anterior. No se expone ningún UPDATE genérico al cliente.

CREATE OR REPLACE FUNCTION reset_daily_credits_if_needed()
RETURNS credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result credits;
BEGIN
  UPDATE credits
  SET searches_used = 0,
      audits_used = 0,
      reset_date = NOW()
  WHERE user_id = auth.uid()
    AND reset_date::date < CURRENT_DATE
  RETURNING * INTO result;

  IF result IS NULL THEN
    SELECT * INTO result FROM credits WHERE user_id = auth.uid();
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_daily_credits_if_needed() TO authenticated;
