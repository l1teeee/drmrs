ALTER TABLE drops
  ADD COLUMN registration_hours integer,
  ADD COLUMN registration_opened_at timestamptz,
  ADD CONSTRAINT drops_registration_hours_chk CHECK (registration_hours IS NULL OR registration_hours BETWEEN 1 AND 2160);
UPDATE drops SET registration_opened_at = now() WHERE status = 'REGISTRO';
