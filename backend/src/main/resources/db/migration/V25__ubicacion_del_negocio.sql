-- Ubicación y forma de atención de cada negocio (todo opcional).
-- atencion_en_local: true = tiene local para visitas; false = «Atención solo en línea».
ALTER TABLE negocio ADD COLUMN atencion_en_local BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE negocio ADD COLUMN colonia VARCHAR(100);
ALTER TABLE negocio ADD COLUMN referencias VARCHAR(200);
ALTER TABLE negocio ADD COLUMN lat NUMERIC(9, 6);
ALTER TABLE negocio ADD COLUMN lng NUMERIC(9, 6);

-- Los que ya tienen dirección se consideran con local.
UPDATE negocio SET atencion_en_local = TRUE WHERE direccion IS NOT NULL AND TRIM(direccion) <> '';
