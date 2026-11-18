-- Portada «Directorio» (reemplaza a las calles por giro).

-- Fecha de alta de cada negocio: etiqueta «Nuevo» (30 días) y orden «Nuevos».
-- Los que ya existen quedan con la fecha de esta migración.
ALTER TABLE negocio ADD COLUMN creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE negocio SET creado_en = CURRENT_TIMESTAMP WHERE creado_en IS NULL;
ALTER TABLE negocio ALTER COLUMN creado_en SET NOT NULL;

-- Ya no hay «entre calles». En su lugar, DIRECTORIO: patrocina un negocio, cuya tarjeta sube al
-- principio del directorio con la etiqueta «Patrocinado». Los banners que hubiera entre calles
-- pasan arriba de la portada para que se sigan viendo.
UPDATE anuncio SET posicion = 'PORTADA_ARRIBA' WHERE posicion = 'ENTRE_CALLES';
ALTER TABLE anuncio DROP CONSTRAINT ck_anuncio_posicion;
ALTER TABLE anuncio ADD CONSTRAINT ck_anuncio_posicion CHECK (posicion IN ('PORTADA_ARRIBA', 'DIRECTORIO'));
