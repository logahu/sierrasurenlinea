-- Agrega el tipo de negocio SERVICIO (Encarguitos: mandados en moto).
-- En PostgreSQL el CHECK de V1 se llama negocio_tipo_check.
ALTER TABLE negocio DROP CONSTRAINT negocio_tipo_check;
ALTER TABLE negocio ADD CONSTRAINT ck_negocio_tipo CHECK (tipo IN ('VENTA', 'RENTA', 'SERVICIO'));
