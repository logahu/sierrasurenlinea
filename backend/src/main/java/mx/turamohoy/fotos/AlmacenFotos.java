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

    /** En pruebas no se llama a R2 de verdad. */
    @ConfigProperty(name = "sierrasur.r2.simular", defaultValue = "false")
    boolean simular;

    private final java.net.http.HttpClient http = java.net.http.HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(10)).build();

    /**
     * Elimina el archivo de R2 para liberar espacio. Si ya no existía también cuenta como
     * borrado. Lanza una excepción si R2 no responde bien.
     */
    public void borrar(String clave) {
        if (simular) {
            return;
        }
        String url = FirmaS3.prefirmar("DELETE",
                cuenta.orElseThrow() + ".r2.cloudflarestorage.com",
                "/" + bucket.orElseThrow() + "/" + clave,
                "auto", Map.of(), 300,
                llaveAcceso.orElseThrow(), llaveSecreta.orElseThrow(), Instant.now());
        try {
            var r = http.send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(url))
                            .timeout(java.time.Duration.ofSeconds(20)).DELETE().build(),
                    java.net.http.HttpResponse.BodyHandlers.discarding());
            if (r.statusCode() != 204 && r.statusCode() != 200 && r.statusCode() != 404) {
                throw new IllegalStateException("R2 respondió " + r.statusCode());
            }
        } catch (java.io.IOException e) {
            throw new IllegalStateException("No se pudo conectar con R2", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Se interrumpió el borrado", e);
        }
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
