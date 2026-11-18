package mx.turamohoy.catalogo.dto;

import mx.turamohoy.catalogo.model.Giro;

/**
 * Un giro de la portada. {@code negocios} cuenta los negocios que puede ver quien pregunta
 * (en el resumen que va dentro de cada negocio, vale 0).
 */
public record GiroDto(String slug, String nombre, String icono, int orden, long negocios) {

    public static GiroDto de(Giro g, long negocios) {
        return new GiroDto(g.slug, g.nombre, g.icono, g.orden, negocios);
    }

    /** Lo que va dentro de cada negocio. */
    public record Resumen(String slug, String nombre, String icono) {

        public static Resumen de(Giro g) {
            return g == null ? null : new Resumen(g.slug, g.nombre, g.icono);
        }
    }
}
