-- Recepcionista IA (fase 1): la agenda lista para que la use el bot de WhatsApp.

-- Cada servicio dice cuántos bloques de la agenda ocupa (p. ej. con bloques de 30 min:
-- limpieza 1, ortodoncia 2). Los servicios de antes siguen ocupando uno.
ALTER TABLE producto ADD COLUMN bloques_cita INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE producto ADD CONSTRAINT ck_producto_bloques_cita CHECK (bloques_cita BETWEEN 1 AND 8);

-- Clientes que llegan por WhatsApp: se registran con su teléfono y nombre, aún sin contraseña.
-- Si un día quieren entrar al sitio, crean su contraseña con «Crear cuenta».
ALTER TABLE cliente ALTER COLUMN contrasena_hash DROP NOT NULL;
ALTER TABLE cliente ADD COLUMN origen VARCHAR(10) DEFAULT 'WEB' NOT NULL;

-- Por dónde llegó el pedido o la cita: WEB (sitio o app) o WHATSAPP (recepcionista IA).
ALTER TABLE pedido ADD COLUMN origen VARCHAR(10) DEFAULT 'WEB' NOT NULL;
