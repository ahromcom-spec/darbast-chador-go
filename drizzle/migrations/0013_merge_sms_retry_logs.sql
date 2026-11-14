ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

UPDATE public.sms_logs SET last_attempt_at = created_at WHERE last_attempt_at IS NULL;
ALTER TABLE public.sms_logs ALTER COLUMN last_attempt_at SET DEFAULT now();
ALTER TABLE public.sms_logs ALTER COLUMN last_attempt_at SET NOT NULL;

-- Merge historical retry chains: attempts of the same message (recipient + order + template)
-- separated by less than 20 minutes become one row.
CREATE TEMP TABLE _sms_chain ON COMMIT DROP AS
WITH ordered AS (
  SELECT id, recipient, coalesce(order_code,'') AS oc, coalesce(template_key,'') AS tk, status, created_at,
    CASE WHEN lag(created_at) OVER w IS NULL OR created_at - lag(created_at) OVER w > interval '20 minutes'
         THEN 1 ELSE 0 END AS new_chain
  FROM public.sms_logs
  WHERE status IN ('failed','sent')
  WINDOW w AS (PARTITION BY recipient, coalesce(order_code,''), coalesce(template_key,'') ORDER BY created_at)
)
SELECT *, sum(new_chain) OVER (PARTITION BY recipient, oc, tk ORDER BY created_at) AS chain_no
FROM ordered;

CREATE TEMP TABLE _sms_merge ON COMMIT DROP AS
SELECT f.id AS failed_id, f.created_at AS failed_at,
  coalesce(
    (SELECT s.id FROM _sms_chain s
       WHERE s.recipient = f.recipient AND s.oc = f.oc AND s.tk = f.tk AND s.chain_no = f.chain_no
         AND s.status = 'sent' AND s.created_at > f.created_at
       ORDER BY s.created_at LIMIT 1),
    (SELECT l.id FROM _sms_chain l
       WHERE l.recipient = f.recipient AND l.oc = f.oc AND l.tk = f.tk AND l.chain_no = f.chain_no
         AND l.status = 'failed'
       ORDER BY l.created_at DESC LIMIT 1)
  ) AS keeper_id
FROM _sms_chain f
WHERE f.status = 'failed';

DELETE FROM _sms_merge WHERE failed_id = keeper_id;

UPDATE public.sms_logs k
SET attempts = k.attempts + m.cnt,
    last_attempt_at = k.created_at,
    created_at = least(k.created_at, m.first_at)
FROM (SELECT keeper_id, count(*)::int AS cnt, min(failed_at) AS first_at FROM _sms_merge GROUP BY keeper_id) m
WHERE k.id = m.keeper_id;

DELETE FROM public.sms_logs WHERE id IN (SELECT failed_id FROM _sms_merge);

-- Waiting list: drop failed entries that were replaced by a later retry of the same message.
DELETE FROM public.scheduled_sms a
WHERE a.state = 'failed'
  AND EXISTS (
    SELECT 1 FROM public.scheduled_sms b
    WHERE b.phone = a.phone
      AND coalesce(b.order_code,'') = coalesce(a.order_code,'')
      AND b.status_key = a.status_key
      AND b.created_at > a.created_at
      AND b.created_at <= a.created_at + interval '20 minutes'
  );