-- Ubicación exacta de entrega elegida en el mapa (pin) y la ubicación habitual del cliente.
ALTER TABLE pedido ADD COLUMN lat DECIMAL(9, 6);
ALTER TABLE pedido ADD COLUMN lng DECIMAL(9, 6);
ALTER TABLE cliente ADD COLUMN lat DECIMAL(9, 6);
ALTER TABLE cliente ADD COLUMN lng DECIMAL(9, 6);
