-- Agrega el tipo de negocio SERVICIO (Encarguitos: mandados en moto).
-- Versión para H2 (desarrollo y pruebas): H2 le pone un nombre automático al CHECK
-- de V1, así que se busca en INFORMATION_SCHEMA y se elimina con EXECUTE IMMEDIATE.
EXECUTE IMMEDIATE 'ALTER TABLE negocio DROP CONSTRAINT "' ||
  (SELECT constraint_name FROM information_schema.table_constraints
    WHERE LOWER(table_name) = 'negocio' AND constraint_type = 'CHECK' FETCH FIRST 1 ROW ONLY) || '"';
ALTER TABLE negocio ADD CONSTRAINT ck_negocio_tipo CHECK (tipo IN ('VENTA', 'RENTA', 'SERVICIO'));
