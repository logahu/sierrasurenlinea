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
        /** Ubicación: si tiene local, colonia, referencias y pin (cuando es solo en línea, van vacíos en lo público). */
        boolean atencionEnLocal,
        String colonia,
        String referencias,
        java.math.BigDecimal lat,
        java.math.BigDecimal lng,
        boolean soloMayoresEdad,
        /** Si se muestra dentro de la app de Google Play. */
        boolean visibleApp,
        /** PUBLICO o PRUEBAS (los probadores ven también los negocios en pruebas). */
        String estado,
        Integer topeAdelanto,
        /** COMPRA, RENTA o CITA; null en servicios. */
        String modoPedido,
        List<CategoriaDto> categorias,
        /** Solo servicios: tarjetas visibles de la lista del mandado. */
        List<TipoEncargoDto> tiposEncargo) {

    public static NegocioDto resumen(Negocio n) {
        return de(n, List.of(), List.of());
    }

    public static NegocioDto de(Negocio n, List<CategoriaDto> categorias, List<TipoEncargoDto> tiposEncargo) {
        return new NegocioDto(n.id, n.slug, n.nombre, n.eslogan, n.descripcion, n.tipo,
                n.colorPrimario, n.portadaUrl, n.whatsapp, n.telefono, n.atencionEnLocal ? n.direccion : null, n.horario,
                n.atencionEnLocal, n.atencionEnLocal ? n.colonia : null, n.atencionEnLocal ? n.referencias : null,
                n.atencionEnLocal ? n.lat : null, n.atencionEnLocal ? n.lng : null,
                n.soloMayoresEdad, n.visibleApp, n.estado, n.topeAdelanto, n.modoPedido(), categorias, tiposEncargo);
    }
}
