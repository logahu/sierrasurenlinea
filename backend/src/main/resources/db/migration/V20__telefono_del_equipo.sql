-- El equipo (administradores, encargados y repartidores) también entra con su teléfono,
-- igual que los clientes. El correo queda opcional.
ALTER TABLE usuario ADD COLUMN telefono VARCHAR(10);
ALTER TABLE usuario ADD CONSTRAINT uq_usuario_telefono UNIQUE (telefono);
ALTER TABLE usuario ALTER COLUMN correo DROP NOT NULL;
