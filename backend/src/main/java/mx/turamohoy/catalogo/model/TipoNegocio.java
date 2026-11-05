package mx.turamohoy.catalogo.model;

/** Cómo comercializa sus productos un negocio. */
public enum TipoNegocio {
    /** Los productos se venden (florería, cosméticos, vinatería). */
    VENTA,
    /** Los productos se rentan por día o por evento (inflables, mobiliario). */
    RENTA,
    /**
     * Se solicita un servicio en lugar de elegir productos (Encarguitos: mandados en
     * moto). Sus "productos" son las tarifas; el sitio muestra un formulario.
     */
    SERVICIO
}
