package mx.turamohoy.tianguis;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Lo que entra y sale de la API del tianguis. La pública nunca lleva notas internas, IP ni token. */
public final class TianguisDtos {

    private TianguisDtos() {
    }

    public record CategoriaDto(Long id, String nombre, String slug, String icono, int orden, boolean activa,
                               String tipo, List<CampoAtributo> campos, long anuncios) {

        static CategoriaDto de(CategoriaTianguis c, long anuncios) {
            return new CategoriaDto(c.id, c.nombre, c.slug, c.icono, c.orden, c.activa, c.tipo.name(), c.campos(),
                    anuncios);
        }
    }

    public record CategoriaCorta(String slug, String nombre, String icono, String tipo) {
        static CategoriaCorta de(CategoriaTianguis c) {
            return new CategoriaCorta(c.slug, c.nombre, c.icono, c.tipo.name());
        }
    }

    /** Un atributo listo para la tabla de la ficha. */
    public record Atributo(String nombre, String etiqueta, String valor, String unidad) {
    }

    public record VendedorPublico(String nombre, String whatsapp, boolean verificado) {
    }

    public record AnuncioResumen(Long id, String idSlug, String titulo, BigDecimal precio, String tipoPrecio,
                                 boolean negociable, String condicion, String estado, String portada, CategoriaCorta categoria,
                                 String ubicacion, LocalDateTime fechaPublicacion, LocalDateTime fechaVendido) {

        static AnuncioResumen de(AnuncioTianguis a) {
            List<String> f = a.listaFotos();
            return new AnuncioResumen(a.id, a.idSlug(), a.titulo, a.precio, a.tipoPrecio.name(), a.negociable,
                    a.condicionTexto(),
                    a.estado.name(), f.isEmpty() ? null : f.get(0), CategoriaCorta.de(a.categoria), a.ubicacion,
                    a.fechaPublicacion, a.fechaVendido);
        }
    }

    public record AnuncioDetalle(Long id, String idSlug, String titulo, String descripcion, BigDecimal precio,
                                 String tipoPrecio, boolean negociable, String condicion, String estado, List<String> fotos,
                                 CategoriaCorta categoria, List<Atributo> atributos, String ubicacion,
                                 LocalDateTime fechaPublicacion, LocalDateTime fechaVendido,
                                 VendedorPublico vendedor, int vistas) {

        static AnuncioDetalle de(AnuncioTianguis a) {
            return new AnuncioDetalle(a.id, a.idSlug(), a.titulo, a.descripcion, a.precio, a.tipoPrecio.name(),
                    a.negociable, a.condicionTexto(), a.estado.name(), a.listaFotos(), CategoriaCorta.de(a.categoria),
                    atributosDe(a), a.ubicacion, a.fechaPublicacion, a.fechaVendido,
                    new VendedorPublico(a.vendedor.nombre, a.vendedor.whatsapp, a.vendedor.verificado), a.vistas);
        }
    }

    /** Los atributos en el orden de la categoría, con su etiqueta. */
    static List<Atributo> atributosDe(AnuncioTianguis a) {
        Map<String, String> v = a.mapaAtributos();
        return a.categoria.campos().stream().filter(c -> v.containsKey(c.nombre()))
                .map(c -> new Atributo(c.nombre(), c.etiqueta(), v.get(c.nombre()), c.unidad())).toList();
    }

    public record Pagina<T>(List<T> anuncios, long total, int pagina, int tamano, int paginas) {
    }

    // ---- Fase 2: publicar y gestionar sin cuenta

    public record Publicacion(
            @NotBlank(message = "Elige la categoría.") String categoria,
            @NotBlank(message = "Escribe el título.") @Size(max = 80, message = "El título es de máximo 80 letras.") String titulo,
            @NotBlank(message = "Escribe la descripción.") @Size(max = 2000, message = "La descripción es de máximo 2000 letras.") String descripcion,
            /** Obligatorio salvo «a cotizar». */
            @DecimalMin(value = "0", message = "El precio no puede ser negativo.")
            @DecimalMax(value = "99999999", message = "Revisa el precio.") BigDecimal precio,
            /** FIJO (por omisión), DESDE o COTIZAR; los dos últimos solo en servicios. */
            String tipoPrecio,
            boolean negociable,
            /** Obligatoria en artículos; se ignora en servicios. */
            String condicion,
            Map<String, String> atributos,
            @NotBlank(message = "Escribe la localidad o colonia.") @Size(max = 80, message = "La ubicación es de máximo 80 letras.") String ubicacion,
            List<String> fotos,
            @NotBlank(message = "Escribe tu nombre.") @Size(max = 80, message = "El nombre es de máximo 80 letras.") String vendedorNombre,
            @NotBlank(message = "Escribe tu WhatsApp.") String vendedorWhatsapp,
            boolean aceptaReglas,
            /** Campo trampa (oculto): las personas lo dejan vacío. */
            String sitioWeb) {
    }

    /** Respuesta al publicar: el token solo se ve esta vez. */
    public record Publicado(Long id, String token, String estado) {
    }

    public record Gestion(Long id, String idSlug, String titulo, String descripcion, BigDecimal precio,
                          String tipoPrecio, boolean negociable, String condicion, String estado, List<String> fotos,
                          CategoriaCorta categoria, Map<String, String> atributos, String ubicacion,
                          String vendedorNombre, String vendedorWhatsapp, String motivoRechazo, String pausadoPor,
                          LocalDateTime fechaCreacion, LocalDateTime fechaPublicacion,
                          LocalDateTime fechaVencimiento, LocalDateTime fechaVendido, int renovaciones,
                          int renovacionesRestantes, int vistas, boolean puedeEditar, boolean puedePausar,
                          boolean puedeReanudar, boolean puedeRenovar, boolean puedeMarcarVendido,
                          boolean vendedorBloqueado) {
    }

    public record Reporte(@NotBlank(message = "Elige el motivo.") String motivo,
                          @Size(max = 500, message = "El comentario es de máximo 500 letras.") String comentario) {
    }

    // ---- Panel

    public record AnuncioEdicion(
            @NotBlank(message = "Elige la categoría.") String categoria,
            @NotBlank(message = "Escribe el título.") @Size(max = 80, message = "El título es de máximo 80 letras.") String titulo,
            @NotBlank(message = "Escribe la descripción.") @Size(max = 2000, message = "La descripción es de máximo 2000 letras.") String descripcion,
            /** Obligatorio salvo «a cotizar». */
            @DecimalMin(value = "0", message = "El precio no puede ser negativo.")
            @DecimalMax(value = "99999999", message = "Revisa el precio.") BigDecimal precio,
            /** FIJO (por omisión), DESDE o COTIZAR; los dos últimos solo en servicios. */
            String tipoPrecio,
            boolean negociable,
            /** Obligatoria en artículos; se ignora en servicios. */
            String condicion,
            String modalidad,
            Map<String, String> atributos,
            @NotBlank(message = "Escribe la localidad o colonia.") @Size(max = 80, message = "La ubicación es de máximo 80 letras.") String ubicacion,
            List<String> fotos,
            boolean destacado,
            /** Vendedor existente, o nombre + WhatsApp para darlo de alta al vuelo. */
            Long vendedorId, String vendedorNombre, String vendedorWhatsapp,
            /** Al crear: publicarlo de una vez. */
            boolean publicar) {
    }

    public record CambioEstado(@NotBlank(message = "Falta el estado.") String estado, String motivo) {
    }

    public record VendedorAdmin(Long id, String nombre, String whatsapp, boolean verificado, boolean bloqueado,
                                LocalDateTime fechaRegistro, String notasInternas, long activos, long total) {

        static VendedorAdmin de(VendedorTianguis v) {
            long activos = AnuncioTianguis.count("vendedor = ?1 and estado in ?2", v,
                    List.of(AnuncioTianguis.Estado.PENDIENTE, AnuncioTianguis.Estado.PUBLICADO, AnuncioTianguis.Estado.PAUSADO));
            return new VendedorAdmin(v.id, v.nombre, v.whatsapp, v.verificado, v.bloqueado, v.fechaRegistro,
                    v.notasInternas, activos, AnuncioTianguis.count("vendedor", v));
        }
    }

    public record VendedorEdicion(@NotBlank(message = "Escribe el nombre.") @Size(max = 80) String nombre,
                                  @NotBlank(message = "Escribe el WhatsApp.") String whatsapp,
                                  @Size(max = 1000) String notasInternas) {
    }

    public record AnuncioAdmin(Long id, String idSlug, String titulo, String descripcion, BigDecimal precio,
                               String tipoPrecio, boolean negociable, String condicion, String estado, String modalidad,
                               List<String> fotos, CategoriaCorta categoria, Map<String, String> atributos,
                               String ubicacion, boolean destacado, String motivoRechazo, String pausadoPor,
                               int renovaciones, VendedorAdmin vendedor, LocalDateTime fechaCreacion,
                               LocalDateTime actualizado, LocalDateTime fechaPublicacion,
                               LocalDateTime fechaVencimiento, LocalDateTime fechaVendido, int vistas,
                               long reportesSinAtender, boolean delPublico) {

        static AnuncioAdmin de(AnuncioTianguis a) {
            return new AnuncioAdmin(a.id, a.idSlug(), a.titulo, a.descripcion, a.precio, a.tipoPrecio.name(),
                    a.negociable, a.condicionTexto(), a.estado.name(), a.modalidad.name(), a.listaFotos(),
                    CategoriaCorta.de(a.categoria), a.mapaAtributos(), a.ubicacion, a.destacado, a.motivoRechazo,
                    a.pausadoPor, a.renovaciones, VendedorAdmin.de(a.vendedor), a.fechaCreacion, a.actualizado,
                    a.fechaPublicacion, a.fechaVencimiento, a.fechaVendido, a.vistas,
                    ReporteTianguis.sinAtender(a), a.tokenHash != null);
        }
    }

    public record CategoriaEdicion(@NotBlank(message = "Escribe el nombre.") @Size(max = 60) String nombre,
                                   @NotBlank(message = "Escribe el slug.") @Size(max = 60) String slug,
                                   @Size(max = 30) String icono, int orden, boolean activa,
                                   /** ARTICULO (por omisión) o SERVICIO. */
                                   String tipo,
                                   List<CampoAtributo> campos) {
    }

    public record ReporteAdmin(Long id, Long anuncioId, String anuncioTitulo, String anuncioEstado, String motivo,
                               String motivoTexto, String comentario, LocalDateTime fecha, boolean atendido) {

        static ReporteAdmin de(ReporteTianguis r) {
            return new ReporteAdmin(r.id, r.anuncio.id, r.anuncio.titulo, r.anuncio.estado.name(), r.motivo,
                    ReporteTianguis.MOTIVOS.get(r.motivo), r.comentario, r.fecha, r.atendido);
        }
    }

    /** Contadores del menú del panel. */
    public record Resumen(long pendientes, long reportes) {
    }
}
