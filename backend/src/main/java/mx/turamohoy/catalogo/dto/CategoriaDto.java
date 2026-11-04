package mx.turamohoy.catalogo.dto;

import mx.turamohoy.catalogo.model.Categoria;

public record CategoriaDto(Long id, String negocioSlug, String slug, String nombre, String descripcion) {

    public static CategoriaDto de(Categoria c) {
        return new CategoriaDto(c.id, c.negocio.slug, c.slug, c.nombre, c.descripcion);
    }
}
