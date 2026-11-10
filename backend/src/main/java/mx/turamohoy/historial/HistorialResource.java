package mx.turamohoy.historial;

import io.quarkus.panache.common.Parameters;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.admin.Usuario;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Historial de cambios. El administrador ve todo; el encargado, lo de su negocio.
 * Solo lectura: el historial no se edita ni se borra.
 */
@Path("/api/admin/historial")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class HistorialResource {

    static final int POR_PAGINA = 50;

    @Inject
    SesionActual sesion;

    public record Renglon(Long id, Instant cuando, String actorTipo, String actorNombre, String negocioSlug,
                          String negocioNombre, String entidad, Long entidadId, String accion, String detalle) {
        static Renglon de(Bitacora b) {
            return new Renglon(b.id, b.cuando, b.actorTipo, b.actorNombre,
                    b.negocio == null ? null : b.negocio.slug, b.negocio == null ? null : b.negocio.nombre,
                    b.entidad, b.entidadId, b.accion, b.detalle);
        }
    }

    public record Pagina(List<Renglon> renglones, boolean hayMas) {
    }

    /**
     * @param entidad   NEGOCIO, PRODUCTO, PEDIDO… (vacío = todo)
     * @param id        con entidad: el historial de una sola cosa (p. ej. un pedido)
     * @param negocio   slug del negocio (el encargado siempre ve solo el suyo)
     * @param q         texto en la acción, el detalle o el nombre de quien lo hizo
     * @param pagina    desde 0
     */
    @GET
    public Pagina listar(@QueryParam("entidad") String entidad, @QueryParam("id") Long id,
                         @QueryParam("negocio") String negocio, @QueryParam("q") String q,
                         @QueryParam("pagina") @DefaultValue("0") int pagina) {
        Usuario u = sesion.usuario();
        List<String> condiciones = new ArrayList<>();
        Parameters p = new Parameters();
        if (!u.esDueno()) {
            condiciones.add("b.negocio = :suyo");
            p.and("suyo", u.negocio);
        } else if (negocio != null && !negocio.isBlank()) {
            condiciones.add("b.negocio.slug = :slug");
            p.and("slug", negocio);
        }
        if (entidad != null && !entidad.isBlank()) {
            condiciones.add("b.entidad = :entidad");
            p.and("entidad", entidad);
            if (id != null) {
                condiciones.add("b.entidadId = :id");
                p.and("id", id);
            }
        }
        if (q != null && !q.isBlank()) {
            condiciones.add("(lower(b.accion) like :q or lower(b.detalle) like :q or lower(b.actorNombre) like :q)");
            p.and("q", "%" + q.trim().toLowerCase() + "%");
        }
        String hql = "from Bitacora b left join fetch b.negocio"
                + (condiciones.isEmpty() ? "" : " where " + String.join(" and ", condiciones))
                + " order by b.cuando desc, b.id desc";
        int desde = Math.max(0, pagina);
        List<Bitacora> lista = Bitacora.<Bitacora>find(hql, p).range(desde * POR_PAGINA, desde * POR_PAGINA + POR_PAGINA)
                .list();
        boolean hayMas = lista.size() > POR_PAGINA;
        return new Pagina(lista.stream().limit(POR_PAGINA).map(Renglon::de).toList(), hayMas);
    }
}
