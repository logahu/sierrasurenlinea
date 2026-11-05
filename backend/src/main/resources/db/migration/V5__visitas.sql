-- Contador de visitas por página del sitio ("/", "/turamohoy", "/turamohoy/producto/5"...).
-- El sitio lo muestra de forma discreta como "folio" en el pie de página.
CREATE TABLE visita (
    ruta        VARCHAR(120) PRIMARY KEY,
    total       BIGINT       NOT NULL DEFAULT 0,
    actualizada TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
