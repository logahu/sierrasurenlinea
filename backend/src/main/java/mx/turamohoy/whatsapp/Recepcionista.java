package mx.turamohoy.whatsapp;

import java.util.Optional;

/**
 * Quien decide qué contestar a un mensaje. En la fase 2 es {@link RecepcionistaEco} (repite el
 * mensaje, para probar el circuito); en la fase 3 será el agente de IA con las herramientas de la agenda.
 */
public interface Recepcionista {

    /**
     * @param conversacion la conversación (con su negocio)
     * @param mensaje      el mensaje del cliente que hay que contestar
     * @return el texto de la respuesta, o vacío para no contestar
     */
    Optional<String> responder(WaConversacion conversacion, WaMensaje mensaje);
}
