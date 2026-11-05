-- Esquema inicial de Sierra Sur en Línea: negocios, sus categorías y sus productos.
-- Compatible con PostgreSQL (producción) y H2 en modo PostgreSQL (desarrollo y pruebas).

CREATE TABLE negocio (
    id                 BIGINT       PRIMARY KEY,
    slug               VARCHAR(60)  NOT NULL UNIQUE,
    nombre             VARCHAR(80)  NOT NULL,
    eslogan            VARCHAR(140),
    descripcion        VARCHAR(600),
    tipo               VARCHAR(10)  NOT NULL CHECK (tipo IN ('VENTA', 'RENTA')),
    color_primario     VARCHAR(7)   NOT NULL,
    portada_url        VARCHAR(500) NOT NULL,
    whatsapp           VARCHAR(20)  NOT NULL,
    telefono           VARCHAR(30),
    direccion          VARCHAR(200),
    horario            VARCHAR(120),
    solo_mayores_edad  BOOLEAN      NOT NULL DEFAULT FALSE,
    orden              INTEGER      NOT NULL
);

CREATE TABLE categoria (
    id          BIGINT       PRIMARY KEY,
    negocio_id  BIGINT       NOT NULL REFERENCES negocio (id),
    slug        VARCHAR(60)  NOT NULL,
    nombre      VARCHAR(80)  NOT NULL,
    descripcion VARCHAR(255),
    orden       INTEGER      NOT NULL,
    CONSTRAINT uk_categoria_negocio_slug UNIQUE (negocio_id, slug)
);

CREATE TABLE producto (
    id              BIGINT        PRIMARY KEY,
    nombre          VARCHAR(120)  NOT NULL,
    descripcion     VARCHAR(1000),
    precio          NUMERIC(10, 2) NOT NULL,
    unidad_precio   VARCHAR(30),
    caracteristicas VARCHAR(500),
    imagen_url      VARCHAR(500)  NOT NULL,
    categoria_id    BIGINT        NOT NULL REFERENCES categoria (id),
    destacado       BOOLEAN       NOT NULL DEFAULT FALSE,
    disponible      BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE INDEX ix_categoria_negocio ON categoria (negocio_id);
CREATE INDEX ix_producto_categoria ON producto (categoria_id);
