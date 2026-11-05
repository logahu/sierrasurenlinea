package mx.turamohoy.admin;

/** Constantes del token de sesión (ver application.properties, sección Panel). */
final class Jwts {
    /** Debe coincidir con mp.jwt.verify.issuer. */
    static final String EMISOR = "sierrasurenlinea";

    private Jwts() {
    }
}
