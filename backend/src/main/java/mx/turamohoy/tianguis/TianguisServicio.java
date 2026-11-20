package mx.turamohoy.tianguis;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.fotos.ImagenesPermitidas;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Reglas para armar un anuncio (venga del panel o del público) y la tarea de vencimientos. */
@ApplicationScoped
public class TianguisServicio {

    private static final Logger LOG = Logger.getLogger(TianguisServicio.class);

    @Inject
    ImagenesPermitidas imagenes;

    /** Datos comunes de un anuncio, ya validados por Bean Validation. */
    public record Datos(String categoria, String titulo, String descripcion, BigDecimal precio, String tipoPrecio,
                        boolean negociable, String condicion, Map<String, String> atributos, String ubicacion, List<String> fotos) {
    }

    /**
     * Llena el anuncio con datos válidos: categoría activa y atributos según la categoría.
     * Artículo: condición, precio fijo y 1 a 8 fotos. Servicio: sin condición, precio fijo/desde/a cotizar, 0 a 8 fotos.
     */
    public void llenar(AnuncioTianguis a, Datos d) {
        CategoriaTianguis c = CategoriaTianguis.activaPorSlug(d.categoria())
                .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "Esa categoría no existe."));
        AnuncioTianguis.TipoPrecio tipoPrecio = tipoPrecio(d.tipoPrecio());
        AnuncioTianguis.Condicion condicion = null;
        if (c.esServicio()) {
            // La condición no aplica a un servicio: se ignora si llega.
        } else {
            if (tipoPrecio != AnuncioTianguis.TipoPrecio.FIJO) {
                throw Errores.de(Status.BAD_REQUEST, "Un artículo lleva precio fijo.");
            }
            if (d.condicion() == null || d.condicion().isBlank()) {
                throw Errores.de(Status.BAD_REQUEST, "Elige la condición.");
            }
            try {
                condicion = AnuncioTianguis.Condicion.valueOf(d.condicion().trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw Errores.de(Status.BAD_REQUEST, "Condición no válida.");
            }
        }
        BigDecimal precio = null;
        if (tipoPrecio != AnuncioTianguis.TipoPrecio.COTIZAR) {
            if (d.precio() == null) {
                throw Errores.de(Status.BAD_REQUEST, "Escribe el precio.");
            }
            precio = d.precio().setScale(2, RoundingMode.HALF_UP);
        }
        a.categoria = c;
        a.titulo = d.titulo().trim();
        a.descripcion = d.descripcion().trim();
        a.tipoPrecio = tipoPrecio;
        a.precio = precio;
        a.negociable = tipoPrecio != AnuncioTianguis.TipoPrecio.COTIZAR && d.negociable();
        a.condicion = condicion;
        a.ponerAtributos(CampoAtributo.validar(c.campos(), d.atributos()));
        a.ubicacion = d.ubicacion().trim();
        a.ponerFotos(fotos(d.fotos(), !c.esServicio()));
        a.actualizado = Tianguis.ahora();
        a.actualizarBusqueda();
    }

    static AnuncioTianguis.TipoPrecio tipoPrecio(String texto) {
        if (texto == null || texto.isBlank()) {
            return AnuncioTianguis.TipoPrecio.FIJO;
        }
        try {
            return AnuncioTianguis.TipoPrecio.valueOf(texto.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw Errores.de(Status.BAD_REQUEST, "Tipo de precio no válido.");
        }
    }

    /** Hasta 8 fotos subidas para el tianguis (o de ejemplo del sitio), sin repetir; los artículos llevan al menos una. */
    List<String> fotos(List<String> urls, boolean obligatoria) {
        Negocio t = Tianguis.negocio();
        List<String> r = new ArrayList<>();
        for (String u : urls == null ? List.<String>of() : urls) {
            String v = imagenes.validar(t, u);
            if (v != null && !r.contains(v)) {
                r.add(v);
            }
        }
        if (r.isEmpty() && obligatoria) {
            throw Errores.de(Status.BAD_REQUEST, "Agrega al menos una foto del artículo.");
        }
        if (r.size() > Tianguis.MAX_FOTOS) {
            throw Errores.de(Status.BAD_REQUEST, "Máximo " + Tianguis.MAX_FOTOS + " fotos por anuncio.");
        }
        return r;
    }

    /** Una vez al día: los publicados con fecha de vencimiento pasada quedan VENCIDO. */
    @Scheduled(cron = "0 15 3 * * ?", timeZone = "America/Mexico_City", identity = "tianguis-vencimientos")
    void vencerCadaDia() {
        int n = vencer();
        if (n > 0) {
            LOG.infof("Tianguis: %d anuncio(s) vencido(s)", n);
        }
    }

    @Transactional
    public int vencer() {
        LocalDateTime ahora = Tianguis.ahora();
        return AnuncioTianguis.update("estado = ?1 where estado = ?2 and fechaVencimiento <= ?3",
                AnuncioTianguis.Estado.VENCIDO, AnuncioTianguis.Estado.PUBLICADO, ahora);
    }
}
