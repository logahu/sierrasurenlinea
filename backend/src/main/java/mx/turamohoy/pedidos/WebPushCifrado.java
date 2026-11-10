package mx.turamohoy.pedidos;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Web Push sin dependencias: cifrado del mensaje (RFC 8291, "aes128gcm" de RFC 8188) y
 * firma VAPID (RFC 8292, ES256). Solo usa la criptografía del JDK.
 */
public final class WebPushCifrado {

    private static final SecureRandom AZAR = new SecureRandom();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder D64 = Base64.getUrlDecoder();
    static final ECParameterSpec P256 = parametrosP256();

    private WebPushCifrado() {
    }

    /** Par de llaves P-256 nuevo (para VAPID o para el cifrado de cada mensaje). */
    public static KeyPair nuevoPar() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"), AZAR);
            return g.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Cifra el contenido para una suscripción del navegador.
     *
     * @param p256dh llave pública del navegador (base64url, 65 bytes sin comprimir)
     * @param auth   secreto de autenticación del navegador (base64url, 16 bytes)
     * @return cuerpo listo para enviar con {@code Content-Encoding: aes128gcm}
     */
    public static byte[] cifrar(byte[] contenido, String p256dh, String auth) {
        return cifrar(contenido, D64.decode(p256dh), D64.decode(auth), nuevoPar(), sal());
    }

    static byte[] sal() {
        byte[] s = new byte[16];
        AZAR.nextBytes(s);
        return s;
    }

    static byte[] cifrar(byte[] contenido, byte[] uaPublica, byte[] authSecreto, KeyPair servidor, byte[] sal) {
        try {
            byte[] asPublica = crudo((ECPublicKey) servidor.getPublic());
            KeyAgreement ka = KeyAgreement.getInstance("ECDH");
            ka.init(servidor.getPrivate());
            ka.doPhase(publica(uaPublica), true);
            byte[] compartido = ka.generateSecret();

            byte[] prkLlave = hmac(authSecreto, compartido);
            byte[] info = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublica, asPublica);
            byte[] ikm = Arrays.copyOf(hmac(prkLlave, concat(info, new byte[] {1})), 32);

            byte[] prk = hmac(sal, ikm);
            byte[] cek = Arrays.copyOf(hmac(prk, concat("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 16);
            byte[] nonce = Arrays.copyOf(hmac(prk, concat("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 12);

            Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
            aes.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            byte[] cifrado = aes.doFinal(concat(contenido, new byte[] {2})); // 2 = último registro

            return ByteBuffer.allocate(16 + 4 + 1 + asPublica.length + cifrado.length)
                    .put(sal).putInt(4096).put((byte) asPublica.length).put(asPublica).put(cifrado)
                    .array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se pudo cifrar la notificación", e);
        }
    }

    /** Encabezado Authorization de VAPID: {@code vapid t=<jwt>, k=<llave pública>}. */
    public static String autorizacionVapid(String endpoint, KeyPair vapid, String contacto, long expiraEpochSeg) {
        try {
            java.net.URI uri = java.net.URI.create(endpoint);
            String audiencia = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
            String cabecera = B64.encodeToString("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
            String cuerpo = B64.encodeToString(("{\"aud\":\"" + audiencia + "\",\"exp\":" + expiraEpochSeg
                    + ",\"sub\":\"" + contacto + "\"}").getBytes(StandardCharsets.UTF_8));
            String aFirmar = cabecera + "." + cuerpo;
            Signature es = Signature.getInstance("SHA256withECDSA");
            es.initSign(vapid.getPrivate());
            es.update(aFirmar.getBytes(StandardCharsets.US_ASCII));
            String jwt = aFirmar + "." + B64.encodeToString(derACrudo(es.sign()));
            return "vapid t=" + jwt + ", k=" + B64.encodeToString(crudo((ECPublicKey) vapid.getPublic()));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------------ llaves

    /** Llave pública en formato sin comprimir: 0x04 || X(32) || Y(32). */
    public static byte[] crudo(ECPublicKey k) {
        byte[] x = fijo(k.getW().getAffineX().toByteArray());
        byte[] y = fijo(k.getW().getAffineY().toByteArray());
        return concat(new byte[] {4}, x, y);
    }

    public static ECPublicKey publica(byte[] crudo) throws GeneralSecurityException {
        if (crudo.length != 65 || crudo[0] != 4) {
            throw new GeneralSecurityException("Llave pública no válida");
        }
        ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(crudo, 1, 33)),
                new BigInteger(1, Arrays.copyOfRange(crudo, 33, 65)));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, P256));
    }

    /** Guarda el par como texto: base64url(d) "." base64url(pública cruda). */
    public static String aTexto(KeyPair par) {
        byte[] d = fijo(((ECPrivateKey) par.getPrivate()).getS().toByteArray());
        return B64.encodeToString(d) + "." + B64.encodeToString(crudo((ECPublicKey) par.getPublic()));
    }

    public static KeyPair deTexto(String texto) {
        try {
            String[] partes = texto.split("\\.");
            ECPrivateKey priv = (ECPrivateKey) KeyFactory.getInstance("EC")
                    .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, D64.decode(partes[0])), P256));
            return new KeyPair(publica(D64.decode(partes[1])), priv);
        } catch (GeneralSecurityException | RuntimeException e) {
            throw new IllegalStateException("Llaves VAPID guardadas no válidas", e);
        }
    }

    public static String base64url(byte[] b) {
        return B64.encodeToString(b);
    }

    // ------------------------------------------------------------------ apoyo

    private static ECParameterSpec parametrosP256() {
        return ((ECPublicKey) nuevoPar().getPublic()).getParams();
    }

    /** Entero a 32 bytes exactos (quita el byte de signo o rellena con ceros). */
    private static byte[] fijo(byte[] b) {
        if (b.length == 32) {
            return b;
        }
        byte[] r = new byte[32];
        if (b.length > 32) {
            System.arraycopy(b, b.length - 32, r, 0, 32);
        } else {
            System.arraycopy(b, 0, r, 32 - b.length, b.length);
        }
        return r;
    }

    /** Firma ECDSA en DER (lo que da el JDK) a R||S de 64 bytes (lo que pide JWT). */
    static byte[] derACrudo(byte[] der) {
        int i = 2;
        if ((der[1] & 0x80) != 0) {
            i += der[1] & 0x7f;
        }
        int lr = der[i + 1];
        byte[] r = Arrays.copyOfRange(der, i + 2, i + 2 + lr);
        i = i + 2 + lr;
        int ls = der[i + 1];
        byte[] s = Arrays.copyOfRange(der, i + 2, i + 2 + ls);
        return concat(fijo(r), fijo(s));
    }

    private static byte[] hmac(byte[] llave, byte[] datos) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(llave, "HmacSHA256"));
        return mac.doFinal(datos);
    }

    private static byte[] concat(byte[]... partes) {
        int n = 0;
        for (byte[] p : partes) {
            n += p.length;
        }
        ByteBuffer b = ByteBuffer.allocate(n);
        for (byte[] p : partes) {
            b.put(p);
        }
        return b.array();
    }
}
