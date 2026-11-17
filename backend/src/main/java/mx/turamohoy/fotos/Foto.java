package mx.turamohoy.fotos;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;

import java.time.Instant;

/**
 * Una foto subida a R2. Al borrarla se elimina el archivo (libera espacio) pero el
 * registro se queda con la fecha y quién la borró.
 */
@Entity
@Table(name = "foto")
public class Foto extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    @Column(nullable = false, length = 300, unique = true)
    public String clave;

    @Column(nullable = false, length = 500)
    public String url;

    @Column(nullable = false, length = 30)
    public String tipo;

    @Column(nullable = false)
    public long bytes;

    @Column(nullable = false)
    public Instant subida;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subida_por")
    public Usuario subidaPor;

    public Instant borrada;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "borrada_por")
    public Usuario borradaPor;

    /** Dónde se usa esta foto (productos, portada, lugares de comida); vacío = se puede borrar. */
    public java.util.List<String> usos() {
        java.util.List<String> usos = new java.util.ArrayList<>();
        mx.turamohoy.catalogo.model.Producto.<mx.turamohoy.catalogo.model.Producto>list(
                        "imagenUrl = ?1 or galeria like ?2", url, "%" + url + "%")
                .forEach(p -> usos.add("Producto: " + p.nombre));
        if (Negocio.count("portadaUrl", url) > 0) {
            usos.add("Portada del negocio");
        }
        mx.turamohoy.catalogo.model.Restaurante.<mx.turamohoy.catalogo.model.Restaurante>list("imagenUrl", url)
                .forEach(r -> usos.add("Lugar de comida: " + r.nombre));
        mx.turamohoy.catalogo.model.Platillo.<mx.turamohoy.catalogo.model.Platillo>list("imagenUrl", url)
                .forEach(p -> usos.add("Platillo: " + p.nombre));
        mx.turamohoy.publicidad.Anuncio.<mx.turamohoy.publicidad.Anuncio>list("imagenUrl", url)
                .forEach(a -> usos.add("Anuncio: " + a.titulo));
        return usos;
    }
}
