package mx.turamohoy.catalogo.dto;

import mx.turamohoy.catalogo.model.OpcionesPlatillo;
import mx.turamohoy.catalogo.model.Platillo;
import mx.turamohoy.catalogo.model.Restaurante;

import java.math.BigDecimal;
import java.util.List;

/** Lugar de comida con su menú (el sitio usa solo los visibles y disponibles). */
public record RestauranteDto(
        Long id,
        String nombre,
        String descripcion,
        String horario,
        String direccion,
        String imagenUrl,
        int orden,
        boolean visible,
        List<PlatilloDto> platillos) {

    public record PlatilloDto(Long id, String nombre, String descripcion, BigDecimal precio, String imagenUrl,
                              int orden, boolean disponible, List<OpcionesPlatillo.Grupo> opciones) {
        public static PlatilloDto de(Platillo p) {
            return new PlatilloDto(p.id, p.nombre, p.descripcion, p.precio, p.imagenUrl, p.orden, p.disponible,
                    OpcionesPlatillo.leer(p.opciones));
        }
    }

    public static RestauranteDto de(Restaurante r, List<Platillo> platillos) {
        return new RestauranteDto(r.id, r.nombre, r.descripcion, r.horario, r.direccion, r.imagenUrl, r.orden,
                r.visible, platillos.stream().map(PlatilloDto::de).toList());
    }
}
