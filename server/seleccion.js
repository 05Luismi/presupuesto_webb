import { buscarServicio } from "./catalogo.js";
import { TARIFAS, MONEDA } from "./tarifas.js";
import { calcularPresupuesto } from "./calcular.js";

export const MAX_PAGINAS_ADICIONALES = 19; // 20 páginas en total

/**
 * Valida la selección de servicios que el usuario ha confirmado tras revisar
 * la propuesta. Formato: { servicios: [{ id, cantidad? }, ...] }
 *
 * Reglas:
 *  - cada id existe en el catálogo y no se repite;
 *  - hay exactamente un servicio base (landing o corporativa);
 *  - "paginaAdicional" exige "cantidad" entera entre 1 y 19 (dato necesario para calcular);
 *  - los demás servicios no llevan cantidad (se ignora si llega).
 *
 * Devuelve { ok: true, datos } con los datos en el formato de calcularPresupuesto
 * o { ok: false, errores }. Precios, totales u otras propiedades se descartan.
 */
export function validarSeleccion(cuerpo) {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return { ok: false, errores: ["El cuerpo de la petición debe ser un objeto JSON."] };
  }
  if (!Array.isArray(cuerpo.servicios)) {
    return { ok: false, errores: ['Falta la lista "servicios" con los servicios seleccionados.'] };
  }

  const errores = [];
  const elegidos = new Map();

  for (const item of cuerpo.servicios) {
    const id = item?.id;
    const servicio = typeof id === "string" ? buscarServicio(id) : undefined;
    if (!servicio) {
      errores.push(`El servicio ${JSON.stringify(id)} no existe en el catálogo.`);
      continue;
    }
    if (elegidos.has(id)) {
      errores.push(`El servicio "${servicio.nombre}" está repetido.`);
      continue;
    }
    elegidos.set(id, item);
  }

  const bases = [...elegidos.keys()].filter((id) => buscarServicio(id).categoria === "base");
  if (bases.length === 0) {
    errores.push('Elige el tipo de web: "Landing page" o "Web corporativa".');
  } else if (bases.length > 1) {
    errores.push("Solo se puede elegir un tipo de web.");
  }

  let paginas = 1;
  if (elegidos.has("paginaAdicional")) {
    const cantidad = elegidos.get("paginaAdicional").cantidad;
    if (cantidad === undefined || cantidad === null || cantidad === "") {
      errores.push('Indica cuántas páginas adicionales necesitas para calcular "Página adicional".');
    } else if (typeof cantidad !== "number" || !Number.isInteger(cantidad)) {
      errores.push(`Las páginas adicionales deben ser un número entero (recibido: ${JSON.stringify(cantidad)}).`);
    } else if (cantidad < 1 || cantidad > MAX_PAGINAS_ADICIONALES) {
      errores.push(`Las páginas adicionales deben estar entre 1 y ${MAX_PAGINAS_ADICIONALES} (recibido: ${cantidad}).`);
    } else {
      paginas = 1 + cantidad;
    }
  }

  if (errores.length > 0) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      tipo: bases[0],
      paginas,
      formulario: elegidos.has("formulario"),
      segundoIdioma: elegidos.has("segundoIdioma"),
    },
  };
}

/**
 * Calcula el presupuesto con las tarifas del servidor y lo devuelve por partidas,
 * una línea por servicio seleccionado. Reutiliza calcularPresupuesto().
 */
export function desglosarSeleccion(datos) {
  const calculo = calcularPresupuesto(datos);
  const linea = (id, cantidad, importe) => ({
    id,
    nombre: buscarServicio(id).nombre,
    cantidad,
    precioUnitario: TARIFAS[id],
    importe,
  });

  const lineas = [linea(datos.tipo, 1, calculo.base)];
  if (datos.paginas > 1) lineas.push(linea("paginaAdicional", datos.paginas - 1, calculo.paginasAdicionales));
  if (datos.formulario) lineas.push(linea("formulario", 1, calculo.formulario));
  if (datos.segundoIdioma) lineas.push(linea("segundoIdioma", 1, calculo.segundoIdioma));

  return { lineas, paginas: datos.paginas, total: calculo.total, moneda: MONEDA };
}
