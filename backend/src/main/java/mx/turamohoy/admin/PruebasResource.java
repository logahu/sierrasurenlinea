package mx.turamohoy.admin;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.clientes.Cliente;
import mx.turamohoy.clientes.ClienteResource;
import mx.turamohoy.historial.Bitacora;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Cuentas para probar el sitio antes de abrirlo: 10 clientes probadores, un encargado
 * por cada negocio que no tenga uno y 8 repartidores generales. Todas llevan
 * «🧪 PRUEBA» en el nombre y teléfonos 555000xxxx, que no son de nadie.
 *
 * <p>Las contraseñas se generan al azar y solo se devuelven en la respuesta: no se pueden
 * volver a consultar. Si se pierden, se vuelve a pulsar el botón y las cuentas de prueba
 * existentes reciben una contraseña nueva (y se reactivan).
 */
@Path("/api/admin/pruebas")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed(Rol.DUENO)
public class PruebasResource {

    static final String PREFIJO = "🧪 PRUEBA ";
    static final int CLIENTES = 10;
    static final int REPARTIDORES = 8;

    private static final SecureRandom AZAR = new SecureRandom();
    /** Sin letras ni números que se confundan (0/O, 1/l/I). */
    private static final String LETRAS = "abcdefghjkmnpqrstuvwxyz23456789";

    @Inject
    SesionActual sesion;

    /** Una fila de la tabla que ve el administrador. {@code contrasena} es nula si no se tocó la cuenta. */
    public record CuentaDePrueba(String tipo, String nombre, String telefono, String contrasena, String negocio,
                                 String estado) {
    }

    public record Baja(long usuarios, long clientes) {
    }

    @POST
    @Path("/usuarios")
    @Transactional
    public List<CuentaDePrueba> crear() {
        Usuario quien = sesion.usuario();
        List<CuentaDePrueba> filas = new ArrayList<>();

        for (int i = 1; i <= CLIENTES; i++) {
            filas.add(cliente(String.format("%02d", i), "555" + String.format("%07d", i)));
        }

        List<Negocio> negocios = Negocio.list("order by id");
        for (int i = 0; i < negocios.size(); i++) {
            Negocio n = negocios.get(i);
            filas.add(encargado(n, "5550002" + String.format("%03d", n.id % 1000)));
        }

        for (int i = 1; i <= REPARTIDORES; i++) {
            filas.add(repartidor(String.format("%02d", i), "555" + String.format("%07d", 100 + i)));
        }
        long tocadas = filas.stream().filter(f -> f.contrasena() != null).count();
        Bitacora.anotar(quien, null, Bitacora.USUARIO, null, "Creó o renovó " + tocadas + " usuarios de prueba", null);
        return filas;
    }

    /** Quita el acceso a todas las cuentas de prueba (baja lógica: sus pedidos se conservan). */
    @POST
    @Path("/baja")
    @Transactional
    public Baja baja() {
        long usuarios = Usuario.update("activo = false where dePrueba = true and activo = true");
        long clientes = Cliente.update("activo = false where dePrueba = true and activo = true");
        Bitacora.anotar(sesion.usuario(), null, Bitacora.USUARIO, null,
                "Quitó el acceso a los usuarios de prueba", usuarios + " del equipo y " + clientes + " clientes");
        return new Baja(usuarios, clientes);
    }

    private CuentaDePrueba cliente(String numero, String telefono) {
        String nombre = PREFIJO + "Cliente " + numero;
        Optional<Cliente> existente = Cliente.porTelefono(telefono);
        if (existente.isPresent() && !existente.get().dePrueba) {
            return new CuentaDePrueba("Cliente", existente.get().nombre, telefono, null, null,
                    "Omitido: ese teléfono es de una cuenta real");
        }
        String contrasena = contrasenaNueva();
        Cliente c = existente.orElseGet(Cliente::new);
        boolean nueva = c.id == null;
        c.nombre = nombre;
        c.telefono = telefono;
        c.probador = true;
        c.dePrueba = true;
        c.activo = true;
        c.intentosFallidos = 0;
        c.bloqueadoHasta = null;
        c.contrasenaHash = Contrasenas.cifrar(contrasena);
        if (nueva) {
            c.privacidadAceptada = Instant.now();
            c.privacidadVersion = ClienteResource.VERSION_PRIVACIDAD;
            c.creado = Instant.now();
            c.persist();
        }
        return new CuentaDePrueba("Cliente", nombre, telefono, contrasena, null, nueva ? "Creado" : "Contraseña nueva");
    }

    private CuentaDePrueba encargado(Negocio negocio, String telefono) {
        String nombre = recortar(PREFIJO + "Encargado " + negocio.nombre);
        Optional<Usuario> actual = Usuario.encargadoDe(negocio);
        if (actual.isPresent() && !actual.get().dePrueba) {
            return new CuentaDePrueba("Encargado", actual.get().nombre, actual.get().telefono, null, negocio.nombre,
                    "Omitido: ya tiene encargado");
        }
        Optional<Usuario> deEsteNegocio = actual.isPresent() ? actual
                : Usuario.find("dePrueba = true and rol = ?1 and negocio = ?2", Rol.ENCARGADO, negocio)
                        .firstResultOptional();
        return equipo(deEsteNegocio, Rol.ENCARGADO, "Encargado", nombre, telefono, negocio);
    }

    private CuentaDePrueba repartidor(String numero, String telefono) {
        return equipo(Usuario.porTelefono(telefono), Rol.REPARTIDOR, "Repartidor",
                PREFIJO + "Repartidor " + numero, telefono, null);
    }

    private CuentaDePrueba equipo(Optional<Usuario> existente, String rol, String tipo, String nombre,
                                  String telefono, Negocio negocio) {
        String nombreNegocio = negocio == null ? null : negocio.nombre;
        Usuario u = existente.orElse(null);
        if (u == null) {
            Optional<Usuario> conEseTelefono = Usuario.porTelefono(telefono);
            if (conEseTelefono.isPresent()) {
                if (!conEseTelefono.get().dePrueba || !rol.equals(conEseTelefono.get().rol)) {
                    return new CuentaDePrueba(tipo, conEseTelefono.get().nombre, telefono, null, nombreNegocio,
                            "Omitido: ese teléfono es de una cuenta real");
                }
                u = conEseTelefono.get();
            }
        } else if (!u.dePrueba) {
            return new CuentaDePrueba(tipo, u.nombre, u.telefono, null, nombreNegocio, "Omitido: cuenta real");
        }
        String contrasena = contrasenaNueva();
        boolean nueva = u == null;
        if (nueva) {
            u = new Usuario();
            u.telefono = telefono;
        }
        u.nombre = nombre;
        u.rol = rol;
        u.negocio = negocio;
        u.dePrueba = true;
        u.activo = true;
        u.intentosFallidos = 0;
        u.bloqueadoHasta = null;
        u.contrasenaHash = Contrasenas.cifrar(contrasena);
        if (nueva) {
            u.persist();
        }
        return new CuentaDePrueba(tipo, nombre, u.telefono, contrasena, nombreNegocio,
                nueva ? "Creado" : "Contraseña nueva");
    }

    private static String recortar(String nombre) {
        return nombre.length() <= 80 ? nombre : nombre.substring(0, 80);
    }

    /** 12 letras en tres grupos («abcd-efgh-jkmn»): fácil de dictar por teléfono. */
    static String contrasenaNueva() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 12; i++) {
            if (i > 0 && i % 4 == 0) {
                sb.append('-');
            }
            sb.append(LETRAS.charAt(AZAR.nextInt(LETRAS.length())));
        }
        return sb.toString();
    }
}
