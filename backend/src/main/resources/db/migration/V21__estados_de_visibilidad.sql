-- Tres estados de visibilidad por negocio:
--   PUBLICO: lo ven todos los clientes.
--   PRUEBAS: solo lo ven los clientes marcados como probadores (para revisarlo antes de abrirlo).
--   OCULTO:  no lo ve nadie en el sitio (solo el panel).
-- Los negocios que estaban ocultos pasan a "en pruebas".
ALTER TABLE negocio ADD COLUMN estado VARCHAR(10) DEFAULT 'PUBLICO' NOT NULL;
UPDATE negocio SET estado = 'PRUEBAS' WHERE visible = FALSE;
ALTER TABLE negocio DROP COLUMN visible;

-- Clientes que prueban los negocios en pruebas; sus pedidos se marcan como prueba.
ALTER TABLE cliente ADD COLUMN probador BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE pedido ADD COLUMN prueba BOOLEAN DEFAULT FALSE NOT NULL;
