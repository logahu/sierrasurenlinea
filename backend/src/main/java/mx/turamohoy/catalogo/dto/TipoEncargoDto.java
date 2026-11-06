package mx.turamohoy.catalogo.dto;

import mx.turamohoy.catalogo.model.TipoEncargo;

/** Tarjeta de la lista del mandado, tal como la usa el sitio (y el panel, con visible). */
public record TipoEncargoDto(
        Long id,
        String titulo,
        String ayuda,
        String ejemplo,
        String etiquetaRecoger,
        boolean recogerObligatorio,
        boolean manejaDinero,
        String modo,
        String icono,
        boolean soloProgramado,
        int orden,
        boolean visible) {

    public static TipoEncargoDto de(TipoEncargo t) {
        return new TipoEncargoDto(t.id, t.titulo, t.ayuda, t.ejemplo, t.etiquetaRecoger,
                t.recogerObligatorio, t.manejaDinero, t.modo, t.icono, t.soloProgramado, t.orden, t.visible);
    }
}
