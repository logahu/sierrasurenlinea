-- Datos iniciales de Sierra Sur en Línea (los 4 negocios, sus categorías y productos).
-- Las imágenes son placeholders servidos por el frontend (carpeta public/img).
--
-- Flyway ejecuta este archivo UNA sola vez por base de datos. Para cambiar datos
-- (WhatsApp reales, precios, productos nuevos) crea una migración nueva, p. ej.
-- V3__whatsapp_reales.sql con los UPDATE/INSERT; no edites este archivo.
--
-- Los números de WhatsApp/teléfono son de ejemplo; se cambiarán en una migración posterior.
-- WhatsApp va con lada internacional y sin espacios: 52 + 1 + 10 dígitos (p. ej. 5219511234567).

-- === Negocios ===================================================================
INSERT INTO negocio (id, slug, nombre, eslogan, descripcion, tipo, color_primario, portada_url, whatsapp, telefono, direccion, horario, solo_mayores_edad, orden) VALUES (1, 'turamohoy', 'TuRamoHoy', 'Flores frescas para cada momento', 'Ramos, arreglos y detalles hechos a mano para cumpleaños, aniversarios y eventos.', 'VENTA', '#d6336c', 'img/ramo-rosas-rojas.svg', '5219510000000', '951 000 0000', 'Miahuatlán de Porfirio Díaz, Oax.', 'Lun a Sáb 9:00 – 20:00', false, 1);
INSERT INTO negocio (id, slug, nombre, eslogan, descripcion, tipo, color_primario, portada_url, whatsapp, telefono, direccion, horario, solo_mayores_edad, orden) VALUES (2, 'cosmeticos', 'Cosméticos', 'Maquillaje y cuidado personal', 'Maquillaje, cuidado de la piel, perfumes y productos para el cabello.', 'VENTA', '#9c36b5', 'img/cos-perfume.svg', '5219510000000', '951 000 0000', 'Miahuatlán de Porfirio Díaz, Oax.', 'Lun a Sáb 10:00 – 19:00', false, 2);
INSERT INTO negocio (id, slug, nombre, eslogan, descripcion, tipo, color_primario, portada_url, whatsapp, telefono, direccion, horario, solo_mayores_edad, orden) VALUES (3, 'inflables', 'Renta de Inflables', 'Diversión para tu fiesta', 'Brincolines, toboganes y mobiliario para fiestas infantiles y eventos. Incluyen entrega e instalación en Miahuatlán.', 'RENTA', '#1c7ed6', 'img/inf-castillo.svg', '5219510000000', '951 000 0000', 'Miahuatlán de Porfirio Díaz, Oax.', 'Todos los días, con reservación', false, 3);
INSERT INTO negocio (id, slug, nombre, eslogan, descripcion, tipo, color_primario, portada_url, whatsapp, telefono, direccion, horario, solo_mayores_edad, orden) VALUES (4, 'vinateria', 'Vinatería', 'Mezcal de la región, vinos y cerveza', 'Mezcales artesanales de la Sierra Sur, vinos, licores, cerveza, botanas y hielo.', 'VENTA', '#8a3b12', 'img/vin-mezcal-espadin.svg', '5219510000000', '951 000 0000', 'Miahuatlán de Porfirio Díaz, Oax.', 'Lun a Dom 10:00 – 22:00', true, 4);

-- === Categorías =================================================================
-- TuRamoHoy
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (1, 1, 'ramos', 'Ramos', 'Ramos envueltos listos para regalar', 1);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (2, 1, 'arreglos', 'Arreglos', 'Arreglos en base, caja o canasta', 2);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (3, 1, 'flores', 'Flores por pieza', 'Flores sueltas por tallo o docena', 3);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (4, 1, 'eventos', 'Eventos', 'Decoración floral para bodas, XV años y celebraciones', 4);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (5, 1, 'complementos', 'Complementos', 'Globos, peluches y chocolates para acompañar', 5);
-- Cosméticos
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (6, 2, 'maquillaje', 'Maquillaje', 'Labiales, bases y sombras', 1);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (7, 2, 'cuidado-piel', 'Cuidado de la piel', 'Cremas, limpiadores y protector solar', 2);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (8, 2, 'perfumes', 'Perfumes', 'Fragancias para dama y caballero', 3);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (9, 2, 'cabello', 'Cabello', 'Shampoo, tratamientos y accesorios', 4);
-- Renta de inflables
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (10, 3, 'brincolines', 'Brincolines', 'Inflables para brincar', 1);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (11, 3, 'toboganes', 'Toboganes y combos', 'Con resbaladilla, acuáticos y combos', 2);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (12, 3, 'mobiliario', 'Mobiliario y extras', 'Sillas, mesas y complementos para tu evento', 3);
-- Vinatería
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (13, 4, 'mezcal', 'Mezcal', 'Mezcales artesanales de la región', 1);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (14, 4, 'cervezas', 'Cervezas', 'Por pieza, six y cartón', 2);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (15, 4, 'vinos', 'Vinos y licores', 'Vino tinto, blanco, tequila y más', 3);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden) VALUES (16, 4, 'botanas', 'Botanas y hielo', 'Para acompañar', 4);

-- === Productos ==================================================================
-- TuRamoHoy
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (1, 'Ramo de 12 rosas rojas', 'Docena de rosas rojas con follaje y envoltura kraft.', 450.00, NULL, NULL, 'img/ramo-rosas-rojas.svg', 1, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (2, 'Ramo de girasoles', 'Cinco girasoles con eucalipto y moño de yute.', 380.00, NULL, NULL, 'img/ramo-girasoles.svg', 1, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (3, 'Ramo mixto primavera', 'Rosas, margaritas y alstroemerias en tonos pastel.', 520.00, NULL, NULL, 'img/ramo-mixto.svg', 1, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (4, 'Ramo de tulipanes', 'Diez tulipanes en color a elegir, según temporada.', 690.00, NULL, NULL, 'img/ramo-tulipanes.svg', 1, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (5, 'Arreglo en caja de rosas', 'Caja redonda con 24 rosas a un solo tono.', 890.00, NULL, NULL, 'img/arreglo-caja.svg', 2, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (6, 'Canasta de temporada', 'Canasta de mimbre con flores de temporada.', 650.00, NULL, NULL, 'img/arreglo-canasta.svg', 2, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (7, 'Arreglo de orquídea', 'Orquídea phalaenopsis en maceta de cerámica.', 750.00, NULL, NULL, 'img/arreglo-orquidea.svg', 2, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (8, 'Rosa por pieza', 'Rosa de tallo largo; elige el color.', 35.00, NULL, NULL, 'img/flor-rosa.svg', 3, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (9, 'Docena de claveles', 'Doce claveles surtidos.', 150.00, NULL, NULL, 'img/flor-claveles.svg', 3, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (10, 'Gerberas (5 piezas)', 'Cinco gerberas de colores vivos.', 120.00, NULL, NULL, 'img/flor-gerberas.svg', 3, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (11, 'Centro de mesa para evento', 'Centro de mesa bajo; cotiza por volumen.', 420.00, 'por pieza', NULL, 'img/evento-centro-mesa.svg', 4, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (12, 'Ramo de novia', 'Ramo de novia personalizado; agenda una cita.', 1200.00, NULL, NULL, 'img/evento-ramo-novia.svg', 4, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (13, 'Globo metálico', 'Globo metálico con mensaje para acompañar tu regalo.', 90.00, NULL, NULL, 'img/comp-globo.svg', 5, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (14, 'Peluche mediano', 'Oso de peluche de 30 cm.', 250.00, NULL, NULL, 'img/comp-peluche.svg', 5, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (15, 'Caja de chocolates', 'Caja con 12 chocolates surtidos.', 180.00, NULL, NULL, 'img/comp-chocolates.svg', 5, false, true);

-- Cosméticos
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (16, 'Labial mate', 'Labial de larga duración, acabado mate. Varios tonos.', 149.00, NULL, 'Duración: hasta 8 horas|Tonos: rojo, nude, rosa y vino', 'img/cos-labial.svg', 6, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (17, 'Base de maquillaje líquida', 'Cobertura media, acabado natural.', 289.00, NULL, 'Contenido: 30 ml|Tonos: claro, medio y moreno', 'img/cos-base.svg', 6, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (18, 'Paleta de sombras', 'Doce tonos mate y brillantes.', 249.00, NULL, NULL, 'img/cos-paleta.svg', 6, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (19, 'Crema hidratante facial', 'Hidratación diaria para todo tipo de piel.', 199.00, NULL, 'Contenido: 50 ml', 'img/cos-crema.svg', 7, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (20, 'Protector solar FPS 50', 'Ligero, no deja sensación grasosa.', 259.00, NULL, 'Contenido: 60 ml', 'img/cos-protector.svg', 7, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (21, 'Perfume floral', 'Fragancia floral y fresca para dama.', 590.00, NULL, 'Contenido: 100 ml', 'img/cos-perfume.svg', 8, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (22, 'Shampoo sin sulfatos', 'Limpieza suave para cabello teñido o maltratado.', 179.00, NULL, 'Contenido: 400 ml', 'img/cos-shampoo.svg', 9, false, true);

-- Renta de inflables (precio por renta)
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (23, 'Brincolín castillo', 'El clásico castillo inflable para fiestas infantiles.', 650.00, 'por día', 'Medidas: 4 × 4 m|Capacidad: 8 niños (3 a 10 años)|Incluye entrega, instalación y lona', 'img/inf-castillo.svg', 10, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (24, 'Brincolín infantil', 'Ideal para los más pequeños y espacios reducidos.', 500.00, 'por día', 'Medidas: 3 × 3 m|Capacidad: 5 niños (2 a 6 años)|Incluye entrega e instalación', 'img/inf-combo.svg', 10, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (25, 'Brincolín con resbaladilla', 'Área para brincar y resbaladilla en un solo inflable.', 850.00, 'por día', 'Medidas: 5 × 4 m|Capacidad: 10 niños|Incluye entrega e instalación', 'img/inf-resbaladilla.svg', 11, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (26, 'Tobogán acuático', 'Para fiestas de verano; se conecta a una toma de agua.', 1200.00, 'por día', 'Medidas: 8 × 3 m|Requiere toma de agua cercana|Incluye entrega e instalación', 'img/inf-tobogan.svg', 11, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (27, 'Paquete 10 sillas + 1 mesa', 'Sillas plegables y mesa tablón con mantel.', 250.00, 'por evento', 'Incluye mantel|Entrega y recolección en Miahuatlán', 'img/inf-sillas.svg', 12, false, true);

-- Vinatería
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (28, 'Mezcal espadín 750 ml', 'Mezcal artesanal de agave espadín de la Sierra Sur.', 450.00, NULL, 'Agave: espadín|Contenido: 750 ml|Origen: Miahuatlán, Oax.', 'img/vin-mezcal-espadin.svg', 13, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (29, 'Mezcal tobalá 750 ml', 'Mezcal de agave silvestre tobalá, edición limitada.', 950.00, NULL, 'Agave: tobalá (silvestre)|Contenido: 750 ml|Origen: Sierra Sur, Oax.', 'img/vin-mezcal-tobala.svg', 13, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (30, 'Cerveza clara 12 pack', 'Doce latas de 355 ml.', 280.00, NULL, NULL, 'img/vin-cerveza.svg', 14, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (31, 'Vino tinto 750 ml', 'Vino tinto mexicano, ideal para cenas.', 320.00, NULL, NULL, 'img/vin-vino.svg', 15, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (32, 'Tequila reposado 750 ml', '100% agave, reposado.', 520.00, NULL, NULL, 'img/vin-tequila.svg', 15, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible) VALUES (33, 'Bolsa de hielo 5 kg', 'Hielo en cubos.', 45.00, NULL, NULL, 'img/vin-hielo.svg', 16, false, true);
