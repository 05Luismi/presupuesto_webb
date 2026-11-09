// Límites de la solicitud en lenguaje natural. El servidor es quien decide:
// la interfaz los repite solo para avisar antes de enviar.
export const LIMITES_SOLICITUD = Object.freeze({
  clienteMin: 2,
  clienteMax: 100,
  descripcionMin: 20,
  descripcionMax: 2000,
});

/**
 * Valida la solicitud de un cliente que explica su proyecto con sus palabras.
 * Devuelve { ok: true, datos } con solo { cliente, descripcion } ya recortados
 * (las propiedades adicionales se descartan) o { ok: false, errores }.
 */
export function validarSolicitudCliente(cuerpo) {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return { ok: false, errores: ["El cuerpo de la petición debe ser un objeto JSON."] };
  }

  const errores = [];
  const { clienteMin, clienteMax, descripcionMin, descripcionMax } = LIMITES_SOLICITUD;

  const cliente = typeof cuerpo.cliente === "string" ? cuerpo.cliente.trim() : null;
  if (cliente === null) {
    errores.push('Falta el campo "cliente" (nombre del cliente o empresa) o no es un texto.');
  } else if (cliente.length < clienteMin || cliente.length > clienteMax) {
    errores.push(`"cliente" debe tener entre ${clienteMin} y ${clienteMax} caracteres (tiene ${cliente.length}).`);
  }

  const descripcion = typeof cuerpo.descripcion === "string" ? cuerpo.descripcion.trim() : null;
  if (descripcion === null) {
    errores.push('Falta el campo "descripcion" o no es un texto.');
  } else if (descripcion.length === 0) {
    errores.push('"descripcion" no puede estar vacía: explica qué necesitas.');
  } else if (descripcion.length < descripcionMin) {
    errores.push(`"descripcion" es demasiado corta: escribe al menos ${descripcionMin} caracteres.`);
  } else if (descripcion.length > descripcionMax) {
    errores.push(`"descripcion" no puede superar los ${descripcionMax} caracteres (tiene ${descripcion.length}).`);
  }

  if (errores.length > 0) return { ok: false, errores };

  return { ok: true, datos: { cliente, descripcion } };
}
