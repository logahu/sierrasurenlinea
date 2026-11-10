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
        boolean soloMayoresEdad,
        boolean visible,
        boolean visibleApp,
        Integer topeAdelanto,
        int orden,
        long productosActivos,
        String encargado) {

    public static NegocioAdminDto de(Negocio n, long productosActivos, String encargado) {
        return new NegocioAdminDto(n.id, n.slug, n.nombre, n.eslogan, n.descripcion, n.tipo,
                n.colorPrimario, n.portadaUrl, n.whatsapp, n.telefono, n.direccion, n.horario,
                n.soloMayoresEdad, n.visible, n.visibleApp, n.topeAdelanto, n.orden, productosActivos, encargado);
    }
}
