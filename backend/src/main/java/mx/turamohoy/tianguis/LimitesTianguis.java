package mx.turamohoy.tianguis;

import jakarta.enterprise.context.ApplicationScoped;

import java.time.Duration;

/** Frenos contra abusos del tianguis (en memoria). Las pruebas pueden cambiarlos. */
@ApplicationScoped
public class LimitesTianguis {

    /** Anuncios nuevos por IP al día. */
    public LimiteVentana publicarPorIp = new LimiteVentana(5, Duration.ofDays(1));
    /** Fotos subidas sin cuenta por IP por hora (8 por anuncio y algún reintento). */
    public LimiteVentana fotosPorIp = new LimiteVentana(40, Duration.ofHours(1));
    /** Reportes por IP por hora. */
    public LimiteVentana reportesPorIp = new LimiteVentana(5, Duration.ofHours(1));
    /** Un reporte por IP para cada anuncio por día. */
    public LimiteVentana reportePorAnuncio = new LimiteVentana(1, Duration.ofDays(1));

    /** Anuncios nuevos por WhatsApp al día y activos a la vez por vendedor. */
    public int porWhatsappAlDia = 3;
    public int activosPorVendedor = 10;

    public void reiniciar() {
        publicarPorIp.olvidar();
        fotosPorIp.olvidar();
        reportesPorIp.olvidar();
        reportePorAnuncio.olvidar();
    }
}
