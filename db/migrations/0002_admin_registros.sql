ALTER TABLE registrations ADD COLUMN last_whatsapp_at timestamptz;

CREATE TABLE message_templates (
  key text PRIMARY KEY,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES admin_users (id),
  CONSTRAINT message_templates_key_chk CHECK (key IN ('BIENVENIDA', 'CAMBIO_ESTADO', 'RECORDATORIO_DROP')),
  CONSTRAINT message_templates_body_chk CHECK (char_length(body) BETWEEN 1 AND 1000)
);

INSERT INTO message_templates (key, body) VALUES
  ('BIENVENIDA', E'Hola {nombre}. Eres el Registro No. {numero} del archivo drmr.\nTu expediente: {link}\nEl {fecha_drop} entras antes que nadie.'),
  ('CAMBIO_ESTADO', E'Hola {nombre}. Tu pieza No. {numero} ahora está: {estado}.\nTu expediente: {link}'),
  ('RECORDATORIO_DROP', E'{nombre}, el {fecha_drop} abre el archivo para registrados.\nTu expediente: {link}');
