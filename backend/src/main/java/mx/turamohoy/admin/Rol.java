package mx.turamohoy.admin;

/** Roles del panel. Son constantes de texto para poder usarlas en {@code @RolesAllowed}. */
public final class Rol {
    /** Ve y edita todo: los cinco negocios, los usuarios y las visitas. */
    public static final String DUENO = "DUENO";
    /** Solo ve y edita su negocio. Hay uno por negocio. */
    public static final String ENCARGADO = "ENCARGADO";

    private Rol() {
    }
}
