package mx.turamohoy.whatsapp;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

/** Fase 2: contesta repitiendo el mensaje, para probar el circuito completo con Meta. */
@ApplicationScoped
@DefaultBean
public class RecepcionistaEco implements Recepcionista {

    @Override
    public Optional<String> responder(WaConversacion c, WaMensaje m) {
        String saludo = c.nombrePerfil == null || c.nombrePerfil.isBlank() ? "Hola" : "Hola, " + c.nombrePerfil;
        String recibido = m.texto == null || m.texto.isBlank() ? "un mensaje de tipo " + m.tipo : "«" + m.texto + "»";
        return Optional.of(saludo + " 👋 Soy la recepcionista de " + c.negocio.nombre
                + " (en pruebas). Recibí " + recibido + ".");
    }
}
