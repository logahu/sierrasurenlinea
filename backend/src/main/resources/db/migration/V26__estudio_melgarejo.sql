-- Nuevo negocio: Estudio Melgarejo (salón de belleza). Se pide por citas y nace en Pruebas:
-- solo lo ven los probadores hasta que se publique desde el panel.
-- Los paquetes de ejemplo se reemplazan desde el panel con los reales.
INSERT INTO negocio (id, slug, nombre, eslogan, descripcion, tipo, color_primario, portada_url, whatsapp, telefono,
                     direccion, horario, solo_mayores_edad, orden, modo_pedido, estado, atencion_en_local)
VALUES (7, 'estudio-melgarejo', 'Estudio Melgarejo', 'Belleza, estilo y cuidado personal',
        'Cortes, barba, uñas y peinados. Elige tu paquete y aparta tu cita en línea.',
        'VENTA', '#1a1a1a', 'img/estudio-melgarejo-logo.png', '5219510000000', NULL,
        NULL, 'Lun a sáb, 10:00 a 19:00', FALSE, 7, 'CITA', 'PRUEBAS', TRUE);

INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden)
VALUES (nextval('categoria_seq'), 7, 'cortes', 'Cortes', 'Corte de cabello para dama, caballero y niños', 1);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden)
VALUES (nextval('categoria_seq'), 7, 'barba', 'Barba', 'Arreglo y diseño de barba', 2);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden)
VALUES (nextval('categoria_seq'), 7, 'unas', 'Uñas', 'Manicure, pedicure y diseño', 3);
INSERT INTO categoria (id, negocio_id, slug, nombre, descripcion, orden)
VALUES (nextval('categoria_seq'), 7, 'peinados', 'Peinados', 'Peinados para eventos y ocasiones especiales', 4);

INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible)
VALUES (nextval('producto_seq'), 'Paquete 1 · Corte básico (ejemplo)', 'Corte de cabello con lavado.', 120.00, NULL,
        'Duración: 1 hora|Incluye: corte básico|Incluye: lavado', 'img/salon-corte.svg',
        (SELECT id FROM categoria WHERE negocio_id = 7 AND slug = 'cortes'), TRUE, TRUE);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible)
VALUES (nextval('producto_seq'), 'Paquete 2 · Barba (ejemplo)', 'Perfilado y arreglo de barba con toalla caliente.', 100.00, NULL,
        'Duración: 1 hora|Incluye: perfilado|Incluye: toalla caliente', 'img/salon-barba.svg',
        (SELECT id FROM categoria WHERE negocio_id = 7 AND slug = 'barba'), FALSE, TRUE);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible)
VALUES (nextval('producto_seq'), 'Paquete 3 · Manicure (ejemplo)', 'Manicure con esmaltado tradicional.', 150.00, NULL,
        'Duración: 1 hora|Incluye: limpieza|Incluye: esmaltado', 'img/salon-unas.svg',
        (SELECT id FROM categoria WHERE negocio_id = 7 AND slug = 'unas'), FALSE, TRUE);
INSERT INTO producto (id, nombre, descripcion, precio, unidad_precio, caracteristicas, imagen_url, categoria_id, destacado, disponible)
VALUES (nextval('producto_seq'), 'Paquete 4 · Peinado (ejemplo)', 'Peinado para evento.', 250.00, NULL,
        'Duración: 1 hora|Incluye: peinado|Incluye: fijador', 'img/salon-peinado.svg',
        (SELECT id FROM categoria WHERE negocio_id = 7 AND slug = 'peinados'), FALSE, TRUE);
