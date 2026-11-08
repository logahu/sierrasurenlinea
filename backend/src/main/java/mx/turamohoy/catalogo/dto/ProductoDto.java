package mx.turamohoy.catalogo.dto;

import mx.turamohoy.catalogo.model.Producto;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

/**
 * Vista pública de un producto. Se expone un DTO en lugar de la entidad para
 * no acoplar el contrato HTTP al modelo de persistencia.
 */
public record ProductoDto(
        Long id,
        String nombre,
        String descripcion,
        BigDecimal precio,
        String unidadPrecio,
        List<String> caracteristicas,
        String imagenUrl,
        /** Fotos adicionales, después de la principal. */
        List<String> galeria,
        String negocioSlug,
        String negocioNombre,
        String categoriaSlug,
        String categoriaNombre,
        boolean destacado) {

    public static ProductoDto de(Producto p) {
        return new ProductoDto(p.id, p.nombre, p.descripcion, p.precio, p.unidadPrecio,
                separar(p.caracteristicas), p.imagenUrl, separar(p.galeria),
                p.categoria.negocio.slug, p.categoria.negocio.nombre,
                p.categoria.slug, p.categoria.nombre, p.destacado);
    }

    public static List<String> separar(String texto) {
        if (texto == null || texto.isBlank()) {
            return List.of();
        }
        return Arrays.stream(texto.split("\\|"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
