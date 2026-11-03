package mx.turamohoy.catalogo.dto;

import mx.turamohoy.catalogo.model.Producto;

import java.math.BigDecimal;

/**
 * Vista pública de un producto. Se expone un DTO en lugar de la entidad para
 * no acoplar el contrato HTTP al modelo de persistencia (útil cuando lleguen
 * inventario, costos, etc. en fases siguientes).
 */
public record ProductoDto(
        Long id,
        String nombre,
        String descripcion,
        BigDecimal precio,
        String imagenUrl,
        String categoriaSlug,
        String categoriaNombre,
        boolean destacado) {

    public static ProductoDto de(Producto p) {
        return new ProductoDto(p.id, p.nombre, p.descripcion, p.precio, p.imagenUrl,
                p.categoria.slug, p.categoria.nombre, p.destacado);
    }
}
