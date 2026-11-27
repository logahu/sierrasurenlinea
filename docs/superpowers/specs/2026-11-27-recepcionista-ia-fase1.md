# Recepcionista IA por WhatsApp — Fase 1: agenda lista para el bot

**Fecha:** 2026-11-27 · **Estado:** en implementación (rama `feature/recepcionista-fase1`)

## Contexto

Queremos una "recepcionista IA" que conteste el WhatsApp de un negocio con agenda (primer caso: un
dentista; piloto con Estudio Melgarejo) y aparte citas de noche. Se decidió **no usar Google Calendar**:
la fuente de verdad es la agenda propia del sitio (la de Estudio Melgarejo), que ya tiene horario por
negocio, varios profesionales, bloqueos y una llave única (`uk_cita_bloque`) que impide apartar dos
veces la misma hora.

Fases del proyecto completo:

| Fase | Qué entrega |
|---|---|
| 0 | Alta en Meta (WhatsApp Cloud API, número de prueba, token permanente), hosting 24/7, API key, aviso de privacidad |
| **1** | **Agenda lista para el bot (este documento)** |
| 2 | Webhook de WhatsApp en Quarkus (verificación, firma, idempotencia, negocio por `phone_number_id`), bot "eco" |
| 3 | Agente IA solo texto (`quarkus-langchain4j-anthropic`, `@Tool` sobre `CitasRecepcion`, memoria por teléfono, pase a humano) |
| 4 | Plantillas aprobadas, recordatorio 24 h antes, resumen diario al encargado |
| 5 | Notas de voz (descarga de media + transcripción) |
| 6 | Piloto y precio |

## Decisiones de la fase 1

1. **Duración por servicio en bloques.** El negocio sigue definiendo el bloque base (`negocio.minutos_cita`)
   y cada servicio dice cuántos bloques ocupa (`producto.bloques_cita`, 1–8, por defecto 1). Una cita
   con varios servicios ocupa la suma (máximo 8). Melgarejo no cambia: todo sigue en 1.
2. **Clientes de WhatsApp sin contraseña.** El bot registra al cliente con teléfono y nombre
   (`cliente.origen = 'WHATSAPP'`, `contrasena_hash` vacío) y guarda la aceptación del aviso de
   privacidad que dio en el chat. Sin aceptación no se aparta (HTTP 428). Si después usa «Crear cuenta»
   en el sitio con el mismo teléfono, completa esa cuenta y conserva su historial.
3. **La cita del bot es un pedido como los demás**, con `pedido.origen = 'WHATSAPP'`: aparece en la agenda
   del panel, se reprograma o cancela igual y avisa al encargado y a quien atiende.

## Cambios

- `V35__recepcionista_agenda.sql`: `producto.bloques_cita`, `cliente.contrasena_hash` nullable,
  `cliente.origen`, `pedido.origen`.
- `Agenda.bloquesDe(lineas)` y `MAX_BLOQUES`; `PedidoResource` aparta la suma de bloques.
- `recepcion/CitasRecepcion` (sin HTTP, futuras herramientas del agente): `servicios`, `profesionales`,
  `disponibilidad`, `reservar`, `proximas`, `cancelar`. Los errores traen un mensaje listo para el cliente.
- Registro web: un cliente sin contraseña (de WhatsApp) puede crearla con «Crear cuenta».
- DTOs: `bloquesCita` en producto (público y panel) y `minutosCita` en el negocio del panel.
- Frontend: el carrito guarda los bloques de cada servicio y pide horarios con la suma;
  el formulario de producto muestra «Duración de la cita» en negocios con agenda.

## Riesgos y pendientes

- **Reclamar una cuenta por teléfono:** igual que hoy en el registro, no hay verificación del número; con
  clientes de WhatsApp eso permite que alguien que escriba ese teléfono vea su historial. En la fase 2
  conviene verificar con un código por WhatsApp antes de completar la cuenta.
- Datos de salud (dentista): mantener las notas al mínimo y actualizar el aviso de privacidad en la fase 0.
