import { TARIFAS, MONEDA } from "./tarifas.js";

/**
 * Catálogo de servicios de «Presupuesta mi web».
 *
 * Es la referencia que usará la IA para proponer servicios: solo puede
 * seleccionar identificadores que existan aquí. Lo que el cliente pida y no
 * encaje en ningún servicio se devolverá como «necesidad pendiente de valorar».
 *
 * Los precios NO se escriben aquí: se leen de TARIFAS, que sigue siendo la
 * única fuente de precios del servidor.
 *
 * Campos de cada servicio:
 *  - id:          identificador (coincide con la clave de TARIFAS).
 *  - nombre:      nombre visible para el cliente.
 *  - categoria:   "base" (tipo de web, se elige exactamente uno) o "extra".
 *  - descripcion: qué incluye el servicio.
 *  - noIncluye:   límites del servicio, para detectar peticiones fuera de catálogo.
 *  - precio:      importe en euros (sin impuestos).
 *  - regla:       cómo se aplica el precio en el cálculo.
 */
export const CATALOGO = Object.freeze(
  [
    {
      id: "landing",
      nombre: "Landing page",
      categoria: "base",
      descripcion:
        "Web de una sola página orientada a presentar un producto, servicio o negocio: " +
        "secciones de presentación, información de contacto y diseño adaptado a móvil.",
      noIncluye: ["Varias secciones en páginas independientes (usar páginas adicionales)"],
      precio: TARIFAS.landing,
      regla: "Precio fijo. Incluye la primera página.",
    },
    {
      id: "corporativa",
      nombre: "Web corporativa",
      categoria: "base",
      descripcion:
        "Web de empresa con varias secciones (inicio, quiénes somos, servicios, contacto…), " +
        "menú de navegación y diseño adaptado a móvil.",
      noIncluye: [],
      precio: TARIFAS.corporativa,
      regla: "Precio fijo. Incluye la primera página.",
    },
    {
      id: "paginaAdicional",
      nombre: "Página adicional",
      categoria: "extra",
      descripcion:
        "Cada página de contenido adicional a la primera (por ejemplo: carta, galería, " +
        "quiénes somos, servicios). Máximo 20 páginas en total.",
      noIncluye: ["Redacción de textos ni fotografía profesional"],
      precio: TARIFAS.paginaAdicional,
      regla: "Por unidad: (páginas − 1) × precio.",
    },
    {
      id: "formulario",
      nombre: "Formulario de contacto",
      categoria: "extra",
      descripcion:
        "Formulario que envía al negocio los datos que rellena el visitante (contacto, " +
        "solicitud de información, petición de reserva o de cita).",
      noIncluye: [
        "Sistema de reservas con calendario o disponibilidad en tiempo real",
        "Pagos en línea",
        "Área de usuarios o registro",
      ],
      precio: TARIFAS.formulario,
      regla: "Precio fijo si se selecciona.",
    },
    {
      id: "segundoIdioma",
      nombre: "Segundo idioma",
      categoria: "extra",
      descripcion: "Versión completa de la web en un segundo idioma, con selector de idioma.",
      noIncluye: ["Traducción de los textos", "Tercer idioma o siguientes"],
      precio: TARIFAS.segundoIdioma,
      regla: "Precio fijo si se selecciona. Solo se admite un idioma adicional.",
    },
  ].map((servicio) => Object.freeze({ ...servicio, noIncluye: Object.freeze(servicio.noIncluye) })),
);

export const IDS_SERVICIOS = Object.freeze(CATALOGO.map((s) => s.id));

/** Devuelve el servicio con ese id o undefined si no existe en el catálogo. */
export function buscarServicio(id) {
  return CATALOGO.find((s) => s.id === id);
}

export { MONEDA };
