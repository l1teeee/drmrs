ALTER TABLE registrations ADD COLUMN instagram_activation_sent_at timestamptz;
ALTER TABLE message_templates DROP CONSTRAINT message_templates_key_chk;
ALTER TABLE message_templates ADD CONSTRAINT message_templates_key_chk CHECK (key IN ('BIENVENIDA', 'CAMBIO_ESTADO', 'RECORDATORIO_DROP', 'ACTIVACION'));
INSERT INTO message_templates (key, body) VALUES
  ('ACTIVACION', E'Hola {nombre}, somos drmr.\nYa estás en el archivo con el No. {numero}.\nContéstanos cualquier cosa por aquí para activar tu registro y recibir los avisos del drop.');
