-- La portada de Estudio Melgarejo pasa del logo completo al monograma «EM» en formato 4:5.
-- El logo completo se recortaba en la ventana en arco de la página de inicio («ESTUDIO» y
-- «MELGAREJO» quedaban cortados), y el nombre ya aparece en el rótulo encima de la ventana.
-- Solo se cambia si sigue la portada original, para no pisar una que se haya subido desde el panel.
UPDATE negocio
SET portada_url = 'img/estudio-melgarejo-portada.png'
WHERE slug = 'estudio-melgarejo'
  AND portada_url = 'img/estudio-melgarejo-logo.png';
