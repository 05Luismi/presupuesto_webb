import { LIMITES_SOLICITUD } from "./validarSolicitudCliente.js";
import { validarSeleccion, desglosarSeleccion } from "./seleccion.js";
import { buscarServicio } from "./catalogo.js";

export const LIMITES_DOCUMENTO = Object.freeze({
  resumenMax: 800,
  notasMax: 15, // por lista
  notaMax: 300, // caracteres por nota
});

const formatoFecha = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" });

/**
 * Valida el contenido que el usuario ha revisado para el PDF y prepara el
 * documento. Los importes NO se leen de la petición: se recalculan a partir de
 * la selección con las tarifas del servidor. La fecha también la pone el servidor.
 *
 * Cuerpo: { cliente, resumen, servicios: [{ id, cantidad? }], dudas: [], pendientes: [] }
 */
export function prepararDocumento(cuerpo, ahora = new Date()) {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    return { ok: false, errores: ["El cuerpo de la petición debe ser un objeto JSON."] };
  }

  const errores = [];
  const { clienteMin, clienteMax } = LIMITES_SOLICITUD;
  const { resumenMax, notasMax, notaMax } = LIMITES_DOCUMENTO;

  const cliente = typeof cuerpo.cliente === "string" ? cuerpo.cliente.trim() : "";
  if (cliente.length < clienteMin || cliente.length > clienteMax) {
    errores.push(`"cliente" debe tener entre ${clienteMin} y ${clienteMax} caracteres.`);
  }

  const resumen = typeof cuerpo.resumen === "string" ? cuerpo.resumen.trim() : "";
  if (resumen.length === 0) {
    errores.push("Escribe un resumen del proyecto para el documento.");
  } else if (resumen.length > resumenMax) {
    errores.push(`El resumen no puede superar los ${resumenMax} caracteres (tiene ${resumen.length}).`);
  }

  const listas = {};
  for (const campo of ["dudas", "pendientes"]) {
    const valor = cuerpo[campo] ?? [];
    if (!Array.isArray(valor) || valor.some((v) => typeof v !== "string")) {
      errores.push(`"${campo}" debe ser una lista de textos.`);
      continue;
    }
    const limpias = valor.map((v) => v.trim()).filter(Boolean);
    if (limpias.length > notasMax) errores.push(`"${campo}" admite como máximo ${notasMax} elementos.`);
    if (limpias.some((v) => v.length > notaMax)) errores.push(`Cada elemento de "${campo}" admite como máximo ${notaMax} caracteres.`);
    listas[campo] = limpias;
  }

  const seleccion = validarSeleccion({ servicios: cuerpo.servicios });
  if (!seleccion.ok) errores.push(...seleccion.errores);

  if (errores.length > 0) return { ok: false, errores };

  const desglose = desglosarSeleccion(seleccion.datos);
  return {
    ok: true,
    documento: {
      cliente,
      fecha: formatoFecha.format(ahora),
      resumen,
      servicios: desglose.lineas.map((l) => ({ nombre: l.nombre, descripcion: buscarServicio(l.id).descripcion })),
      desglose,
      dudas: listas.dudas,
      pendientes: listas.pendientes,
    },
  };
}

/** Nombre de archivo seguro: presupuesto-restaurante-la-brasa-2026-11-09.pdf */
export function nombreArchivo(cliente, ahora = new Date()) {
  const slug = cliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const dia = ahora.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }); // AAAA-MM-DD
  return `presupuesto-${slug || "cliente"}-${dia}.pdf`;
}
