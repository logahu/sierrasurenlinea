package mx.turamohoy.admin;

import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.TipoNegocio;

/** Un negocio como lo ve el panel: con lo público y además si está visible y cuántos productos tiene. */
public record NegocioAdminDto(
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
        String googleMapsUrl,
        String googleResenasUrl,
        boolean soloMayoresEdad,
        /** true solo si es público (se conserva para compatibilidad). */
        boolean visible,
        /** PUBLICO, PRUEBAS u OCULTO. */
        String estado,
        boolean visibleApp,
        Integer topeAdelanto,
        int orden,
        long productosActivos,
        String encargado,
        /** COMPRA, RENTA, CITA o null (Encarguitos). */
        String modoPedido,
        /** Citas con horarios libres. */
        boolean agendaActiva,
        /** Slug de su giro (su calle en la portada). */
        String giro) {

    public static NegocioAdminDto de(Negocio n, long productosActivos, String encargado) {
        return new NegocioAdminDto(n.id, n.slug, n.nombre, n.eslogan, n.descripcion, n.tipo,
                n.colorPrimario, n.portadaUrl, n.whatsapp, n.telefono, n.direccion, n.horario,
                n.atencionEnLocal, n.colonia, n.referencias, n.lat, n.lng,
                n.googleMapsUrl, n.googleResenasUrl, n.soloMayoresEdad, n.publico(), n.estado, n.visibleApp, n.topeAdelanto, n.orden, productosActivos, encargado,
                n.modoPedido(), n.agendaActiva, n.giro == null ? null : n.giro.slug);
    }
}
