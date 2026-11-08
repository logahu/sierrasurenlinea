-- Nuevo negocio: autos usados y reparados (nombre provisional; se cambia desde el panel).
-- La dirección queda en /autos aunque cambie el nombre.

-- Fotos adicionales de un producto (galería), URLs separadas por "|". La principal sigue en imagen_url.
ALTER TABLE producto ADD COLUMN galeria VARCHAR(2000);

INSERT INTO negocio (id, slug, nombre, eslogan, descripcion, tipo, color_primario, portada_url, whatsapp, telefono, direccion, horario, solo_mayores_edad, orden)
VALUES (6, 'autos', 'Autos de la Sierra', 'Autos usados, revisados y listos para rodar',
        'Autos, SUV y pickups usados y reparados. Revisa fotos, kilometraje y precio, y pregunta por WhatsApp para verlos en persona.',
        'VENTA', '#e8a400', 'img/auto-pickup.svg', '525540485363', NULL, 'Miahuatlán de Porfirio Díaz, Oax.',
        'Lun a Sáb 9:00 – 18:00 (con cita)', FALSE, 6);

INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (19, 6, 'autos', 'Autos', 'Sedán y hatchback', 1);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (20, 6, 'suv', 'SUV y camionetas', 'Para la familia y el camino', 2);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (21, 6, 'pickups', 'Pickups', 'Para el trabajo y el campo', 3);

-- Ejemplos para ver cómo se ve la sección; se reemplazan desde el panel.
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible)
VALUES (41, 'Sedán compacto 2016 (ejemplo)', 'Un solo dueño, servicio reciente. Ideal para la ciudad: rinde mucho la gasolina.', 135000.00, NULL,
        'Año: 2016|Kilometraje: 98,000 km|Transmisión: Manual|Combustible: Gasolina|Motor: 1.6 L, 4 cilindros|Color: Gris|Reparaciones: frenos y suspensión nuevos',
        'img/auto-sedan.svg', 19, TRUE, TRUE);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible)
VALUES (42, 'SUV mediana 2014 (ejemplo)', 'Cómoda para la familia, tres filas de asientos. Llantas al 80%.', 189000.00, NULL,
        'Año: 2014|Kilometraje: 142,000 km|Transmisión: Automática|Combustible: Gasolina|Motor: 2.4 L, 4 cilindros|Color: Blanco|Reparaciones: afinación mayor y clutch del aire acondicionado',
        'img/auto-suv.svg', 20, FALSE, TRUE);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible)
VALUES (43, 'Pickup doble cabina 2012 (ejemplo)', 'Lista para el trabajo pesado y la terracería. Papeles en regla.', 215000.00, NULL,
        'Año: 2012|Kilometraje: 180,000 km|Transmisión: Manual|Combustible: Diésel|Motor: 2.5 L turbo|Color: Rojo|Reparaciones: motor ajustado y caja revisada',
        'img/auto-pickup.svg', 21, TRUE, TRUE);
