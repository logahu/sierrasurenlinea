package mx.turamohoy.fotos;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * Fotos en Cloudflare R2. Los datos de conexión van en variables de entorno (R2_*);
 * si faltan, el sitio funciona igual pero el panel no permite subir fotos.
 */
@ApplicationScoped
public class AlmacenFotos {

    @ConfigProperty(name = "sierrasur.r2.cuenta")
    Optional<String> cuenta;

    @ConfigProperty(name = "sierrasur.r2.llave-acceso")
    Optional<String> llaveAcceso;

    @ConfigProperty(name = "sierrasur.r2.llave-secreta")
    Optional<String> llaveSecreta;

    @ConfigProperty(name = "sierrasur.r2.bucket")
    Optional<String> bucket;

    /** Dirección pública del bucket, p. ej. https://fotos.sierrasurenlinea.com.mx (sin "/" final). */
    @ConfigProperty(name = "sierrasur.r2.url-publica")
    Optional<String> urlPublica;

    public boolean configurado() {
        return cuenta.isPresent() && llaveAcceso.isPresent() && llaveSecreta.isPresent()
                && bucket.isPresent() && urlPublica.isPresent();
    }

    public String urlPublica() {
        return urlPublica.map(u -> u.replaceAll("/+$", "")).orElse("");
    }

    /** URL pública con la que se verá la foto. */
    public String urlDe(String clave) {
        return urlPublica() + "/" + clave;
    }

    /** URL para subir con PUT; exige ese tipo y ese tamaño exactos. */
    public String urlParaSubir(String clave, String tipo, long bytes, long segundos) {
        return FirmaS3.prefirmar("PUT",
                cuenta.orElseThrow() + ".r2.cloudflarestorage.com",
                "/" + bucket.orElseThrow() + "/" + clave,
                "auto",
                Map.of("content-type", tipo, "content-length", String.valueOf(bytes)),
                segundos,
                llaveAcceso.orElseThrow(), llaveSecreta.orElseThrow(), Instant.now());
    }
}
