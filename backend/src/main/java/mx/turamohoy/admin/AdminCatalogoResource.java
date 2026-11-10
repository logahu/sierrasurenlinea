package mx.turamohoy.admin;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
import mx.turamohoy.catalogo.model.Categoria;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.historial.Cambios;
import mx.turamohoy.catalogo.model.Producto;
import mx.turamohoy.fotos.ImagenesPermitidas;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Catálogo de un negocio desde el panel: categorías y productos (en Encarguitos, sus
 * tarifas por zona). Nada se borra: un producto se oculta con {@code disponible = false}
 * y se puede volver a mostrar. El dueño puede con todos; el encargado, con el suyo.
 */
@Path("/api/admin/negocios/{slug}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class AdminCatalogoResource {

    /** Límite de la columna caracteristicas (se guardan unidas con "|"). */
    static final int MAX_CARACTERISTICAS = 500;
    static final int MAX_GALERIA = 8;

    @Inject
    SesionActual sesion;

    @Inject
    ImagenesPermitidas imagenes;

    // ---------------------------------------------------------------- DTOs

    public record CategoriaAdminDto(Long id, String slug, String nombre, String descripcion, int orden,
                                    long productos) {
        static CategoriaAdminDto de(Categoria c) {
            return new CategoriaAdminDto(c.id, c.slug, c.nombre, c.descripcion, c.orden,
                    Producto.count("categoria", c));
        }
    }

    public record CategoriaEdicion(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            @Size(max = 255) String descripcion,
            @Min(0) @Max(999) Integer orden) {
    }

    public record ProductoAdminDto(Long id, String nombre, String descripcion, BigDecimal precio,
                                   String unidadPrecio, List<String> caracteristicas, String imagenUrl,
                                   List<String> galeria,
                                   Long categoriaId, String categoriaNombre, boolean destacado,
                                   boolean disponible) {
        static ProductoAdminDto de(Producto p) {
            return new ProductoAdminDto(p.id, p.nombre, p.descripcion, p.precio, p.unidadPrecio,
                    separar(p.caracteristicas), p.imagenUrl, separar(p.galeria), p.categoria.id, p.categoria.nombre,
                    p.destacado, p.disponible);
        }
    }

    public record ProductoEdicion(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 120) String nombre,
            @Size(max = 1000, message = "La descripción puede tener hasta 1000 caracteres.") String descripcion,
            @NotNull(message = "El precio es obligatorio.")
            @DecimalMin(value = "0", message = "El precio no puede ser negativo.")
            @DecimalMax(value = "999999.99", message = "El precio es demasiado alto.")
            @Digits(integer = 6, fraction = 2, message = "El precio lleva como máximo dos decimales.")
            BigDecimal precio,
            @Size(max = 30, message = "La unidad puede tener hasta 30 caracteres.") String unidadPrecio,
            List<@Size(max = 120, message = "Cada característica puede tener hasta 120 caracteres.") String> caracteristicas,
            @NotNull(message = "Elige la categoría.") Long categoriaId,
            boolean destacado,
            Boolean disponible,
            /** Foto subida con /fotos o una de ejemplo (img/...); vacío = no cambia. */
            String imagenUrl,
            /** Fotos adicionales en orden; null = no cambia, lista vacía = sin galería. */
            @Size(max = MAX_GALERIA, message = "La galería puede tener hasta 8 fotos.") List<String> galeria) {
    }

    public record Disponibilidad(boolean disponible) {
    }

    // ---------------------------------------------------------------- Categorías

    @GET
    @Path("/categorias")
    public List<CategoriaAdminDto> categorias(@PathParam("slug") String slug) {
        return Categoria.delNegocio(sesion.negocioEditable(slug)).stream()
                .map(CategoriaAdminDto::de).toList();
    }

    @POST
    @Path("/categorias")
    @Transactional
    public Response crearCategoria(@PathParam("slug") String slug, @Valid @NotNull CategoriaEdicion e) {
        Negocio n = sesion.negocioEditable(slug);
        Categoria c = new Categoria();
        c.negocio = n;
        c.nombre = e.nombre().trim();
        c.descripcion = AdminNegocioResource.limpio(e.descripcion());
        c.slug = slugLibre(n, e.nombre());
        c.orden = e.orden() != null ? e.orden()
                : Categoria.<Categoria>list("negocio", n).stream().mapToInt(x -> x.orden).max().orElse(0) + 1;
        c.persist();
        Bitacora.anotar(sesion.usuario(), n, Bitacora.CATEGORIA, c.id, "Creó la categoría " + c.nombre, null);
        return Response.status(Status.CREATED).entity(CategoriaAdminDto.de(c)).build();
    }

    /** El slug no cambia al renombrar, para no romper enlaces que ya se compartieron. */
    @PUT
    @Path("/categorias/{id}")
    @Transactional
    public CategoriaAdminDto editarCategoria(@PathParam("slug") String slug, @PathParam("id") Long id,
                                             @Valid @NotNull CategoriaEdicion e) {
        Negocio n = sesion.negocioEditable(slug);
        Categoria c = categoriaDe(n, id);
        Cambios cambios = new Cambios().campo("Nombre", c.nombre, e.nombre().trim())
                .largo("Descripción", c.descripcion, e.descripcion())
                .campo("Orden", c.orden, e.orden() != null ? e.orden() : c.orden);
        c.nombre = e.nombre().trim();
        c.descripcion = AdminNegocioResource.limpio(e.descripcion());
        if (e.orden() != null) {
            c.orden = e.orden();
        }
        if (cambios.hay()) {
            Bitacora.anotar(sesion.usuario(), n, Bitacora.CATEGORIA, c.id, "Editó la categoría " + c.nombre, cambios.toString());
        }
        return CategoriaAdminDto.de(c);
    }

    // ---------------------------------------------------------------- Productos

    /** Todos, también los ocultos, ordenados por categoría y nombre. */
    @GET
    @Path("/productos")
    public List<ProductoAdminDto> productos(@PathParam("slug") String slug) {
        Negocio n = sesion.negocioEditable(slug);
        return Producto.<Producto>list(
                        "select p from Producto p join fetch p.categoria c where c.negocio = ?1 order by c.orden, p.nombre", n)
                .stream().map(ProductoAdminDto::de).toList();
    }

    @GET
    @Path("/productos/{id}")
    public ProductoAdminDto producto(@PathParam("slug") String slug, @PathParam("id") Long id) {
        return ProductoAdminDto.de(productoDe(sesion.negocioEditable(slug), id));
    }

    @POST
    @Path("/productos")
    @Transactional
    public Response crearProducto(@PathParam("slug") String slug, @Valid @NotNull ProductoEdicion e) {
        Negocio n = sesion.negocioEditable(slug);
        Producto p = new Producto();
        // Mientras no haya fotos propias (fase 3), un producto nuevo usa la imagen del negocio.
        p.imagenUrl = n.portadaUrl;
        p.disponible = true;
        aplicar(n, p, e);
        p.persist();
        Bitacora.anotar(sesion.usuario(), n, Bitacora.PRODUCTO, p.id, "Creó el producto " + p.nombre,
                "Precio: " + Cambios.texto(p.precio) + "; Categoría: " + p.categoria.nombre);
        return Response.status(Status.CREATED).entity(ProductoAdminDto.de(p)).build();
    }

    @PUT
    @Path("/productos/{id}")
    @Transactional
    public ProductoAdminDto editarProducto(@PathParam("slug") String slug, @PathParam("id") Long id,
                                           @Valid @NotNull ProductoEdicion e) {
        Negocio n = sesion.negocioEditable(slug);
        Producto p = productoDe(n, id);
        Cambios cambios = new Cambios();
        String nombre = p.nombre;
        java.math.BigDecimal precio = p.precio;
        String unidad = p.unidadPrecio;
        String categoria = p.categoria.nombre;
        boolean destacado = p.destacado;
        boolean disponible = p.disponible;
        String descripcion = p.descripcion;
        String caracteristicas = p.caracteristicas;
        String imagen = p.imagenUrl;
        String galeria = p.galeria;
        aplicar(n, p, e);
        cambios.campo("Nombre", nombre, p.nombre).campo("Precio", precio, p.precio).campo("Unidad", unidad, p.unidadPrecio)
                .campo("Categoría", categoria, p.categoria.nombre).campo("Destacado", destacado, p.destacado)
                .campo("Disponible", disponible, p.disponible).largo("Descripción", descripcion, p.descripcion)
                .largo("Características", caracteristicas, p.caracteristicas).largo("Foto principal", imagen, p.imagenUrl)
                .largo("Galería", galeria, p.galeria);
        if (cambios.hay()) {
            Bitacora.anotar(sesion.usuario(), n, Bitacora.PRODUCTO, p.id, "Editó el producto " + p.nombre, cambios.toString());
        }
        return ProductoAdminDto.de(p);
    }

    /** Mostrar u ocultar con un toque desde la lista. */
    @PUT
    @Path("/productos/{id}/disponible")
    @Transactional
    public ProductoAdminDto cambiarDisponible(@PathParam("slug") String slug, @PathParam("id") Long id,
                                              @NotNull Disponibilidad d) {
        Negocio n = sesion.negocioEditable(slug);
        Producto p = productoDe(n, id);
        if (p.disponible != d.disponible()) {
            Bitacora.anotar(sesion.usuario(), n, Bitacora.PRODUCTO, p.id,
                    (d.disponible() ? "Mostró el producto " : "Ocultó el producto ") + p.nombre, null);
        }
        p.disponible = d.disponible();
        return ProductoAdminDto.de(p);
    }

    // ---------------------------------------------------------------- Apoyo

    private void aplicar(Negocio n, Producto p, ProductoEdicion e) {
        p.nombre = e.nombre().trim();
        p.descripcion = AdminNegocioResource.limpio(e.descripcion());
        p.precio = e.precio();
        p.unidadPrecio = AdminNegocioResource.limpio(e.unidadPrecio());
        p.caracteristicas = unir(e.caracteristicas());
        p.categoria = categoriaDe(n, e.categoriaId());
        p.destacado = e.destacado();
        if (e.disponible() != null) {
            p.disponible = e.disponible();
        }
        String imagen = imagenes.validar(n, e.imagenUrl());
        if (imagen != null) {
            p.imagenUrl = imagen;
        }
        if (e.galeria() != null) {
            List<String> fotos = e.galeria().stream()
                    .map(u -> imagenes.validar(n, u))
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            p.galeria = fotos.isEmpty() ? null : String.join("|", fotos);
        }
    }

    private static Categoria categoriaDe(Negocio n, Long id) {
        Categoria c = id == null ? null : Categoria.findById(id);
        if (c == null || !c.negocio.id.equals(n.id)) {
            throw Errores.de(Status.BAD_REQUEST, "Esa categoría no es de " + n.nombre + ".");
        }
        return c;
    }

    private static Producto productoDe(Negocio n, Long id) {
        Producto p = Producto.buscarCompleto(id);
        if (p == null || !p.categoria.negocio.id.equals(n.id)) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese producto en " + n.nombre + ".");
        }
        return p;
    }

    /** Une la lista con "|" (el separador que usa la columna), sin vacíos ni "|" sueltos. */
    static String unir(List<String> lista) {
        if (lista == null) {
            return null;
        }
        String unido = String.join("|", lista.stream()
                .filter(Objects::nonNull)
                .map(s -> s.replace('|', '/').trim())
                .filter(s -> !s.isEmpty())
                .toList());
        if (unido.length() > MAX_CARACTERISTICAS) {
            throw Errores.de(Status.BAD_REQUEST,
                    "Las características juntas pueden tener hasta " + MAX_CARACTERISTICAS + " caracteres.");
        }
        return unido.isEmpty() ? null : unido;
    }

    static List<String> separar(String texto) {
        if (texto == null || texto.isBlank()) {
            return List.of();
        }
        return Arrays.stream(texto.split("\\|")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    /** "Arreglos de Temporada" → "arreglos-de-temporada"; si ya existe en el negocio, "-2", "-3"... */
    static String slugLibre(Negocio n, String nombre) {
        String base = slug(nombre);
        String candidato = base;
        for (int i = 2; Categoria.count("negocio = ?1 and slug = ?2", n, candidato) > 0; i++) {
            candidato = base + "-" + i;
        }
        return candidato;
    }

    static String slug(String texto) {
        String s = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
        if (s.length() > 50) {
            s = s.substring(0, 50).replaceAll("-+$", "");
        }
        return s.isEmpty() ? "categoria" : s;
    }
}
