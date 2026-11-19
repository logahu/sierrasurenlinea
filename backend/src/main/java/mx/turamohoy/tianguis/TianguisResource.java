package mx.turamohoy.tianguis;

import io.quarkus.hibernate.orm.panache.Panache;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Parameters;
import io.vertx.core.http.HttpServerRequest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.clientes.SesionCliente;
import mx.turamohoy.fotos.AlmacenFotos;
import mx.turamohoy.fotos.Foto;
import mx.turamohoy.tianguis.AnuncioTianguis.Estado;
import mx.turamohoy.tianguis.TianguisDtos.AnuncioDetalle;
import mx.turamohoy.tianguis.TianguisDtos.AnuncioResumen;
import mx.turamohoy.tianguis.TianguisDtos.CategoriaCorta;
import mx.turamohoy.tianguis.TianguisDtos.CategoriaDto;
import mx.turamohoy.tianguis.TianguisDtos.Gestion;
import mx.turamohoy.tianguis.TianguisDtos.Pagina;
import mx.turamohoy.tianguis.TianguisDtos.Publicacion;
import mx.turamohoy.tianguis.TianguisDtos.Publicado;
import mx.turamohoy.tianguis.TianguisDtos.Reporte;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * API pública del Tianguis Sierra Sur: catálogo (fase 1) y publicación sin cuenta con enlace
 * privado de gestión y reportes (fase 2). Respeta el estado del negocio «tianguis»: en pruebas,
 * solo los clientes probadores lo ven.
 */
@Path("/api/tianguis")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TianguisResource {

    static final int MAX_TAMANO = 24;
    private static final List<Estado> ACTIVOS = List.of(Estado.PENDIENTE, Estado.PUBLICADO, Estado.PAUSADO);
    private static final Map<String, String> EXTENSIONES = Map.of("image/webp", "webp", "image/jpeg", "jpg");
    static final long MAX_BYTES_FOTO = 1_500_000;

    @Inject
    SesionCliente sesionCliente;

    @Inject
    TianguisServicio servicio;

    @Inject
    LimitesTianguis limites;

    @Inject
    AlmacenFotos almacen;

    @Context
    HttpServerRequest peticion;

    /** El tianguis, si lo puede ver quien pregunta. */
    private Negocio abierto() {
        return Negocio.visiblePorSlug(Tianguis.SLUG, sesionCliente.esProbador())
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "El tianguis todavía no está abierto."));
    }

    /** Condición JPQL de «visible al público» (alias a). */
    static final String VISIBLE = "((a.estado = :publicado and a.fechaVencimiento > :ahora)"
            + " or (a.estado = :vendido and a.fechaVendido > :hace7)) and a.categoria.activa = true";

    static Parameters visibles(LocalDateTime ahora) {
        return Parameters.with("publicado", Estado.PUBLICADO).and("vendido", Estado.VENDIDO)
                .and("ahora", ahora).and("hace7", ahora.minusDays(Tianguis.DIAS_VENDIDO_VISIBLE));
    }

    /** Categorías activas con cuántos anuncios visibles tiene cada una. */
    @GET
    @Path("/categorias")
    @Transactional
    public List<CategoriaDto> categorias() {
        abierto();
        LocalDateTime ahora = Tianguis.ahora();
        List<CategoriaTianguis> cats = CategoriaTianguis.list("activa = true order by orden, nombre");
        Map<Long, Long> conteo = new java.util.HashMap<>();
        Panache.getEntityManager()
                .createQuery("select a.categoria.id, count(a) from AnuncioTianguis a where " + VISIBLE
                        + " and a.estado = :publicado group by a.categoria.id", Object[].class)
                .setParameter("publicado", Estado.PUBLICADO).setParameter("vendido", Estado.VENDIDO)
                .setParameter("ahora", ahora).setParameter("hace7", ahora.minusDays(Tianguis.DIAS_VENDIDO_VISIBLE))
                .getResultList().forEach(r -> conteo.put((Long) r[0], (Long) r[1]));
        return cats.stream().map(c -> CategoriaDto.de(c, conteo.getOrDefault(c.id, 0L))).toList();
    }

    /**
     * Anuncios visibles con filtros combinables. {@code orden}: recientes (por omisión),
     * precioAsc o precioDesc; los vendidos van al final. {@code size} máximo 24.
     */
    @GET
    @Path("/anuncios")
    @Transactional
    public Pagina<AnuncioResumen> anuncios(@QueryParam("q") String q, @QueryParam("categoria") String categoria,
                                           @QueryParam("condicion") String condicion,
                                           @QueryParam("precioMin") BigDecimal precioMin,
                                           @QueryParam("precioMax") BigDecimal precioMax,
                                           @QueryParam("orden") @DefaultValue("recientes") String orden,
                                           @QueryParam("page") @DefaultValue("0") int pagina,
                                           @QueryParam("size") @DefaultValue("24") int tamano) {
        abierto();
        LocalDateTime ahora = Tianguis.ahora();
        StringBuilder w = new StringBuilder("from AnuncioTianguis a where ").append(VISIBLE);
        Parameters p = visibles(ahora);
        String[] palabras = Tianguis.normalizar(q).split(" ");
        for (int i = 0; i < palabras.length && i < 8; i++) {
            if (!palabras[i].isBlank()) {
                w.append(" and a.busqueda like :q").append(i);
                p.and("q" + i, "%" + palabras[i] + "%");
            }
        }
        if (categoria != null && !categoria.isBlank()) {
            w.append(" and a.categoria.slug = :categoria");
            p.and("categoria", categoria.trim());
        }
        if (condicion != null && !condicion.isBlank()) {
            try {
                p.and("condicion", AnuncioTianguis.Condicion.valueOf(condicion.trim().toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException e) {
                throw Errores.de(Status.BAD_REQUEST, "Condición no válida.");
            }
            w.append(" and a.condicion = :condicion");
        }
        if (precioMin != null) {
            w.append(" and a.precio >= :precioMin");
            p.and("precioMin", precioMin);
        }
        if (precioMax != null) {
            w.append(" and a.precio <= :precioMax");
            p.and("precioMax", precioMax);
        }
        String porOrden = switch (orden) {
            case "precioAsc" -> "a.precio asc, a.fechaPublicacion desc";
            case "precioDesc" -> "a.precio desc, a.fechaPublicacion desc";
            case "recientes" -> "a.fechaPublicacion desc";
            default -> throw Errores.de(Status.BAD_REQUEST, "Orden no válido.");
        };
        int t = Math.max(1, Math.min(tamano, MAX_TAMANO));
        int pag = Math.max(0, pagina);
        var consulta = AnuncioTianguis.<AnuncioTianguis>find(
                w + " order by case when a.estado = :vendido then 1 else 0 end, " + porOrden + ", a.id desc", p);
        long total = consulta.count();
        List<AnuncioResumen> lista = consulta.page(Page.of(pag, t)).list().stream().map(AnuncioResumen::de).toList();
        return new Pagina<>(lista, total, pag, t, (int) Math.ceil(total / (double) t));
    }

    /** Ficha de un anuncio visible; cuenta la visita. Lo demás (pendiente, pausado…) es 404. */
    @GET
    @Path("/anuncios/{id}")
    @Transactional
    public AnuncioDetalle anuncio(@PathParam("id") Long id) {
        abierto();
        AnuncioTianguis a = visible(id);
        a.vistas++;
        return AnuncioDetalle.de(a);
    }

    private AnuncioTianguis visible(Long id) {
        return AnuncioTianguis.<AnuncioTianguis>findByIdOptional(id)
                .filter(a -> a.visible(Tianguis.ahora()) && a.categoria.activa)
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "Este anuncio ya no está disponible."));
    }

    // ---------------------------------------------------------------- Fase 2: publicar sin cuenta

    public record SolicitudFoto(@NotNull String tipo, @NotNull Long bytes) {
    }

    public record PermisoFoto(String subirUrl, String url, String tipo, long bytes) {
    }

    /** Permiso para subir una foto del anuncio directo a R2 (sin cuenta; limitado por IP). */
    @POST
    @Path("/fotos")
    @Transactional
    public PermisoFoto permisoFoto(@Valid @NotNull SolicitudFoto s) {
        Negocio t = abierto();
        if (!almacen.configurado()) {
            throw Errores.de(Status.SERVICE_UNAVAILABLE, "Por ahora no se pueden subir fotos. Intenta más tarde.");
        }
        String extension = EXTENSIONES.get(s.tipo());
        if (extension == null) {
            throw Errores.de(Status.BAD_REQUEST, "Solo se aceptan fotos WebP o JPEG.");
        }
        if (s.bytes() < 1 || s.bytes() > MAX_BYTES_FOTO) {
            throw Errores.de(Status.BAD_REQUEST, "La foto pesa demasiado (máximo 1.5 MB).");
        }
        if (!limites.fotosPorIp.permitir(Tianguis.ip(peticion))) {
            throw Errores.de(Status.TOO_MANY_REQUESTS, "Subiste muchas fotos seguidas. Espera un rato.");
        }
        String clave = "negocios/" + t.slug + "/" + UUID.randomUUID() + "." + extension;
        Foto f = new Foto();
        f.negocio = t;
        f.clave = clave;
        f.url = almacen.urlDe(clave);
        f.tipo = s.tipo();
        f.bytes = s.bytes();
        f.subida = Instant.now();
        f.persist();
        // La URL firmada exige ese tipo y ese tamaño exactos: R2 rechaza cualquier otro archivo.
        return new PermisoFoto(almacen.urlParaSubir(clave, s.tipo(), s.bytes(), 600), f.url, s.tipo(), s.bytes());
    }

    /**
     * Publica sin cuenta: queda PENDIENTE hasta que lo apruebe el moderador. Devuelve el token del
     * enlace privado de gestión (solo esta vez; se guarda su hash).
     */
    @POST
    @Path("/anuncios")
    @Transactional
    public Response publicar(@Valid @NotNull Publicacion p) {
        abierto();
        if (p.sitioWeb() != null && !p.sitioWeb().isBlank()) {
            throw Errores.de(Status.BAD_REQUEST, "No se pudo enviar tu anuncio.");
        }
        if (!p.aceptaReglas()) {
            throw Errores.de(Status.BAD_REQUEST, "Acepta las reglas de publicación para continuar.");
        }
        String whatsapp = Tianguis.whatsapp(p.vendedorWhatsapp());
        String ip = Tianguis.ip(peticion);
        VendedorTianguis v = VendedorTianguis.porWhatsapp(whatsapp).orElse(null);
        if (v != null && v.bloqueado) {
            throw Errores.de(Status.FORBIDDEN, "Este WhatsApp no puede publicar en el tianguis.");
        }
        LocalDateTime ahora = Tianguis.ahora();
        if (v != null && AnuncioTianguis.count("vendedor = ?1 and fechaCreacion > ?2", v, ahora.minusDays(1))
                >= limites.porWhatsappAlDia) {
            throw Errores.de(Status.TOO_MANY_REQUESTS,
                    "Ya enviaste " + limites.porWhatsappAlDia + " anuncios hoy. Vuelve a intentar mañana.");
        }
        if (v != null && AnuncioTianguis.count("vendedor = ?1 and estado in ?2", v, ACTIVOS) >= limites.activosPorVendedor) {
            throw Errores.de(Status.TOO_MANY_REQUESTS, "Tienes " + limites.activosPorVendedor
                    + " anuncios activos. Marca alguno como vendido para publicar otro.");
        }
        if (!limites.publicarPorIp.permitir(ip)) {
            throw Errores.de(Status.TOO_MANY_REQUESTS, "Se enviaron muchos anuncios desde esta conexión. Intenta mañana.");
        }
        AnuncioTianguis a = new AnuncioTianguis();
        a.vendedor = VendedorTianguis.obtener(p.vendedorNombre(), whatsapp);
        servicio.llenar(a, datos(p));
        a.estado = Estado.PENDIENTE;
        a.ipOrigen = ip;
        String token = Tianguis.nuevoToken();
        a.tokenHash = Tianguis.hash(token);
        a.persist();
        return Response.status(Status.CREATED).entity(new Publicado(a.id, token, a.estado.name())).build();
    }

    static TianguisServicio.Datos datos(Publicacion p) {
        return new TianguisServicio.Datos(p.categoria(), p.titulo(), p.descripcion(), p.precio(), p.negociable(),
                p.condicion(), p.atributos(), p.ubicacion(), p.fotos());
    }

    private AnuncioTianguis porToken(String token) {
        if (token == null || token.length() < 20 || token.length() > 100) {
            throw Errores.de(Status.NOT_FOUND, "Este enlace no es válido.");
        }
        return AnuncioTianguis.<AnuncioTianguis>find("tokenHash", Tianguis.hash(token)).firstResultOptional()
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "Este enlace no es válido."));
    }

    /** Lo que ve el vendedor en su enlace privado: estado, motivo de rechazo y qué puede hacer. */
    @GET
    @Path("/gestion/{token}")
    @Transactional
    public Gestion gestion(@PathParam("token") String token) {
        return gestionDe(porToken(token));
    }

    static Gestion gestionDe(AnuncioTianguis a) {
        LocalDateTime ahora = Tianguis.ahora();
        boolean bloqueado = a.vendedor.bloqueado;
        boolean vencido = a.estado == Estado.VENCIDO
                || (a.estado == Estado.PUBLICADO && a.fechaVencimiento != null && !a.fechaVencimiento.isAfter(ahora));
        String estado = vencido ? Estado.VENCIDO.name() : a.estado.name();
        return new Gestion(a.id, a.idSlug(), a.titulo, a.descripcion, a.precio, a.negociable, a.condicion.name(),
                estado, a.listaFotos(), CategoriaCorta.de(a.categoria), a.mapaAtributos(), a.ubicacion,
                a.vendedor.nombre, a.vendedor.whatsapp, a.motivoRechazo, a.pausadoPor, a.fechaCreacion,
                a.fechaPublicacion, a.fechaVencimiento, a.fechaVendido, a.renovaciones,
                Math.max(0, Tianguis.MAX_RENOVACIONES - a.renovaciones), a.vistas,
                !bloqueado && a.estado != Estado.VENDIDO,
                !bloqueado && a.estado == Estado.PUBLICADO && !vencido,
                !bloqueado && a.estado == Estado.PAUSADO && AnuncioTianguis.POR_VENDEDOR.equals(a.pausadoPor),
                !bloqueado && (vencido || a.estado == Estado.PUBLICADO) && a.renovaciones < Tianguis.MAX_RENOVACIONES,
                !bloqueado && (a.estado == Estado.PUBLICADO || a.estado == Estado.PAUSADO || vencido),
                bloqueado);
    }

    /** El vendedor corrige su anuncio: vuelve a revisión (PENDIENTE). */
    @PUT
    @Path("/gestion/{token}")
    @Transactional
    public Gestion editar(@PathParam("token") String token, @Valid @NotNull Publicacion p) {
        AnuncioTianguis a = porToken(token);
        if (a.vendedor.bloqueado) {
            throw Errores.de(Status.FORBIDDEN, "Este WhatsApp no puede publicar en el tianguis.");
        }
        if (a.estado == Estado.VENDIDO) {
            throw Errores.de(Status.CONFLICT, "Este anuncio ya está vendido; publica uno nuevo.");
        }
        servicio.llenar(a, datos(p));
        if (p.vendedorNombre() != null && !p.vendedorNombre().isBlank()) {
            a.vendedor.nombre = p.vendedorNombre().trim();
        }
        a.estado = Estado.PENDIENTE;
        a.pausadoPor = null;
        a.motivoRechazo = null;
        return gestionDe(a);
    }

    /** vendido, pausar, reanudar o renovar (30 días más, máximo 3 veces). */
    @POST
    @Path("/gestion/{token}/{accion}")
    @Transactional
    public Gestion accion(@PathParam("token") String token, @PathParam("accion") String accion) {
        AnuncioTianguis a = porToken(token);
        Gestion g = gestionDe(a);
        LocalDateTime ahora = Tianguis.ahora();
        switch (accion) {
            case "vendido" -> {
                exigir(g.puedeMarcarVendido(), "Este anuncio no se puede marcar como vendido.");
                a.marcarVendido(ahora);
            }
            case "pausar" -> {
                exigir(g.puedePausar(), "Solo se puede pausar un anuncio publicado.");
                a.pausar(AnuncioTianguis.POR_VENDEDOR);
            }
            case "reanudar" -> {
                exigir(g.puedeReanudar(), "Este anuncio no se puede reanudar.");
                if (a.fechaVencimiento != null && a.fechaVencimiento.isAfter(ahora)) {
                    a.estado = Estado.PUBLICADO;
                } else {
                    a.estado = Estado.VENCIDO;
                }
                a.pausadoPor = null;
            }
            case "renovar" -> {
                exigir(g.puedeRenovar(), a.renovaciones >= Tianguis.MAX_RENOVACIONES
                        ? "Ya lo renovaste " + Tianguis.MAX_RENOVACIONES + " veces; publícalo de nuevo."
                        : "Este anuncio no se puede renovar.");
                a.estado = Estado.PUBLICADO;
                a.fechaVencimiento = ahora.plusDays(Tianguis.DIAS_PUBLICADO);
                a.renovaciones++;
            }
            default -> throw Errores.de(Status.NOT_FOUND, "Acción no válida.");
        }
        a.actualizado = ahora;
        return gestionDe(a);
    }

    private static void exigir(boolean condicion, String mensaje) {
        if (!condicion) {
            throw Errores.de(Status.CONFLICT, mensaje);
        }
    }

    /** Reportar un anuncio visible. Con 3 reportes sin atender, se pausa hasta que lo revisen. */
    @POST
    @Path("/anuncios/{id}/reportes")
    @Transactional
    public Response reportar(@PathParam("id") Long id, @Valid @NotNull Reporte r) {
        abierto();
        AnuncioTianguis a = visible(id);
        String motivo = r.motivo().trim().toUpperCase(Locale.ROOT);
        if (!ReporteTianguis.MOTIVOS.containsKey(motivo)) {
            throw Errores.de(Status.BAD_REQUEST, "Motivo no válido.");
        }
        String ip = Tianguis.ip(peticion);
        if (!limites.reportePorAnuncio.permitir(ip + "#" + a.id)) {
            throw Errores.de(Status.TOO_MANY_REQUESTS, "Ya reportaste este anuncio. Gracias, lo revisaremos.");
        }
        if (!limites.reportesPorIp.permitir(ip)) {
            throw Errores.de(Status.TOO_MANY_REQUESTS, "Enviaste muchos reportes. Intenta más tarde.");
        }
        ReporteTianguis rep = new ReporteTianguis();
        rep.anuncio = a;
        rep.motivo = motivo;
        rep.comentario = Tianguis.limpio(r.comentario());
        rep.ip = ip;
        rep.persist();
        if (a.estado == Estado.PUBLICADO && ReporteTianguis.sinAtender(a) >= ReporteTianguis.PARA_PAUSAR) {
            a.pausar(AnuncioTianguis.POR_REPORTES);
        }
        return Response.status(Status.CREATED).build();
    }

}
