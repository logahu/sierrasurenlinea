package mx.turamohoy.publicidad;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.Visita;
import mx.turamohoy.fotos.Foto;
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.historial.Cambios;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Pantalla «Publicidad» del panel: solo el dueño del sitio. */
@Path("/api/admin/anuncios")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed(Rol.DUENO)
public class AdminAnuncioResource {

    @Inject
    SesionActual sesion;

    public record AnuncioAdminDto(Long id, String titulo, String texto, String imagenUrl, String enlace,
                                  String negocioSlug, String negocioNombre, String colorFondo, String posicion,
                                  LocalDate inicio, LocalDate fin, boolean activo, int orden,
                                  /** Activo y dentro de sus fechas hoy. */
                                  boolean vigente,
                                  /** Veces que lo tocaron (contador de visitas, ruta /anuncio/{id}). */
                                  long clics) {

        static AnuncioAdminDto de(Anuncio a) {
            Visita v = Visita.findById("/anuncio/" + a.id);
            return new AnuncioAdminDto(a.id, a.titulo, a.texto, a.imagenUrl, a.enlace,
                    a.negocio == null ? null : a.negocio.slug, a.negocio == null ? null : a.negocio.nombre,
                    a.colorFondo, a.posicion, a.inicio, a.fin, a.activo, a.orden, a.vigente(Anuncio.hoy()),
                    v == null ? 0 : v.total);
        }
    }

    public record Edicion(
            @NotBlank(message = "El título es obligatorio.") @Size(max = 80, message = "El título es muy largo (máximo 80).") String titulo,
            @Size(max = 200, message = "El texto es muy largo (máximo 200).") String texto,
            @Size(max = 500) String imagenUrl,
            @Size(max = 300, message = "El enlace es muy largo.") String enlace,
            String negocioSlug,
            @Pattern(regexp = "#[0-9a-fA-F]{6}", message = "El color va en formato #rrggbb.") String colorFondo,
            @NotBlank(message = "Elige dónde se muestra.") String posicion,
            LocalDate inicio,
            LocalDate fin,
            Boolean activo,
            Integer orden) {
    }

    public record Activo(boolean activo) {
    }

    @GET
    public List<AnuncioAdminDto> listar() {
        return Anuncio.<Anuncio>list("order by posicion desc, orden, id").stream().map(AnuncioAdminDto::de).toList();
    }

    @POST
    @Transactional
    public Response crear(@Valid @NotNull Edicion e) {
        Anuncio a = new Anuncio();
        a.creado = Instant.now();
        aplicar(a, e);
        a.persist();
        Bitacora.anotar(sesion.usuario(), a.negocio, Bitacora.ANUNCIO, a.id, "Creó el anuncio «" + a.titulo + "»", null);
        return Response.status(Status.CREATED).entity(AnuncioAdminDto.de(a)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public AnuncioAdminDto guardar(@PathParam("id") Long id, @Valid @NotNull Edicion e) {
        Anuncio a = buscar(id);
        String titulo = a.titulo, texto = a.texto, imagen = a.imagenUrl, enlace = a.enlace, color = a.colorFondo,
                posicion = a.posicion, negocio = a.negocio == null ? null : a.negocio.nombre;
        LocalDate inicio = a.inicio, fin = a.fin;
        boolean activo = a.activo;
        int orden = a.orden;
        aplicar(a, e);
        Cambios c = new Cambios().campo("Título", titulo, a.titulo).largo("Texto", texto, a.texto)
                .largo("Imagen", imagen, a.imagenUrl).campo("Enlace", enlace, a.enlace)
                .campo("Negocio", negocio, a.negocio == null ? null : a.negocio.nombre).campo("Color", color, a.colorFondo)
                .campo("Posición", posicion, a.posicion).campo("Desde", inicio, a.inicio).campo("Hasta", fin, a.fin)
                .campo("Activo", activo ? "Sí" : "No", a.activo ? "Sí" : "No").campo("Orden", orden, a.orden);
        if (c.hay()) {
            Bitacora.anotar(sesion.usuario(), a.negocio, Bitacora.ANUNCIO, a.id, "Editó el anuncio «" + a.titulo + "»",
                    c.toString());
        }
        return AnuncioAdminDto.de(a);
    }

    /** Activar o pausar sin tocar lo demás. */
    @PUT
    @Path("/{id}/activo")
    @Transactional
    public AnuncioAdminDto cambiarActivo(@PathParam("id") Long id, @NotNull Activo cambio) {
        Anuncio a = buscar(id);
        if (a.activo != cambio.activo()) {
            a.activo = cambio.activo();
            Bitacora.anotar(sesion.usuario(), a.negocio, Bitacora.ANUNCIO, a.id,
                    (a.activo ? "Activó" : "Pausó") + " el anuncio «" + a.titulo + "»", null);
        }
        return AnuncioAdminDto.de(a);
    }

    private static Anuncio buscar(Long id) {
        Anuncio a = Anuncio.findById(id);
        if (a == null) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese anuncio.");
        }
        return a;
    }

    private static void aplicar(Anuncio a, Edicion e) {
        String posicion = e.posicion().trim().toUpperCase();
        if (!Anuncio.POSICIONES.contains(posicion)) {
            throw Errores.de(Status.BAD_REQUEST, "La posición no es válida.");
        }
        if (e.inicio() != null && e.fin() != null && e.fin().isBefore(e.inicio())) {
            throw Errores.de(Status.BAD_REQUEST, "La fecha final debe ser igual o posterior a la inicial.");
        }
        a.titulo = e.titulo().trim();
        a.texto = limpio(e.texto());
        a.imagenUrl = imagen(limpio(e.imagenUrl()));
        a.enlace = enlace(limpio(e.enlace()));
        String slug = limpio(e.negocioSlug());
        a.negocio = slug == null ? null : Negocio.porSlug(slug)
                .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "No existe el negocio " + slug + "."));
        a.colorFondo = e.colorFondo() == null || e.colorFondo().isBlank() ? null : e.colorFondo().toLowerCase();
        a.posicion = posicion;
        a.inicio = e.inicio();
        a.fin = e.fin();
        if (e.activo() != null) {
            a.activo = e.activo();
        }
        if (e.orden() != null) {
            a.orden = e.orden();
        }
    }

    /** Una ruta del sitio (/turamohoy) o una dirección https://. */
    static String enlace(String enlace) {
        if (enlace == null) {
            return null;
        }
        boolean interna = enlace.matches("/(?!/)[A-Za-z0-9/_?=&.%-]*");
        boolean externa = enlace.matches("https://[^\\s]+");
        if (!interna && !externa) {
            throw Errores.de(Status.BAD_REQUEST, "El enlace debe ser una ruta del sitio (/turamohoy) o empezar con https://.");
        }
        return enlace;
    }

    /** Una foto subida (que no se haya borrado) o una de ejemplo. */
    static String imagen(String url) {
        if (url == null) {
            return null;
        }
        boolean deEjemplo = url.matches("img/[a-z0-9-]+\\.(svg|jpg|jpeg|png|webp)");
        if (!deEjemplo && Foto.count("url = ?1 and borrada is null", url) == 0) {
            throw Errores.de(Status.BAD_REQUEST, "Esa imagen no es una foto subida al sitio.");
        }
        return url;
    }

    private static String limpio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
