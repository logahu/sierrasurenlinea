package mx.turamohoy.fotos;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FirmaS3Test {

    private static final String LLAVE = "AKIAIOSFODNN7EXAMPLE";
    private static final String SECRETA = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

    /** Ejemplo publicado por AWS para URLs prefirmadas (GET de test.txt). */
    @Test
    void coincideConElEjemploDeAws() {
        String url = FirmaS3.prefirmar("GET", "examplebucket.s3.amazonaws.com", "/test.txt", "us-east-1",
                Map.of(), 86400, LLAVE, SECRETA, Instant.parse("2013-05-24T00:00:00Z"));
        assertTrue(url.endsWith("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"), url);
    }

    /** Mismo resultado que botocore (SDK oficial de Python) para un PUT a R2 con tipo y tamaño firmados. */
    @Test
    void coincideConElSdkParaUnPutEnR2() {
        String url = FirmaS3.prefirmar("PUT", "cuenta123.r2.cloudflarestorage.com",
                "/fotos/negocios/turamohoy/abc.webp", "auto",
                Map.of("content-type", "image/webp", "content-length", "12345"), 600,
                LLAVE, SECRETA, Instant.parse("2026-11-06T16:29:10Z"));
        assertEquals("https://cuenta123.r2.cloudflarestorage.com/fotos/negocios/turamohoy/abc.webp"
                + "?X-Amz-Algorithm=AWS4-HMAC-SHA256"
                + "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20261106%2Fauto%2Fs3%2Faws4_request"
                + "&X-Amz-Date=20261106T162910Z&X-Amz-Expires=600"
                + "&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost"
                + "&X-Amz-Signature=453fb96280274f48d6005174a00487b708eb2b907e363ce15cce194aad6eb7ba", url);
    }

    @Test
    void codificaComoAws() {
        assertEquals("a%20b%2Fc~", FirmaS3.codificar("a b/c~", true));
        assertEquals("/n/ni%C3%B1o.webp", FirmaS3.codificar("/n/niño.webp", false));
    }
}
