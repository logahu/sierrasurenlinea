import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Aviso de privacidad integral. Los datos marcados entre corchetes ([NOMBRE],
 * [DOMICILIO], [CORREO]) están pendientes de llenar con los datos del responsable.
 * Si cambias el contenido, sube también VERSION_PRIVACIDAD en ClienteResource (backend)
 * y la fecha de abajo: así queda registro de qué versión aceptó cada cliente.
 */
@Component({
  selector: 'app-privacidad-page',
  imports: [RouterLink],
  styleUrl: './cuenta.scss',
  styles: `
    article { max-width: 46rem; margin: 2rem auto 0; line-height: 1.65; }
    h1 { margin-bottom: .25rem; }
    h2 { margin-top: 1.75rem; }
    p, li { color: var(--tinta); }
    ul { padding-left: 1.3rem; }
    .vigencia { color: var(--tinta-suave); font-size: .9rem; margin: 0 0 1.5rem; }
    mark { background: color-mix(in srgb, var(--cempasuchil) 35%, transparent); color: inherit; padding: 0 .2rem; border-radius: .2rem; }
  `,
  template: `
    <article>
      <h1>Aviso de privacidad</h1>
      <p class="vigencia">Versión 2026-11 · Última actualización: noviembre de 2026</p>

      <h2>1. Responsable de tus datos personales</h2>
      <p>
        <mark>[NOMBRE]</mark>, con domicilio en <mark>[DOMICILIO]</mark> (en adelante, “Sierra Sur en Línea”), es
        responsable del uso y protección de tus datos personales, conforme a la Ley Federal de Protección de Datos
        Personales en Posesión de los Particulares y demás normativa aplicable.
      </p>

      <h2>2. Datos personales que recabamos</h2>
      <p>Al crear tu cuenta y realizar pedidos en sierrasurenlinea.com.mx recabamos:</p>
      <ul>
        <li>Datos de identificación: nombre completo.</li>
        <li>Datos de contacto: número de teléfono celular y, de forma opcional, correo electrónico.</li>
        <li>Datos de entrega: dirección, referencias y, si decides compartirla, tu ubicación.</li>
        <li>Datos de tus pedidos: productos o servicios solicitados, fechas, montos estimados y su estado.</li>
      </ul>
      <p>
        No recabamos datos personales sensibles ni datos financieros. Los pagos se acuerdan directamente con cada
        negocio. Tu contraseña se guarda cifrada y nadie, ni siquiera nuestro personal, puede leerla.
      </p>

      <h2>3. Finalidades del tratamiento</h2>
      <p>Usamos tus datos para las siguientes finalidades, necesarias para darte el servicio:</p>
      <ul>
        <li>Crear y administrar tu cuenta e identificarte al iniciar sesión.</li>
        <li>Recibir, registrar y dar seguimiento a tus pedidos.</li>
        <li>Compartir con el negocio que atiende tu pedido y con la persona repartidora los datos indispensables para preparar y entregar tu pedido.</li>
        <li>Contactarte por teléfono o WhatsApp para confirmar, aclarar o dar seguimiento a tus pedidos.</li>
        <li>Atender tus dudas, quejas y aclaraciones.</li>
      </ul>
      <p>De manera adicional, y solo si no te opones, podremos usar tus datos para:</p>
      <ul>
        <li>Enviarte promociones, novedades y avisos de los negocios de Sierra Sur en Línea.</li>
        <li>Realizar encuestas de satisfacción para mejorar nuestro servicio.</li>
      </ul>
      <p>
        Si no deseas que tus datos se usen para estas finalidades adicionales, escríbenos a <mark>[CORREO]</mark>. Tu
        negativa no será motivo para negarte el servicio.
      </p>

      <h2>4. ¿Con quién compartimos tus datos?</h2>
      <p>
        Tus datos se comparten únicamente con los negocios afiliados a Sierra Sur en Línea que atienden tus pedidos y
        con su personal de reparto, para cumplir con las finalidades necesarias descritas. También los resguardan
        proveedores de tecnología (alojamiento web y base de datos) que actúan por nuestra cuenta y bajo obligaciones
        de confidencialidad. No vendemos ni rentamos tus datos personales a terceros.
      </p>
      <p>
        Cuando eliges enviar tu pedido por WhatsApp, la conversación se rige además por las políticas de privacidad de
        ese servicio.
      </p>

      <h2>5. Derechos ARCO y revocación del consentimiento</h2>
      <p>
        Tienes derecho a conocer qué datos tenemos de ti y para qué los usamos (Acceso); a pedir que los corrijamos si
        están desactualizados o son inexactos (Rectificación); a que los eliminemos de nuestros registros cuando
        consideres que no se usan adecuadamente (Cancelación); y a oponerte a su uso para fines específicos
        (Oposición). También puedes revocar el consentimiento que nos diste.
      </p>
      <p>
        Para ejercer cualquiera de estos derechos, envía tu solicitud a <mark>[CORREO]</mark> con tu nombre, el teléfono
        de tu cuenta, una descripción clara de lo que solicitas y, en su caso, el documento que acredite tu identidad.
        Te responderemos en un plazo máximo de 20 días hábiles. Puedes actualizar tu nombre, correo y dirección en
        cualquier momento desde <a routerLink="/cuenta">Mi cuenta</a>.
      </p>

      <h2>6. Conservación de la información</h2>
      <p>
        Conservamos tus datos mientras tu cuenta esté activa y, después, solo durante el tiempo necesario para cumplir
        obligaciones legales y atender aclaraciones sobre pedidos realizados. El historial de pedidos se mantiene como
        registro de las operaciones.
      </p>

      <h2>7. Uso de almacenamiento en tu navegador</h2>
      <p>
        Guardamos en tu navegador tu sesión para que no tengas que iniciarla en cada visita, y contamos visitas de
        forma anónima. No usamos cookies de publicidad ni herramientas de rastreo de terceros. Al cerrar sesión se
        elimina la información de tu sesión de este dispositivo.
      </p>

      <h2>8. Cambios a este aviso</h2>
      <p>
        Cualquier cambio a este aviso de privacidad se publicará en esta misma página
        (sierrasurenlinea.com.mx/privacidad), indicando la fecha de su última actualización.
      </p>
    </article>
  `,
})
export class PrivacidadPage {}
