-- Negocios que no se muestran dentro de la app de Google Play (siguen en la web).
-- La vinatería queda fuera de la app para que la clasificación sea para todo público.
ALTER TABLE negocio ADD COLUMN visible_app BOOLEAN DEFAULT TRUE NOT NULL;
UPDATE negocio SET visible_app = FALSE WHERE solo_mayores_edad = TRUE;
