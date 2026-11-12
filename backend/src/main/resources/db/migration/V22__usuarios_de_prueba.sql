-- Cuentas creadas con el botón «Crear usuarios de prueba» del panel.
-- Sirven para identificarlas y quitarles el acceso todas juntas.
ALTER TABLE usuario ADD COLUMN de_prueba BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE cliente ADD COLUMN de_prueba BOOLEAN DEFAULT FALSE NOT NULL;
