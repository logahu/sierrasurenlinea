package mx.turamohoy.tianguis;

import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Parameters;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.tianguis.AnuncioTianguis.Estado;
import mx.turamohoy.tianguis.TianguisDtos.AnuncioAdmin;
import mx.turamohoy.tianguis.TianguisDtos.AnuncioEdicion;
import mx.turamohoy.tianguis.TianguisDtos.CambioEstado;
import mx.turamohoy.tianguis.TianguisDtos.CategoriaDto;
import mx.turamohoy.tianguis.TianguisDtos.CategoriaEdicion;
import mx.turamohoy.tianguis.TianguisDtos.Pagina;
import mx.turamohoy.tianguis.TianguisDtos.ReporteAdmin;
import mx.turamohoy.tianguis.TianguisDtos.Resumen;
import mx.turamohoy.tianguis.TianguisDtos.VendedorAdmin;
import mx.turamohoy.tianguis.TianguisDtos.VendedorEdicion;

import java.util.List;
import java.util.Locale;

/**
 * Panel del tianguis: anuncios, moderación, categorías, vendedores y reportes. Lo usan el dueño
 * del sitio y el encargado del negocio «tianguis».
 */
@Path("/api/admin/tianguis")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class AdminTianguisResource {

    static final String BITACORA = "TIANGUIS";

    @Inject
    SesionActual sesion;

    @Inject
    TianguisServicio servicio;

    /** Comprueba el permiso (dueño o encargado del tianguis) y devuelve el negocio. */
    private Negocio tianguis() {
        return sesion.negocioEditable(Tianguis.SLUG);
    }

    private void anotar(Negocio t, Long id, String accion, String detalle) {
        Bitacora.anotar(sesion.usuario(), t, BITACORA, id, accion, detalle);
    }

    @GET
    @Path("/resumen")
    @Transactional
    public Resumen resumen() {
        tianguis();
        return new Resumen(AnuncioTianguis.count("estado", Estado.PENDIENTE), ReporteTianguis.count("atendido", false));
    }

    // ---------------------------------------------------------------- Anuncios

    @GET
    @Path("/anuncios")
    @Transactional
    public Pagina<AnuncioAdmin> anuncios(@QueryParam("estado") String estado, @QueryParam("categoria") String categoria,
                                         @QueryParam("q") String q, @QueryParam("vendedor") Long vendedor,
                                         @QueryParam("page") @DefaultValue("0") int pagina,
                                         @QueryParam("size") @DefaultValue("30") int tamano) {
        tianguis();
        StringBuilder w = new StringBuilder("from AnuncioTianguis a where 1 = 1");
        Parameters p = new Parameters();
        if (estado != null && !estado.isBlank()) {
            w.append(" and a.estado = :estado");
            p.and("estado", estado(estado));
        }
        if (categoria != null && !categoria.isBlank()) {
            w.append(" and a.categoria.slug = :categoria");
            p.and("categoria", categoria);
        }
        if (vendedor != null) {
            w.append(" and a.vendedor.id = :vendedor");
            p.and("vendedor", vendedor);
        }
        String[] palabras = Tianguis.normalizar(q).split(" ");
        for (int i = 0; i < palabras.length && i < 8; i++) {
            if (!palabras[i].isBlank()) {
                w.append(" and (a.busqueda like :q").append(i).append(" or a.vendedor.whatsapp like :q").append(i)
                        .append(" or lower(a.vendedor.nombre) like :q").append(i).append(")");
                p.and("q" + i, "%" + palabras[i] + "%");
            }
        }
        int t = Math.max(1, Math.min(tamano, 100));
        int pag = Math.max(0, pagina);
        // Pendientes: los más viejos primero (para atenderlos en orden). Lo demás: lo más reciente.
        String orden = estado != null && estado.equalsIgnoreCase("PENDIENTE") ? "a.actualizado asc" : "a.actualizado desc";
        var consulta = p.map().isEmpty()
                ? AnuncioTianguis.<AnuncioTianguis>find(w + " order by " + orden + ", a.id desc")
                : AnuncioTianguis.<AnuncioTianguis>find(w + " order by " + orden + ", a.id desc", p);
        long total = consulta.count();
        List<AnuncioAdmin> lista = consulta.page(Page.of(pag, t)).list().stream().map(AnuncioAdmin::de).toList();
        return new Pagina<>(lista, total, pag, t, (int) Math.ceil(total / (double) t));
    }

    private static Estado estado(String e) {
        try {
            return Estado.valueOf(e.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw Errores.de(Status.BAD_REQUEST, "Estado no válido.");
        }
    }

    private static AnuncioTianguis anuncio(Long id) {
        return AnuncioTianguis.<AnuncioTianguis>findByIdOptional(id)
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "No existe ese anuncio."));
    }

    @GET
    @Path("/anuncios/{id}")
    @Transactional
    public AnuncioAdmin anuncioPorId(@PathParam("id") Long id) {
        tianguis();
        return AnuncioAdmin.de(anuncio(id));
    }

    /** Alta desde el panel; con {@code publicar} queda publicado por 30 días de una vez. */
    @POST
    @Path("/anuncios")
    @Transactional
    public Response crear(@Valid @NotNull AnuncioEdicion e) {
        Negocio t = tianguis();
        AnuncioTianguis a = new AnuncioTianguis();
        llenar(a, e);
        a.estado = Estado.PENDIENTE;
        if (e.publicar()) {
            a.cambiarEstado(Estado.PUBLICADO, null, Tianguis.ahora());
        }
        a.persist();
        anotar(t, a.id, "Creó el anuncio «" + a.titulo + "»", a.estado.name());
        return Response.status(Status.CREATED).entity(AnuncioAdmin.de(a)).build();
    }

    /** Edición desde el panel: no cambia el estado (para eso está /estado). */
    @PUT
    @Path("/anuncios/{id}")
    @Transactional
    public AnuncioAdmin editar(@PathParam("id") Long id, @Valid @NotNull AnuncioEdicion e) {
        Negocio t = tianguis();
        AnuncioTianguis a = anuncio(id);
        llenar(a, e);
        anotar(t, a.id, "Editó el anuncio «" + a.titulo + "»", null);
        return AnuncioAdmin.de(a);
    }

    private void llenar(AnuncioTianguis a, AnuncioEdicion e) {
        servicio.llenar(a, new TianguisServicio.Datos(e.categoria(), e.titulo(), e.descripcion(), e.precio(),
                e.negociable(), e.condicion(), e.atributos(), e.ubicacion(), e.fotos()));
        try {
            a.modalidad = e.modalidad() == null || e.modalidad().isBlank() ? AnuncioTianguis.Modalidad.CLASIFICADO
                    : AnuncioTianguis.Modalidad.valueOf(e.modalidad().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw Errores.de(Status.BAD_REQUEST, "Modalidad no válida.");
        }
        a.destacado = e.destacado();
        if (e.vendedorId() != null) {
            a.vendedor = VendedorTianguis.<VendedorTianguis>findByIdOptional(e.vendedorId())
                    .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "No existe ese vendedor."));
        } else if (e.vendedorWhatsapp() != null && !e.vendedorWhatsapp().isBlank()) {
            String w = Tianguis.whatsapp(e.vendedorWhatsapp());
            if (VendedorTianguis.porWhatsapp(w).isEmpty() && (e.vendedorNombre() == null || e.vendedorNombre().isBlank())) {
                throw Errores.de(Status.BAD_REQUEST, "Escribe el nombre del vendedor nuevo.");
            }
            a.vendedor = VendedorTianguis.obtener(e.vendedorNombre(), w);
        } else if (a.vendedor == null) {
            throw Errores.de(Status.BAD_REQUEST, "Elige el vendedor o da de alta uno nuevo.");
        }
    }

    /** Publicar, pausar, marcar vendido, rechazar (con motivo)… con las transiciones válidas. */
    @PATCH
    @Path("/anuncios/{id}/estado")
    @Transactional
    public AnuncioAdmin cambiarEstado(@PathParam("id") Long id, @Valid @NotNull CambioEstado c) {
        Negocio t = tianguis();
        AnuncioTianguis a = anuncio(id);
        Estado antes = a.estado;
        Estado nuevo = estado(c.estado());
        a.cambiarEstado(nuevo, c.motivo(), Tianguis.ahora());
        a.actualizado = Tianguis.ahora();
        if (antes != nuevo && (nuevo == Estado.PUBLICADO || nuevo == Estado.RECHAZADO)) {
            // Al resolver la moderación, los reportes pendientes quedan atendidos.
            ReporteTianguis.update("atendido = true where anuncio = ?1 and atendido = false", a);
        }
        anotar(t, a.id, "Anuncio «" + a.titulo + "»: " + antes + " → " + nuevo,
                nuevo == Estado.RECHAZADO ? a.motivoRechazo : null);
        return AnuncioAdmin.de(a);
    }

    @DELETE
    @Path("/anuncios/{id}")
    @Transactional
    public void borrar(@PathParam("id") Long id) {
        Negocio t = tianguis();
        AnuncioTianguis a = anuncio(id);
        ReporteTianguis.delete("anuncio", a);
        anotar(t, a.id, "Borró el anuncio «" + a.titulo + "»", a.estado.name());
        a.delete();
    }

    // ---------------------------------------------------------------- Categorías

    @GET
    @Path("/categorias")
    @Transactional
    public List<CategoriaDto> categorias() {
        tianguis();
        return CategoriaTianguis.<CategoriaTianguis>list("order by orden, nombre").stream()
                .map(c -> CategoriaDto.de(c, AnuncioTianguis.count("categoria", c))).toList();
    }

    @POST
    @Path("/categorias")
    @Transactional
    public Response crearCategoria(@Valid @NotNull CategoriaEdicion e) {
        Negocio t = tianguis();
        CategoriaTianguis c = new CategoriaTianguis();
        llenar(c, e);
        c.persist();
        anotar(t, c.id, "Creó la categoría «" + c.nombre + "»", null);
        return Response.status(Status.CREATED).entity(CategoriaDto.de(c, 0)).build();
    }

    @PUT
    @Path("/categorias/{id}")
    @Transactional
    public CategoriaDto editarCategoria(@PathParam("id") Long id, @Valid @NotNull CategoriaEdicion e) {
        Negocio t = tianguis();
        CategoriaTianguis c = categoria(id);
        llenar(c, e);
        anotar(t, c.id, "Editó la categoría «" + c.nombre + "»", null);
        return CategoriaDto.de(c, AnuncioTianguis.count("categoria", c));
    }

    /** Solo si no tiene anuncios; si los tiene, se desactiva. */
    @DELETE
    @Path("/categorias/{id}")
    @Transactional
    public void borrarCategoria(@PathParam("id") Long id) {
        Negocio t = tianguis();
        CategoriaTianguis c = categoria(id);
        if (AnuncioTianguis.count("categoria", c) > 0) {
            throw Errores.de(Status.CONFLICT, "Tiene anuncios: mejor desactívala.");
        }
        anotar(t, c.id, "Borró la categoría «" + c.nombre + "»", null);
        c.delete();
    }

    private static CategoriaTianguis categoria(Long id) {
        return CategoriaTianguis.<CategoriaTianguis>findByIdOptional(id)
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "No existe esa categoría."));
    }

    private static void llenar(CategoriaTianguis c, CategoriaEdicion e) {
        String slug = Tianguis.slug(e.slug());
        if (slug.isEmpty()) {
            throw Errores.de(Status.BAD_REQUEST, "El slug solo lleva letras, números y guiones.");
        }
        if (CategoriaTianguis.count("slug = ?1 and id <> ?2", slug, c.id == null ? -1L : c.id) > 0) {
            throw Errores.de(Status.CONFLICT, "Ya hay una categoría con ese slug.");
        }
        c.nombre = e.nombre().trim();
        c.slug = slug;
        c.icono = Tianguis.limpio(e.icono());
        c.orden = e.orden();
        c.activa = e.activa();
        c.camposAtributos = CampoAtributo.escribir(CampoAtributo.validarDefinicion(e.campos()));
    }

    // ---------------------------------------------------------------- Vendedores

    @GET
    @Path("/vendedores")
    @Transactional
    public List<VendedorAdmin> vendedores(@QueryParam("q") String q) {
        tianguis();
        String b = Tianguis.normalizar(q);
        List<VendedorTianguis> l = b.isEmpty()
                ? VendedorTianguis.list("order by fechaRegistro desc")
                : VendedorTianguis.list("lower(nombre) like ?1 or whatsapp like ?1 order by nombre", "%" + b + "%");
        return l.stream().limit(200).map(VendedorAdmin::de).toList();
    }

    @POST
    @Path("/vendedores")
    @Transactional
    public Response crearVendedor(@Valid @NotNull VendedorEdicion e) {
        Negocio t = tianguis();
        String w = Tianguis.whatsapp(e.whatsapp());
        if (VendedorTianguis.porWhatsapp(w).isPresent()) {
            throw Errores.de(Status.CONFLICT, "Ya hay un vendedor con ese WhatsApp.");
        }
        VendedorTianguis v = new VendedorTianguis();
        v.whatsapp = w;
        v.nombre = e.nombre().trim();
        v.notasInternas = Tianguis.limpio(e.notasInternas());
        v.persist();
        anotar(t, v.id, "Dio de alta al vendedor " + v.nombre, null);
        return Response.status(Status.CREATED).entity(VendedorAdmin.de(v)).build();
    }

    @PUT
    @Path("/vendedores/{id}")
    @Transactional
    public VendedorAdmin editarVendedor(@PathParam("id") Long id, @Valid @NotNull VendedorEdicion e) {
        Negocio t = tianguis();
        VendedorTianguis v = vendedor(id);
        String w = Tianguis.whatsapp(e.whatsapp());
        if (VendedorTianguis.count("whatsapp = ?1 and id <> ?2", w, v.id) > 0) {
            throw Errores.de(Status.CONFLICT, "Ya hay un vendedor con ese WhatsApp.");
        }
        v.whatsapp = w;
        v.nombre = e.nombre().trim();
        v.notasInternas = Tianguis.limpio(e.notasInternas());
        anotar(t, v.id, "Editó al vendedor " + v.nombre, null);
        return VendedorAdmin.de(v);
    }

    public record Valor(boolean valor) {
    }

    /** Verificado: el administrador confirmó su WhatsApp a mano. */
    @PUT
    @Path("/vendedores/{id}/verificado")
    @Transactional
    public VendedorAdmin verificar(@PathParam("id") Long id, @NotNull Valor v) {
        Negocio t = tianguis();
        VendedorTianguis x = vendedor(id);
        x.verificado = v.valor();
        anotar(t, x.id, (v.valor() ? "Verificó" : "Quitó la verificación de") + " al vendedor " + x.nombre, null);
        return VendedorAdmin.de(x);
    }

    /**
     * Bloquear: no puede publicar y sus anuncios publicados o pendientes se pausan. Al
     * desbloquear, esos vuelven a revisión (PENDIENTE).
     */
    @PUT
    @Path("/vendedores/{id}/bloqueado")
    @Transactional
    public VendedorAdmin bloquear(@PathParam("id") Long id, @NotNull Valor v) {
        Negocio t = tianguis();
        VendedorTianguis x = vendedor(id);
        x.bloqueado = v.valor();
        if (v.valor()) {
            AnuncioTianguis.update("estado = ?1, pausadoPor = ?2 where vendedor = ?3 and estado in ?4",
                    Estado.PAUSADO, AnuncioTianguis.POR_BLOQUEO, x, List.of(Estado.PUBLICADO, Estado.PENDIENTE));
        } else {
            AnuncioTianguis.update("estado = ?1, pausadoPor = null where vendedor = ?2 and estado = ?3 and pausadoPor = ?4",
                    Estado.PENDIENTE, x, Estado.PAUSADO, AnuncioTianguis.POR_BLOQUEO);
        }
        anotar(t, x.id, (v.valor() ? "Bloqueó" : "Desbloqueó") + " al vendedor " + x.nombre, null);
        return VendedorAdmin.de(x);
    }

    private static VendedorTianguis vendedor(Long id) {
        return VendedorTianguis.<VendedorTianguis>findByIdOptional(id)
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "No existe ese vendedor."));
    }

    // ---------------------------------------------------------------- Reportes

    @GET
    @Path("/reportes")
    @Transactional
    public List<ReporteAdmin> reportes(@QueryParam("atendidos") @DefaultValue("false") boolean atendidos) {
        tianguis();
        return ReporteTianguis.<ReporteTianguis>list("atendido = ?1 order by fecha desc", atendidos).stream()
                .limit(300).map(ReporteAdmin::de).toList();
    }

    /** Marca atendidos los reportes de un anuncio (p. ej. tras revisarlo y dejarlo como estaba). */
    @PUT
    @Path("/anuncios/{id}/reportes/atendidos")
    @Transactional
    public AnuncioAdmin atenderReportes(@PathParam("id") Long id) {
        Negocio t = tianguis();
        AnuncioTianguis a = anuncio(id);
        long n = ReporteTianguis.update("atendido = true where anuncio = ?1 and atendido = false", a);
        anotar(t, a.id, "Atendió " + n + " reporte(s) de «" + a.titulo + "»", null);
        return AnuncioAdmin.de(a);
    }

    /** Corre ya la revisión de vencimientos (la tarea diaria la hace sola). */
    @POST
    @Path("/vencimientos")
    @Transactional
    public Resumen vencerAhora() {
        tianguis();
        servicio.vencer();
        return resumen();
    }

}
