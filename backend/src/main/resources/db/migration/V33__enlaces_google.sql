-- Enlaces al Perfil de Negocio de Google (opcionales, por negocio):
--   google_maps_url    «Ver en Google Maps» (perfil con fotos, reseñas y horario).
--   google_resenas_url «Déjanos tu reseña» (abre la ventana para calificar).
ALTER TABLE negocio ADD COLUMN google_maps_url VARCHAR(300);
ALTER TABLE negocio ADD COLUMN google_resenas_url VARCHAR(300);

-- Estudio Melgarejo ya está en Google Maps: enlaces y pin del local.
UPDATE negocio
SET google_maps_url    = 'https://maps.app.goo.gl/bpEujxaGgXyRK41H8',
    google_resenas_url = 'https://g.page/r/CYv59KJmIXj6EBM/review',
    atencion_en_local  = TRUE,
    lat                = 16.323368,
    lng                = -96.588286
WHERE slug = 'estudio-melgarejo';
