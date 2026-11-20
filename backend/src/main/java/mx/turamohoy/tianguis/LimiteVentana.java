package mx.turamohoy.tianguis;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Freno en memoria: como mucho {@code maximo} intentos por llave en la ventana (por IP, por anuncio…). */
public class LimiteVentana {

    private final int maximo;
    private final Duration ventana;
    private final Map<String, Deque<Instant>> recientes = new ConcurrentHashMap<>();

    public LimiteVentana(int maximo, Duration ventana) {
        this.maximo = maximo;
        this.ventana = ventana;
    }

    public boolean permitir(String llave) {
        Instant ahora = Instant.now();
        Deque<Instant> lista = recientes.computeIfAbsent(llave == null ? "?" : llave, k -> new ArrayDeque<>());
        synchronized (lista) {
            while (!lista.isEmpty() && lista.peekFirst().isBefore(ahora.minus(ventana))) {
                lista.pollFirst();
            }
            if (lista.size() >= maximo) {
                return false;
            }
            lista.addLast(ahora);
        }
        if (recientes.size() > 20_000) {
            recientes.clear();
        }
        return true;
    }

    /** Para las pruebas. */
    public void olvidar() {
        recientes.clear();
    }
}
