-- Avatar o foto de perfil de cada usuario del panel y de cada cliente.
-- «avatar:flor» = uno de los dibujos del sitio; una URL = foto subida a R2 (perfiles/...); vacío = iniciales.
ALTER TABLE usuario ADD COLUMN avatar VARCHAR(500);
ALTER TABLE cliente ADD COLUMN avatar VARCHAR(500);
