const TIPOS_VALIDOS = ["landing", "corporativa"];
const CAMPOS_OBLIGATORIOS = ["tipo", "paginas", "formulario", "segundoIdioma"];

/**
 * Valida el cuerpo de una solicitud de presupuesto.
 * Devuelve { ok: true, datos } con solo los cuatro campos permitidos
 * (las propiedades adicionales se descartan) o { ok: false, errores }.
 */
export function validarSolicitud(cuerpo) {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return { ok: false, errores: ["El cuerpo de la petición debe ser un objeto JSON."] };
  }

  const errores = [];

  for (const campo of CAMPOS_OBLIGATORIOS) {
    if (!(campo in cuerpo)) {
      errores.push(`Falta el campo obligatorio "${campo}".`);
    }
  }
  if (errores.length > 0) return { ok: false, errores };

  const { tipo, paginas, formulario, segundoIdioma } = cuerpo;

  if (!TIPOS_VALIDOS.includes(tipo)) {
    errores.push(`"tipo" debe ser "landing" o "corporativa" (recibido: ${JSON.stringify(tipo)}).`);
  }

  if (typeof paginas !== "number" || !Number.isInteger(paginas)) {
    errores.push(`"paginas" debe ser un número entero (recibido: ${JSON.stringify(paginas)}).`);
  } else if (paginas < 1 || paginas > 20) {
    errores.push(`"paginas" debe estar entre 1 y 20 (recibido: ${paginas}).`);
  }

  if (typeof formulario !== "boolean") {
    errores.push(`"formulario" debe ser un booleano true o false (recibido: ${JSON.stringify(formulario)}).`);
  }

  if (typeof segundoIdioma !== "boolean") {
    errores.push(`"segundoIdioma" debe ser un booleano true o false (recibido: ${JSON.stringify(segundoIdioma)}).`);
  }

  if (errores.length > 0) return { ok: false, errores };

  return { ok: true, datos: { tipo, paginas, formulario, segundoIdioma } };
}
