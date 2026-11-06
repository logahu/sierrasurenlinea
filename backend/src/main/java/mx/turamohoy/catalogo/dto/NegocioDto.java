package mx.turamohoy.catalogo.dto;

import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.TipoNegocio;

import java.util.List;

/**
 * Vista pública de un negocio con sus datos de contacto. En el listado
 * {@code categorias} va vacío; en el detalle trae las categorías del negocio.
 */
public record NegocioDto(
        Long id,
        String slug,
        String nombre,
        String eslogan,
        String descripcion,
        TipoNegocio tipo,
        String colorPrimario,
        String portadaUrl,
        String whatsapp,
        String telefono,
        String direccion,
        String horario,
        boolean soloMayoresEdad,
        Integer topeAdelanto,
        List<CategoriaDto> categorias,
        /** Solo servicios: tarjetas visibles de la lista del mandado. */
        List<TipoEncargoDto> tiposEncargo) {

    public static NegocioDto resumen(Negocio n) {
        return de(n, List.of(), List.of());
    }

    public static NegocioDto de(Negocio n, List<CategoriaDto> categorias, List<TipoEncargoDto> tiposEncargo) {
        return new NegocioDto(n.id, n.slug, n.nombre, n.eslogan, n.descripcion, n.tipo,
                n.colorPrimario, n.portadaUrl, n.whatsapp, n.telefono, n.direccion, n.horario,
                n.soloMayoresEdad, n.topeAdelanto, categorias, tiposEncargo);
    }
}
