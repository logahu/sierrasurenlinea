-- Panel (fase 2): productos y categorías se dan de alta desde el panel.
-- Los ids nuevos salen de secuencias que empiezan después de los datos iniciales.
CREATE SEQUENCE producto_seq START WITH 1000;
CREATE SEQUENCE categoria_seq START WITH 100;

-- Encarguitos: cuánto puede adelantar el repartidor de su bolsa (antes fijo en el sitio).
ALTER TABLE negocio ADD COLUMN tope_adelanto INTEGER;
UPDATE negocio SET tope_adelanto = 500 WHERE tipo = 'SERVICIO';
