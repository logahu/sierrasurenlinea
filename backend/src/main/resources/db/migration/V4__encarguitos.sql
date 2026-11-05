-- Encarguitos: mandados en moto por Miahuatlán (súper, llevar o recoger, pagos).
-- Las "tarifas por zona" se guardan como productos de la categoría "zonas" con
-- unidad "por mandado". Zonas, precios y número de WhatsApp son DE EJEMPLO.

INSERT INTO negocio (id, slug, nombre, eslogan, descripcion, tipo, color_primario, portada_url, whatsapp, telefono, direccion, horario, solo_mayores_edad, orden) VALUES (5, 'encarguitos', 'Encarguitos', 'Tus mandados en moto por Miahuatlán', 'Te hacemos el súper, llevamos o recogemos paquetes y pagamos tus recibos. Haz tu lista y te confirmamos por WhatsApp.', 'SERVICIO', '#d9480f', 'img/enc-moto.svg', '5219510000000', '951 000 0000', 'Miahuatlán de Porfirio Díaz, Oax.', 'Lun a Dom 8:00 – 21:00', false, 5);

INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (17, 5, 'zonas', 'Tarifas por zona', 'Costo del envío según a dónde va tu encargo', 1);

INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (34, 'Centro', 'Dentro del centro de Miahuatlán.', 30.00, 'por mandado', 'Incluye hasta 15 minutos de espera', 'img/enc-moto.svg', 17, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (35, 'Colonias', 'Colonias y barrios fuera del centro.', 40.00, 'por mandado', 'Incluye hasta 15 minutos de espera', 'img/enc-moto.svg', 17, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (36, 'Agencias y comunidades cercanas', 'Fuera de la cabecera municipal; confirma por WhatsApp si llegamos a tu comunidad.', 70.00, 'por mandado', 'Sujeto a confirmación', 'img/enc-moto.svg', 17, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (37, 'Carga grande o espera extra', 'Garrafones, cajas pesadas o cada 15 minutos adicionales de espera.', 15.00, 'extra', 'Se suma a la tarifa de la zona', 'img/enc-moto.svg', 17, false, true);
