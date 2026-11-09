import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../server/app.js";
import { calcularPresupuesto } from "../server/calcular.js";
import { TARIFAS } from "../server/tarifas.js";
import { CATALOGO, buscarServicio } from "../server/catalogo.js";
import { validarPropuesta, ESQUEMA_PROPUESTA, INSTRUCCIONES } from "../server/propuesta.js";
import { prepararDocumento, nombreArchivo } from "../server/documento.js";

let servidor;
let url;

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  url = `http://localhost:${servidor.address().port}`;
});

after(() => servidor.close());

const valido = { tipo: "corporativa", paginas: 4, formulario: true, segundoIdioma: false };

function enviar(cuerpo) {
  return fetch(`${url}/api/presupuesto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

test("GET / → redirige a /api/estado", async () => {
  const res = await fetch(`${url}/`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("GET /api/estado → 200 { status: 'ok' }", async () => {
  const res = await fetch(`${url}/api/estado`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("GET /api/tarifas → tarifas del servidor", async () => {
  const res = await fetch(`${url}/api/tarifas`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    moneda: "EUR",
    tarifas: { landing: 300, corporativa: 600, paginaAdicional: 50, formulario: 80, segundoIdioma: 150 },
  });
});

// Casos obligatorios del enunciado
const casosValidos = [
  ["1 · Landing, 1 página, sin extras", { tipo: "landing", paginas: 1, formulario: false, segundoIdioma: false }, 300],
  ["2 · Corporativa, 4 páginas, formulario", valido, 830],
  ["3 · Landing, 2 páginas, ambos extras", { tipo: "landing", paginas: 2, formulario: true, segundoIdioma: true }, 580],
  ["4 · Landing, 20 páginas, sin extras", { tipo: "landing", paginas: 20, formulario: false, segundoIdioma: false }, 1250],
];

for (const [nombre, cuerpo, total] of casosValidos) {
  test(`Caso ${nombre} → 200 · ${total} €`, async () => {
    const res = await enviar(cuerpo);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).total, total);
  });
}

const casosInvalidos = [
  ["5 · paginas: 0", { ...valido, paginas: 0 }],
  ["6 · paginas: 21", { ...valido, paginas: 21 }],
  ["7 · paginas: 2.5", { ...valido, paginas: 2.5 }],
  ["8 · tipo: 'tienda'", { ...valido, tipo: "tienda" }],
  ["9 · formulario: 'false'", { ...valido, formulario: "false" }],
  ["extra · paginas: '4'", { ...valido, paginas: "4" }],
  ["extra · falta segundoIdioma", { tipo: "landing", paginas: 1, formulario: false }],
  ["extra · cuerpo es un array", [valido]],
];

for (const [nombre, cuerpo] of casosInvalidos) {
  test(`Caso ${nombre} → 400`, async () => {
    const res = await enviar(cuerpo);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
    assert.equal(json.total, undefined);
  });
}

test("Ejemplo del enunciado → desglose exacto", async () => {
  const res = await enviar(valido);
  assert.deepEqual(await res.json(), {
    base: 600,
    paginasAdicionales: 150,
    formulario: 80,
    segundoIdioma: 0,
    total: 830,
    moneda: "EUR",
  });
});

test("Las propiedades extra (total, tarifas…) se ignoran", async () => {
  const res = await enviar({ ...valido, total: 1, base: 0, tarifas: { corporativa: 1 } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).total, 830);
});

test("Sin Content-Type: application/json → 400", async () => {
  const res = await fetch(`${url}/api/presupuesto`, { method: "POST", body: JSON.stringify(valido) });
  assert.equal(res.status, 400);
});

test("JSON mal formado → 400", async () => {
  const res = await fetch(`${url}/api/presupuesto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ tipo: landing",
  });
  assert.equal(res.status, 400);
});

test("calcularPresupuesto funciona sin Express", () => {
  assert.equal(calcularPresupuesto({ tipo: "landing", paginas: 3, formulario: false, segundoIdioma: true }).total, 550);
});

test("GET /api/catalogo → servicios con id, nombre, descripción y precio", async () => {
  const res = await fetch(`${url}/api/catalogo`);
  assert.equal(res.status, 200);
  const { moneda, servicios } = await res.json();
  assert.equal(moneda, "EUR");
  assert.deepEqual(
    servicios.map((s) => s.id),
    ["landing", "corporativa", "paginaAdicional", "formulario", "segundoIdioma"],
  );
  for (const s of servicios) {
    assert.ok(s.nombre && s.descripcion && s.regla, `faltan campos en ${s.id}`);
    assert.equal(typeof s.precio, "number");
  }
});

test("Los precios del catálogo salen de TARIFAS y no se pueden modificar", () => {
  for (const s of CATALOGO) assert.equal(s.precio, TARIFAS[s.id]);
  assert.equal(Object.keys(TARIFAS).length, CATALOGO.length);
  assert.throws(() => {
    "use strict";
    buscarServicio("landing").precio = 1;
  });
  assert.equal(buscarServicio("tienda"), undefined);
});

// ── Solicitud del cliente (datos ficticios) ─────────────────────────────
const solicitudFicticia = {
  cliente: "Restaurante La Brasa Imaginaria",
  descripcion:
    "Necesito una web para un restaurante. Quiero mostrar la carta, tener un formulario " +
    "para solicitar reservas y ofrecer el contenido en dos idiomas.",
};

function enviarSolicitud(cuerpo) {
  return fetch(`${url}/api/solicitud`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

test("POST /api/solicitud válida → 200 y datos recortados", async () => {
  const res = await enviarSolicitud({
    cliente: `  ${solicitudFicticia.cliente}  `,
    descripcion: `\n${solicitudFicticia.descripcion}\n`,
    total: 1,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { recibida: true, solicitud: solicitudFicticia });
});

const solicitudesInvalidas = [
  ["descripción vacía", { ...solicitudFicticia, descripcion: "" }],
  ["descripción solo con espacios", { ...solicitudFicticia, descripcion: "   \n  " }],
  ["descripción demasiado corta", { ...solicitudFicticia, descripcion: "Una web" }],
  ["descripción de 2001 caracteres", { ...solicitudFicticia, descripcion: "a".repeat(2001) }],
  ["descripción no es texto", { ...solicitudFicticia, descripcion: 123 }],
  ["falta la descripción", { cliente: solicitudFicticia.cliente }],
  ["falta el cliente", { descripcion: solicitudFicticia.descripcion }],
  ["cliente vacío", { ...solicitudFicticia, cliente: "  " }],
  ["cliente de 101 caracteres", { ...solicitudFicticia, cliente: "x".repeat(101) }],
  ["cuerpo es un array", [solicitudFicticia]],
];

for (const [nombre, cuerpo] of solicitudesInvalidas) {
  test(`POST /api/solicitud · ${nombre} → 400`, async () => {
    const res = await enviarSolicitud(cuerpo);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, "Solicitud no válida.");
    assert.ok(json.detalles.length > 0);
  });
}

test("POST /api/solicitud · descripción de 2000 caracteres → 200 (límite exacto)", async () => {
  const res = await enviarSolicitud({ ...solicitudFicticia, descripcion: "a".repeat(2000) });
  assert.equal(res.status, 200);
});

test("POST /api/solicitud sin Content-Type JSON → 400", async () => {
  const res = await fetch(`${url}/api/solicitud`, { method: "POST", body: JSON.stringify(solicitudFicticia) });
  assert.equal(res.status, 400);
});

test("GET /api/solicitud/limites → límites del servidor", async () => {
  const res = await fetch(`${url}/api/solicitud/limites`);
  assert.deepEqual(await res.json(), { clienteMin: 2, clienteMax: 100, descripcionMin: 20, descripcionMax: 2000 });
});

// ── Propuesta con IA (cliente de OpenAI simulado, datos ficticios) ──────

// Doble del SDK: guarda la última petición y devuelve la respuesta indicada
function clienteSimulado(salida, extra = {}) {
  const simulado = {
    peticion: null,
    responses: {
      async create(peticion) {
        simulado.peticion = peticion;
        if (salida instanceof Error) throw salida;
        return { status: "completed", output: [], output_text: JSON.stringify(salida), ...extra };
      },
    },
  };
  return simulado;
}

const respuestaRestaurante = {
  resumen: "Web para un restaurante con carta, petición de reservas y versión en dos idiomas.",
  servicios: [
    { id: "corporativa", cantidad: 1, justificacion: "Un restaurante necesita varias secciones." },
    { id: "paginaAdicional", cantidad: 2, justificacion: "Páginas para la carta y para reservas." },
    { id: "formulario", cantidad: 1, justificacion: "Permite que los clientes soliciten reserva." },
    { id: "segundoIdioma", cantidad: 1, justificacion: "El cliente quiere el contenido en dos idiomas." },
  ],
  dudas: ["¿Qué segundo idioma necesitas?"],
  pendientes: [],
};

function enviarPropuesta(cuerpo) {
  return fetch(`${url}/api/propuesta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

test("POST /api/propuesta → 200 con resumen, servicios, dudas y pendientes", async () => {
  const simulado = clienteSimulado(respuestaRestaurante);
  app.set("clienteIA", simulado);
  try {
    const res = await enviarPropuesta(solicitudFicticia);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.cliente, solicitudFicticia.cliente);
    assert.equal(json.propuesta.resumen, respuestaRestaurante.resumen);
    assert.deepEqual(
      json.propuesta.servicios.map((s) => [s.id, s.cantidad]),
      [["corporativa", 1], ["paginaAdicional", 2], ["formulario", 1], ["segundoIdioma", 1]],
    );
    assert.equal(json.propuesta.servicios[0].nombre, "Web corporativa");
    assert.deepEqual(json.propuesta.dudas, ["¿Qué segundo idioma necesitas?"]);
    assert.deepEqual(json.avisos, []);
    // La respuesta no contiene precios
    assert.doesNotMatch(JSON.stringify(json), /precio|total|€/i);

    // Se envía la descripción y el catálogo (sin precios) con salida estructurada estricta
    const p = simulado.peticion;
    assert.match(p.input, /mostrar la carta/);
    assert.match(p.instructions, /"id": "segundoIdioma"/);
    assert.doesNotMatch(p.instructions, /"precio"|\b(300|600|150)\b/);
    assert.equal(p.text.format.type, "json_schema");
    assert.equal(p.text.format.strict, true);
  } finally {
    app.set("clienteIA", undefined);
  }
});

test("POST /api/propuesta valida la solicitud antes de llamar a la IA → 400", async () => {
  const simulado = clienteSimulado(respuestaRestaurante);
  app.set("clienteIA", simulado);
  try {
    const res = await enviarPropuesta({ ...solicitudFicticia, descripcion: "  " });
    assert.equal(res.status, 400);
    assert.equal(simulado.peticion, null, "no debe llamar a la IA");
  } finally {
    app.set("clienteIA", undefined);
  }
});

test("POST /api/propuesta sin OPENAI_API_KEY → 503", async () => {
  const clave = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const res = await enviarPropuesta(solicitudFicticia);
    assert.equal(res.status, 503);
  } finally {
    if (clave !== undefined) process.env.OPENAI_API_KEY = clave;
  }
});

for (const [nombre, salida, extra] of [
  ["la IA falla", new Error("timeout")],
  ["la respuesta no es JSON", null, { output_text: "no es json" }],
  ["respuesta incompleta", respuestaRestaurante, { status: "incomplete" }],
  ["la IA rechaza", respuestaRestaurante, { output: [{ content: [{ type: "refusal", refusal: "no" }] }] }],
]) {
  test(`POST /api/propuesta · ${nombre} → 502`, async () => {
    app.set("clienteIA", clienteSimulado(salida, extra));
    try {
      const res = await enviarPropuesta(solicitudFicticia);
      assert.equal(res.status, 502);
      assert.ok((await res.json()).error);
    } finally {
      app.set("clienteIA", undefined);
    }
  });
}

test("validarPropuesta descarta ids fuera del catálogo y repetidos", () => {
  const { propuesta, avisos } = validarPropuesta({
    ...respuestaRestaurante,
    servicios: [
      { id: "landing", cantidad: 1, justificacion: "Una página." },
      { id: "tiendaOnline", cantidad: 1, justificacion: "Para vender." },
      { id: "formulario", cantidad: 1, justificacion: "Contacto." },
      { id: "formulario", cantidad: 1, justificacion: "Otra vez." },
      { id: "toString", cantidad: 1, justificacion: "Truco." },
    ],
  });
  assert.deepEqual(propuesta.servicios.map((s) => s.id), ["landing", "formulario"]);
  assert.equal(avisos.length, 3);
});

test("validarPropuesta deja un solo tipo de web y ajusta cantidades", () => {
  const { propuesta } = validarPropuesta({
    ...respuestaRestaurante,
    servicios: [
      { id: "paginaAdicional", cantidad: 50, justificacion: "Muchas." },
      { id: "landing", cantidad: 1, justificacion: "Una." },
      { id: "corporativa", cantidad: 3, justificacion: "Varias." },
      { id: "segundoIdioma", cantidad: 4, justificacion: "Idiomas." },
    ],
  });
  assert.deepEqual(
    propuesta.servicios.map((s) => [s.id, s.cantidad]),
    [["corporativa", 1], ["paginaAdicional", 19], ["segundoIdioma", 1]],
  );
});

test("validarPropuesta sin tipo de web → añade una duda", () => {
  const { propuesta, avisos } = validarPropuesta({ ...respuestaRestaurante, servicios: [] });
  assert.equal(propuesta.servicios.length, 0);
  assert.match(propuesta.dudas[0], /landing/);
  assert.equal(avisos.length, 1);
});

test("validarPropuesta retira importes y plazos inventados por la IA", () => {
  const { propuesta, avisos } = validarPropuesta({
    resumen: "Web lista en 2 semanas por 900 €.",
    servicios: [{ id: "landing", cantidad: 1, justificacion: "Solo cuesta 300 euros." }],
    dudas: ["¿Te va bien que la entreguemos en 10 días?", "¿Tienes logotipo?"],
    pendientes: ["Pasarela de pago"],
  });
  assert.equal(propuesta.resumen, "");
  assert.equal(propuesta.servicios[0].justificacion, buscarServicio("landing").descripcion);
  assert.deepEqual(propuesta.dudas, ["¿Tienes logotipo?"]);
  assert.deepEqual(propuesta.pendientes, ["Pasarela de pago"]);
  assert.equal(avisos.length, 3);
});

test("validarPropuesta rechaza respuestas sin formato de objeto", () => {
  assert.throws(() => validarPropuesta(null));
  assert.throws(() => validarPropuesta([]));
});

test("El esquema solo admite ids del catálogo", () => {
  assert.deepEqual(ESQUEMA_PROPUESTA.properties.servicios.items.properties.id.enum, CATALOGO.map((s) => s.id));
  assert.match(INSTRUCCIONES, /pendientes/);
});

// ── Selección confirmada → cálculo con las tarifas del servidor ─────────
function enviarSeleccion(cuerpo) {
  return fetch(`${url}/api/presupuesto/servicios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

test("POST /api/presupuesto/servicios → desglose por partidas (restaurante)", async () => {
  const res = await enviarSeleccion({
    servicios: [
      { id: "corporativa" },
      { id: "paginaAdicional", cantidad: 2 },
      { id: "formulario" },
      { id: "segundoIdioma" },
    ],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    lineas: [
      { id: "corporativa", nombre: "Web corporativa", cantidad: 1, precioUnitario: 600, importe: 600 },
      { id: "paginaAdicional", nombre: "Página adicional", cantidad: 2, precioUnitario: 50, importe: 100 },
      { id: "formulario", nombre: "Formulario de contacto", cantidad: 1, precioUnitario: 80, importe: 80 },
      { id: "segundoIdioma", nombre: "Segundo idioma", cantidad: 1, precioUnitario: 150, importe: 150 },
    ],
    paginas: 3,
    total: 930,
    moneda: "EUR",
  });
});

test("POST /api/presupuesto/servicios · solo landing → 300 €, ignora precios enviados", async () => {
  const res = await enviarSeleccion({
    servicios: [{ id: "landing", cantidad: 7, precioUnitario: 1, importe: 1 }],
    total: 1,
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.total, 300);
  assert.equal(json.lineas.length, 1);
});

test("POST /api/presupuesto/servicios coincide con POST /api/presupuesto", async () => {
  const a = await (await enviarSeleccion({ servicios: [{ id: "landing" }, { id: "paginaAdicional", cantidad: 19 }] })).json();
  const b = await (await enviar({ tipo: "landing", paginas: 20, formulario: false, segundoIdioma: false })).json();
  assert.equal(a.total, b.total);
});

for (const [nombre, cuerpo] of [
  ["sin tipo de web", { servicios: [{ id: "formulario" }] }],
  ["dos tipos de web", { servicios: [{ id: "landing" }, { id: "corporativa" }] }],
  ["servicio inexistente", { servicios: [{ id: "landing" }, { id: "tiendaOnline" }] }],
  ["servicio repetido", { servicios: [{ id: "landing" }, { id: "formulario" }, { id: "formulario" }] }],
  ["páginas adicionales sin cantidad", { servicios: [{ id: "landing" }, { id: "paginaAdicional" }] }],
  ["páginas adicionales vacías", { servicios: [{ id: "landing" }, { id: "paginaAdicional", cantidad: "" }] }],
  ["páginas adicionales = 0", { servicios: [{ id: "landing" }, { id: "paginaAdicional", cantidad: 0 }] }],
  ["páginas adicionales = 20", { servicios: [{ id: "landing" }, { id: "paginaAdicional", cantidad: 20 }] }],
  ["páginas adicionales = 1.5", { servicios: [{ id: "landing" }, { id: "paginaAdicional", cantidad: 1.5 }] }],
  ["páginas adicionales como texto", { servicios: [{ id: "landing" }, { id: "paginaAdicional", cantidad: "3" }] }],
  ["lista vacía", { servicios: [] }],
  ["sin lista", { tipo: "landing" }],
  ["cuerpo es un array", [{ id: "landing" }]],
]) {
  test(`POST /api/presupuesto/servicios · ${nombre} → 400`, async () => {
    const res = await enviarSeleccion(cuerpo);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, "Selección no válida.");
    assert.ok(json.detalles.length > 0);
    assert.equal(json.total, undefined);
  });
}

// ── PDF del presupuesto (datos ficticios) ───────────────────────────────
const documentoFicticio = {
  cliente: "Restaurante La Brasa Imaginaria",
  resumen: "Web para un restaurante con carta, petición de reservas y versión en dos idiomas.",
  servicios: [
    { id: "corporativa" },
    { id: "paginaAdicional", cantidad: 2 },
    { id: "formulario" },
    { id: "segundoIdioma" },
  ],
  dudas: ["¿Qué segundo idioma necesitas?"],
  pendientes: ["Reservas con calendario de disponibilidad"],
};

function pedirPDF(cuerpo, consulta = "") {
  return fetch(`${url}/api/presupuesto/pdf${consulta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

test("POST /api/presupuesto/pdf → 200 application/pdf descargable", async () => {
  const res = await pedirPDF(documentoFicticio);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.match(res.headers.get("content-disposition"), /^attachment; filename="presupuesto-restaurante-la-brasa-imaginaria-\d{4}-\d{2}-\d{2}\.pdf"$/);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 2000);
});

test("POST /api/presupuesto/pdf?vista=1 → inline para la vista previa", async () => {
  const res = await pedirPDF(documentoFicticio, "?vista=1");
  assert.match(res.headers.get("content-disposition"), /^inline;/);
});

test("prepararDocumento recalcula importes y pone fecha y descripciones del servidor", () => {
  const r = prepararDocumento(
    { ...documentoFicticio, total: 1, desglose: { total: 1 }, fecha: "1 de enero de 1999", dudas: ["  ", " ¿Logo? "] },
    new Date("2026-11-09T10:00:00Z"),
  );
  assert.ok(r.ok);
  assert.equal(r.documento.fecha, "9 de noviembre de 2026");
  assert.equal(r.documento.desglose.total, 930);
  assert.deepEqual(r.documento.dudas, ["¿Logo?"]);
  assert.equal(r.documento.servicios[0].descripcion, buscarServicio("corporativa").descripcion);
});

for (const [nombre, cuerpo] of [
  ["sin resumen", { ...documentoFicticio, resumen: "  " }],
  ["resumen demasiado largo", { ...documentoFicticio, resumen: "a".repeat(801) }],
  ["sin cliente", { ...documentoFicticio, cliente: "" }],
  ["selección sin tipo de web", { ...documentoFicticio, servicios: [{ id: "formulario" }] }],
  ["páginas adicionales sin cantidad", { ...documentoFicticio, servicios: [{ id: "landing" }, { id: "paginaAdicional" }] }],
  ["dudas no es una lista", { ...documentoFicticio, dudas: "¿Logo?" }],
  ["demasiadas aclaraciones", { ...documentoFicticio, pendientes: Array.from({ length: 16 }, (_, i) => `Nota ${i}`) }],
  ["aclaración demasiado larga", { ...documentoFicticio, dudas: ["a".repeat(301)] }],
]) {
  test(`POST /api/presupuesto/pdf · ${nombre} → 400`, async () => {
    const res = await pedirPDF(cuerpo);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "No se puede generar el documento.");
  });
}

test("nombreArchivo quita tildes y símbolos", () => {
  assert.equal(nombreArchivo("Cerámicas Ñandú & Cía.", new Date("2026-11-09T10:00:00Z")), "presupuesto-ceramicas-nandu-cia-2026-11-09.pdf");
});
