// Prueba REAL contra la API de OpenAI (apartado 6).
//   npm run probar:ia
//
// - Situaciones 1, 2 y 3: envía descripciones ficticias al modelo y comprueba que
//   su interpretación es razonable. Necesitan OPENAI_API_KEY en .env (consumen tokens).
// - Situación 5: provoca un fallo real usando una clave falsa. No necesita clave.
//
// Las respuestas del modelo pueden variar entre ejecuciones: el script comprueba
// propiedades (ids del catálogo, hay dudas, hay pendientes…), no textos exactos.
import "../server/env.js";
import OpenAI from "openai";
import { pedirPropuestaIA, validarPropuesta, ErrorIA } from "../server/propuesta.js";
import { obtenerClienteOpenAI, obtenerModelo } from "../server/openai.js";
import { IDS_SERVICIOS } from "../server/catalogo.js";

const ESCENARIOS = [
  {
    nombre: "1 · Solicitud clara que encaja con el catálogo",
    solicitud: {
      cliente: "Restaurante La Brasa Imaginaria",
      descripcion:
        "Necesito una web para un restaurante. Quiero mostrar la carta, tener un formulario para " +
        "solicitar reservas y ofrecer el contenido en dos idiomas.",
    },
    comprobaciones: (p) => [
      ["propone un tipo de web", p.servicios.some((s) => s.categoria === "base")],
      ["incluye el formulario", p.servicios.some((s) => s.id === "formulario")],
      ["incluye el segundo idioma", p.servicios.some((s) => s.id === "segundoIdioma")],
    ],
  },
  {
    nombre: "2 · Solicitud ambigua que necesita aclaraciones",
    solicitud: {
      cliente: "Estudio Ejemplo",
      descripcion: "Quiero una web para mi negocio, algo sencillo pero que quede bien y que me traiga clientes.",
    },
    comprobaciones: (p) => [["plantea dudas al cliente", p.dudas.length > 0]],
  },
  {
    nombre: "3 · Petición de un servicio que no ofrecemos",
    solicitud: {
      cliente: "Cerámicas Ficticias",
      descripcion:
        "Hacemos cerámica artesanal y queremos vender online con pago con tarjeta, además de un blog " +
        "y una página sobre el taller.",
    },
    comprobaciones: (p) => [
      ["marca necesidades pendientes de valorar", p.pendientes.length > 0],
      [
        "menciona el pago o la tienda en pendientes",
        p.pendientes.some((t) => /pago|tienda|venta|comercio/i.test(t)),
      ],
    ],
  },
];

let fallos = 0;
const ok = (texto, cumple) => {
  if (!cumple) fallos++;
  console.log(`   ${cumple ? "✔" : "✖"} ${texto}`);
};

const modelo = obtenerModelo();
const cliente = obtenerClienteOpenAI();

if (!cliente) {
  console.log("⚠  Sin OPENAI_API_KEY: se omiten las situaciones 1, 2 y 3 (copia .env.example a .env).\n");
} else {
  console.log(`Modelo: ${modelo}\n`);
  for (const e of ESCENARIOS) {
    console.log(`▶ ${e.nombre}`);
    console.log(`   «${e.solicitud.descripcion}»`);
    try {
      const inicio = Date.now();
      const bruta = await pedirPropuestaIA(cliente, e.solicitud, { modelo });
      const { propuesta, avisos } = validarPropuesta(bruta);
      console.log(`   (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
      console.log(`   Resumen: ${propuesta.resumen}`);
      for (const s of propuesta.servicios) {
        console.log(`   · ${s.id}${s.id === "paginaAdicional" ? ` ×${s.cantidad}` : ""}: ${s.justificacion}`);
      }
      for (const d of propuesta.dudas) console.log(`   ? ${d}`);
      for (const d of propuesta.pendientes) console.log(`   ! Pendiente: ${d}`);
      for (const a of avisos) console.log(`   ⚠ Aviso del servidor: ${a}`);

      // Comprobaciones comunes a todas las situaciones
      ok("todos los ids existen en el catálogo", bruta.servicios.every((s) => IDS_SERVICIOS.includes(s.id)));
      ok("no menciona importes ni plazos (sin avisos de retirada)", !avisos.some((a) => /importes o plazos/.test(a)));
      for (const [texto, cumple] of e.comprobaciones(propuesta)) ok(texto, cumple);
    } catch (err) {
      ok(`la llamada funciona (${err.message})`, false);
    }
    console.log();
  }
}

// Situación 5: fallo real de OpenAI con una clave inválida
console.log("▶ 5 · Fallo en la llamada a OpenAI (clave inválida, llamada real)");
try {
  const falso = new OpenAI({ apiKey: "sk-clave-invalida-de-prueba", maxRetries: 0, timeout: 20_000 });
  await pedirPropuestaIA(falso, ESCENARIOS[0].solicitud, { modelo });
  ok("la llamada con clave falsa falla", false);
} catch (err) {
  ok("se convierte en ErrorIA (la API responde 502)", err instanceof ErrorIA);
  console.log(`   Mensaje al usuario: ${err.message}`);
  console.log(`   Causa (solo en el log): ${err.cause?.status ?? ""} ${err.cause?.constructor?.name ?? ""}`);
}

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobación(es) fallida(s).`);
process.exitCode = fallos === 0 ? 0 : 1;
