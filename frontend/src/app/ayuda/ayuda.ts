import { Negocio } from '../catalogo/catalogo.model';
import { modoDe } from '../catalogo/carrito';

/** Una pregunta frecuente. La respuesta admite enlaces internos con [texto](/ruta). */
export interface Pregunta {
  pregunta: string;
  respuesta: string;
}

/** Guía para pedir en un negocio: pasos y consejos. */
export interface Guia {
  slug: string;
  nombre: string;
  color: string;
  resumen: string;
  pasos: { titulo: string; detalle: string }[];
  consejos: string[];
}

export const PREGUNTAS: { tema: string; preguntas: Pregunta[] }[] = [
  {
    tema: 'Cuenta y pedidos',
    preguntas: [
      {
        pregunta: '¿Necesito una cuenta para hacer un pedido?',
        respuesta:
          'Sí. Para realizar un pedido es necesario [crear una cuenta](/cuenta/registro) con tu número de celular y una contraseña. Así cada pedido llega con datos verificados, el negocio te atiende con mayor confianza y en tus próximas visitas tus datos ya están listos. Puedes ver el catálogo sin cuenta.',
      },
      {
        pregunta: '¿Tiene algún costo usar Sierra Sur en Línea?',
        respuesta:
          'No. Crear tu cuenta y hacer pedidos es gratuito. Solo pagas los productos o servicios que pidas, directamente al negocio.',
      },
      {
        pregunta: '¿Cómo hago un pedido?',
        respuesta:
          'Entra al negocio, agrega lo que quieras a tu pedido (con el botón + o desde la página del producto) y toca "Ver mi pedido". Indica la entrega y para cuándo, y toca "Enviar". Se abre WhatsApp con tu pedido ya escrito: solo envía el mensaje. Más abajo encontrarás la guía paso a paso de cada negocio.',
      },
      {
        pregunta: '¿Qué es el folio?',
        respuesta:
          'Es el número de tu pedido (por ejemplo, TUR-00015). Va incluido en el mensaje de WhatsApp y te sirve para cualquier aclaración con el negocio.',
      },
      {
        pregunta: '¿Cómo sé en qué va mi pedido?',
        respuesta:
          'En [Mi cuenta](/cuenta) ves todos tus pedidos con su estado: Recibido, En preparación, En camino (o Listo para recoger) y Entregado. El negocio también te escribe por WhatsApp.',
      },
      {
        pregunta: '¿Puedo cambiar o cancelar un pedido?',
        respuesta:
          'Sí, mientras el negocio no lo haya entregado. Escríbele por WhatsApp indicando tu folio y lo que necesitas cambiar.',
      },
      {
        pregunta: 'Olvidé mi contraseña, ¿qué hago?',
        respuesta:
          'Escríbenos por WhatsApp desde el número con el que te registraste y te ayudamos a recuperar tu acceso. Si recuerdas tu contraseña actual, puedes cambiarla en [Mi cuenta](/cuenta).',
      },
    ],
  },
  {
    tema: 'Pagos y entregas',
    preguntas: [
      {
        pregunta: '¿Cómo pago mi pedido?',
        respuesta:
          'El pago se acuerda directamente con cada negocio por WhatsApp (efectivo al recibir, transferencia u otra forma que el negocio acepte). Sierra Sur en Línea no cobra en línea ni pide datos de tarjetas.',
      },
      {
        pregunta: '¿Cuánto cuesta el envío?',
        respuesta:
          'Depende del negocio y de tu zona. El total que ves en tu pedido es aproximado; el negocio te confirma el costo de envío antes de salir. En Encarguitos la tarifa de cada zona se muestra en su página.',
      },
      {
        pregunta: '¿A qué lugares entregan?',
        respuesta:
          'A Miahuatlán de Porfirio Díaz y sus alrededores. Si vives fuera del centro, indícalo en la dirección y el negocio te confirma si llega y el costo.',
      },
      {
        pregunta: '¿Puedo recoger mi pedido en el negocio?',
        respuesta:
          'Sí, en los negocios que lo permiten elige "Paso a recogerlo" al confirmar tu pedido. Te avisamos cuando esté listo.',
      },
    ],
  },
  {
    tema: 'Uso del sitio',
    preguntas: [
      {
        pregunta: 'Toqué "Enviar" pero no se abrió WhatsApp.',
        respuesta:
          'Revisa que tu navegador permita abrir ventanas nuevas para este sitio. Tu pedido ya quedó registrado: puedes verlo en [Mi cuenta](/cuenta) y escribirle al negocio con tu folio. Si usas computadora sin WhatsApp, se abre WhatsApp Web.',
      },
      {
        pregunta: 'La página tarda en cargar la primera vez.',
        respuesta:
          'Cuando el sitio lleva un rato sin visitas, el servidor tarda hasta un minuto en "despertar". Después de eso todo carga rápido. Si ves un error, toca "Reintentar".',
      },
      {
        pregunta: '¿Puedo tener Sierra Sur en Línea como app en mi celular?',
        respuesta:
          'Sí. En Android toca "📲 Instalar la app" al pie de la página o, en el menú del navegador, "Instalar app". En iPhone, abre el sitio en Safari, toca Compartir y luego "Agregar a pantalla de inicio".',
      },
      {
        pregunta: '¿Mis datos están seguros?',
        respuesta:
          'Solo usamos tus datos para atender tus pedidos y los compartimos únicamente con el negocio y el repartidor que los entregan. Tu contraseña se guarda cifrada. Consulta el [Aviso de privacidad](/privacidad).',
      },
    ],
  },
];

/** Pasos comunes al confirmar y enviar un pedido con carrito. */
const ENVIAR = {
  titulo: 'Inicia sesión y envía',
  detalle:
    'Toca "Enviar". Tu pedido se registra con un folio y se abre WhatsApp con todo ya escrito: solo envía el mensaje. El negocio te confirma por ahí.',
};

/** Consejos propios de algunos negocios (por su dirección en el sitio). */
const CONSEJOS: Record<string, string[]> = {
  turamohoy: [
    'Escribe en "Notas" el mensaje para la tarjeta y, si quieres, el color o tipo de flor que prefieres.',
    'Para fechas especiales (14 de febrero, 10 de mayo, Día de Muertos) pide con uno o dos días de anticipación.',
  ],
  belleza: ['Si buscas un tono o presentación específica, escríbelo en "Notas" y el negocio te confirma disponibilidad.'],
  vinateria: [
    'Venta exclusiva para mayores de 18 años: al confirmar te pedimos que lo declares y al entregar se solicita identificación.',
    'Si necesitas hielo o botanas para un evento, agrégalos al mismo pedido.',
  ],
  inflables: [
    'Reserva con anticipación, sobre todo en fines de semana y temporada de fiestas.',
    'En "Notas" indica el tipo de piso (pasto, cemento, tierra) y si hay contacto de luz cerca.',
  ],
  'estudio-melgarejo': [
    'Cada paquete dura una hora. Atendemos de lunes a sábado de 10:00 a 19:00; los domingos está cerrado.',
    'Si buscas un corte o peinado en particular, escríbelo en "Notas" o trae una foto de referencia.',
  ],
  autos: [
    'Revisa las fotos y características de cada vehículo antes de agendar.',
    'Puedes agregar varios vehículos a la misma visita para verlos el mismo día.',
  ],
};

/** Arma la guía de un negocio según cómo se pide en él. */
export function guiaDe(
  n: Pick<Negocio, 'slug' | 'nombre' | 'tipo' | 'modoPedido' | 'colorPrimario' | 'soloMayoresEdad' | 'agendaActiva'>,
): Guia {
  const base = { slug: n.slug, nombre: n.nombre, color: n.colorPrimario, consejos: CONSEJOS[n.slug] ?? [] };
  if (n.tipo === 'SERVICIO') {
    return {
      ...base,
      resumen: 'Mandados en moto: te compramos, llevamos, recogemos o pagamos lo que necesites.',
      pasos: [
        { titulo: 'Elige qué necesitas', detalle: 'Súper o mercado, llevar o recoger algo, pagos y trámites, otro encargo y, si están disponibles, comida a domicilio o viaje en moto.' },
        { titulo: 'Escribe tu lista', detalle: 'Detalla qué necesitas que hagamos: productos, cantidades, marcas o indicaciones. En comida a domicilio, elige el lugar y los platillos.' },
        { titulo: 'Dinos dónde y cuándo', detalle: 'Indica dónde entregamos (puedes compartir tu ubicación), tu zona para calcular la tarifa y si lo quieres ya o a una hora.' },
        { titulo: 'Elige cómo se paga la compra', detalle: 'Si hay que comprar algo, indica si el repartidor lo adelanta (hasta el tope que marca la página) o si le das el dinero antes.' },
        ENVIAR,
      ],
      consejos: [
        'La tarifa de cada zona aparece en la página de Encarguitos; el total de la compra se paga aparte al recibir.',
        'Tus datos y tu dirección habitual se llenan solos si iniciaste sesión.',
        ...base.consejos,
      ],
    };
  }
  const modo = modoDe(n);
  if (modo === 'RENTA') {
    return {
      ...base,
      resumen: 'Renta para tu evento: elige los artículos y reserva tu fecha.',
      pasos: [
        { titulo: 'Explora el catálogo', detalle: 'Usa las categorías para encontrar lo que buscas y abre cada artículo para ver medidas, capacidad y precio.' },
        { titulo: 'Agrega a tu reservación', detalle: 'Toca + en el catálogo o "Agregar a la reservación" en el artículo. Puedes combinar varios.' },
        { titulo: 'Revisa tu reservación', detalle: 'Toca "Ver mi reservación" en la barra inferior para ajustar cantidades.' },
        { titulo: 'Indica los datos del evento', detalle: 'Fecha y dirección del evento son obligatorias; agrega el horario y notas si lo deseas.' },
        ENVIAR,
      ],
      consejos: ['El negocio te confirma disponibilidad para tu fecha, el anticipo y la hora de instalación.', ...base.consejos],
    };
  }
  if (modo === 'CITA' && n.agendaActiva) {
    return {
      ...base,
      resumen: 'Servicios por paquete con agenda en línea: eliges con quién, el día y la hora, y tu lugar queda apartado.',
      pasos: [
        { titulo: 'Elige tus paquetes', detalle: 'Abre cada paquete para ver qué incluye y su precio. Toca "Agregar a mi cita"; puedes juntar varios.' },
        { titulo: 'Elige con quién', detalle: 'Toca "Quien esté disponible" o la persona que prefieras.' },
        { titulo: 'Elige día y hora', detalle: 'Solo aparecen los horarios libres, hasta 30 días adelante. Si elegiste varios paquetes, se atienden seguidos con la misma persona.' },
        { titulo: 'Inicia sesión y aparta', detalle: 'Toca "Apartar mi cita". Tu horario queda apartado al momento, recibes un folio y se abre WhatsApp con tu cita ya escrita: solo envía el mensaje.' },
      ],
      consejos: [
        'Si no puedes llegar, avísanos por WhatsApp para liberar tu lugar.',
        'Si alguien aparta ese mismo horario un instante antes, te avisamos para que elijas otro.',
        'Consulta tus citas en Mi historial, en tu cuenta.',
        ...base.consejos,
      ],
    };
  }
  if (modo === 'CITA') {
    return {
      ...base,
      resumen: 'Vehículos con fotos, características y precio. Agenda una visita para verlos en persona.',
      pasos: [
        { titulo: 'Revisa los vehículos', detalle: 'Filtra por tipo y abre cada uno para ver fotos, kilometraje, reparaciones y precio.' },
        { titulo: 'Agenda tu visita', detalle: 'En el vehículo que te interesa toca "Agendar visita".' },
        { titulo: 'Elige el día', detalle: 'Indica el día que quieres venir y, si quieres, un horario aproximado.' },
        ENVIAR,
      ],
      consejos: ['Te confirmamos por WhatsApp la hora para que lo veas en persona y hagas prueba de manejo.', ...base.consejos],
    };
  }
  return {
    ...base,
    resumen: 'Elige tus productos y recíbelos a domicilio o pasa a recogerlos.',
    pasos: [
      { titulo: 'Explora el catálogo', detalle: 'Usa las categorías para encontrar lo que buscas y abre cada producto para ver fotos, detalles y precio.' },
      { titulo: 'Agrega a tu pedido', detalle: 'Toca + en el catálogo o elige la cantidad y "Agregar al pedido" en el producto.' },
      { titulo: 'Revisa tu pedido', detalle: 'Toca "Ver mi pedido" en la barra inferior para ajustar cantidades o quitar productos.' },
      { titulo: 'Elige la entrega', detalle: 'A domicilio (con tu dirección) o "Paso a recogerlo"; lo antes posible o en un día y hora. Agrega notas si lo necesitas.' },
      ENVIAR,
    ],
    consejos: [
      'El total es aproximado: el negocio te confirma disponibilidad, costo de envío y forma de pago.',
      ...base.consejos,
    ],
  };
}

/** Separa una respuesta en texto y enlaces internos ([texto](/ruta)). */
export function partesDe(texto: string): { texto: string; ruta?: string }[] {
  const partes: { texto: string; ruta?: string }[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let ultimo = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index) });
    partes.push({ texto: m[1], ruta: m[2] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo) });
  return partes;
}
