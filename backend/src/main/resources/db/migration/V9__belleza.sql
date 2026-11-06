-- "Cosméticos" pasa a llamarse "Belleza" y su página se mueve de /cosmeticos a /belleza.
-- El sitio redirige /cosmeticos a /belleza para no romper enlaces ya compartidos.
UPDATE negocio
SET slug = 'belleza', nombre = 'Belleza', eslogan = 'Maquillaje, cuidado de la piel y más'
WHERE slug = 'cosmeticos';

-- Las visitas acumuladas se conservan con la ruta nueva.
UPDATE visita SET ruta = '/belleza' || SUBSTRING(ruta FROM 12)
WHERE ruta = '/cosmeticos' OR ruta LIKE '/cosmeticos/%';
