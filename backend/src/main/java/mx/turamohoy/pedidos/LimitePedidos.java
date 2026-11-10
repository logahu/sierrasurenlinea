package mx.turamohoy.pedidos;

import jakarta.enterprise.context.ApplicationScoped;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Freno contra abusos: pocos pedidos por dirección IP en un rato (en memoria). */
@ApplicationScoped
public class LimitePedidos {

    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "sierrasur.pedidos.limite", defaultValue = "6")
    int maximo = 6;
    static final Duration VENTANA = Duration.ofMinutes(10);

    private final Map<String, Deque<Instant>> recientes = new ConcurrentHashMap<>();

    public boolean permitir(String ip) {
        Instant ahora = Instant.now();
        Deque<Instant> lista = recientes.computeIfAbsent(ip == null ? "?" : ip, k -> new ArrayDeque<>());
        synchronized (lista) {
            while (!lista.isEmpty() && lista.peekFirst().isBefore(ahora.minus(VENTANA))) {
                lista.pollFirst();
            }
            if (lista.size() >= maximo) {
                return false;
            }
            lista.addLast(ahora);
        }
        if (recientes.size() > 10_000) {
            recientes.clear();
        }
        return true;
    }
}
