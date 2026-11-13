-- Comida a domicilio por persona y con opciones.
-- Opciones del platillo en JSON: [{"nombre":"Carne","multiple":false,"obligatorio":true,"maximo":null,
--   "opciones":[{"nombre":"Pastor","precio":0,"disponible":true}, ...]}, ...]
ALTER TABLE platillo ADD COLUMN opciones VARCHAR(8000);

-- Renglones de comida: de qué platillo, para quién, qué opciones y su nota.
ALTER TABLE pedido_linea ADD COLUMN platillo_id BIGINT REFERENCES platillo (id);
ALTER TABLE pedido_linea ADD COLUMN persona VARCHAR(60);
ALTER TABLE pedido_linea ADD COLUMN detalle VARCHAR(400);
ALTER TABLE pedido_linea ADD COLUMN nota VARCHAR(200);
