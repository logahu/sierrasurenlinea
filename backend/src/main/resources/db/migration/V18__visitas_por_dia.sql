-- Visitas por página y por día (hora de México), para el tablero del panel.
-- La tabla "visita" sigue guardando el total histórico de cada página.
CREATE TABLE visita_dia (
    ruta  VARCHAR(120) NOT NULL,
    dia   DATE         NOT NULL,
    total BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT pk_visita_dia PRIMARY KEY (ruta, dia)
);
CREATE INDEX ix_visita_dia_dia ON visita_dia (dia);
