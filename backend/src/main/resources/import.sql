-- Datos de ejemplo para la fase 1. Las imágenes son placeholders servidos
-- por el frontend (carpeta public/img); reemplázalas por fotos reales.

INSERT INTO categoria (id, slug, nombre, descripcion, orden) VALUES (1, 'ramos', 'Ramos', 'Ramos envueltos listos para regalar', 1);
INSERT INTO categoria (id, slug, nombre, descripcion, orden) VALUES (2, 'arreglos', 'Arreglos', 'Arreglos en base, caja o canasta', 2);
INSERT INTO categoria (id, slug, nombre, descripcion, orden) VALUES (3, 'flores', 'Flores por pieza', 'Flores sueltas por tallo o docena', 3);
INSERT INTO categoria (id, slug, nombre, descripcion, orden) VALUES (4, 'eventos', 'Eventos', 'Decoración floral para bodas, XV años y celebraciones', 4);
INSERT INTO categoria (id, slug, nombre, descripcion, orden) VALUES (5, 'complementos', 'Complementos', 'Globos, peluches y chocolates para acompañar', 5);

INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (1, 'Ramo de 12 rosas rojas', 'Docena de rosas rojas con follaje y envoltura kraft.', 450.00, 'img/ramo-rosas-rojas.svg', 1, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (2, 'Ramo de girasoles', 'Cinco girasoles con eucalipto y moño de yute.', 380.00, 'img/ramo-girasoles.svg', 1, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (3, 'Ramo mixto primavera', 'Rosas, margaritas y alstroemerias en tonos pastel.', 520.00, 'img/ramo-mixto.svg', 1, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (4, 'Ramo de tulipanes', 'Diez tulipanes en color a elegir, según temporada.', 690.00, 'img/ramo-tulipanes.svg', 1, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (5, 'Arreglo en caja de rosas', 'Caja redonda con 24 rosas a un solo tono.', 890.00, 'img/arreglo-caja.svg', 2, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (6, 'Canasta de temporada', 'Canasta de mimbre con flores de temporada.', 650.00, 'img/arreglo-canasta.svg', 2, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (7, 'Arreglo de orquídea', 'Orquídea phalaenopsis en maceta de cerámica.', 750.00, 'img/arreglo-orquidea.svg', 2, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (8, 'Rosa por pieza', 'Rosa de tallo largo; elige el color.', 35.00, 'img/flor-rosa.svg', 3, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (9, 'Docena de claveles', 'Doce claveles surtidos.', 150.00, 'img/flor-claveles.svg', 3, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (10, 'Gerberas (5 piezas)', 'Cinco gerberas de colores vivos.', 120.00, 'img/flor-gerberas.svg', 3, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (11, 'Centro de mesa para evento', 'Centro de mesa bajo; precio por pieza, cotiza volumen.', 420.00, 'img/evento-centro-mesa.svg', 4, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (12, 'Ramo de novia', 'Ramo de novia personalizado; agenda una cita.', 1200.00, 'img/evento-ramo-novia.svg', 4, true, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (13, 'Globo metálico', 'Globo metálico con mensaje para acompañar tu regalo.', 90.00, 'img/comp-globo.svg', 5, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (14, 'Peluche mediano', 'Oso de peluche de 30 cm.', 250.00, 'img/comp-peluche.svg', 5, false, true);
INSERT INTO producto (id, nombre, descripcion, precio, imagen_url, categoria_id, destacado, disponible) VALUES (15, 'Caja de chocolates', 'Caja con 12 chocolates surtidos.', 180.00, 'img/comp-chocolates.svg', 5, false, true);
