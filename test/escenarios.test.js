// Comprobación del funcionamiento (apartado 6): recorre cada situación de
// principio a fin por la API (propuesta → revisión → cálculo → PDF).
// La IA se sustituye por un cliente simulado que devuelve lo que respondería
// el modelo; así se prueba qué hace NUESTRA aplicación en cada caso.
// Todos los datos son ficticios.
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import app from "../server/app.js";
import { prepararDocumento } from "../server/documento.js";

let servidor;
let url;

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  url = `http://localhost:${servidor.address().port}`;
});

after(() => {
  app.set("clienteIA", undefined);
  servidor.close();
});

// ── Utilidades ──────────────────────────────────────────────────────────
function iaSimulada(respuesta) {
  const ia = {
    llamadas: 0,
    ultimaPeticion: null,
    responses: {
      async create(peticion) {
        ia.llamadas++;
        ia.ultimaPeticion = peticion;
        if (typeof respuesta === "function") return respuesta(peticion);
        return { status: "completed", output: [], output_text: JSON.stringify(respuesta) };
      },
    },
  };
  app.set("clienteIA", ia);
  return ia;
}

const post = (ruta, cuerpo) =>
  fetch(`${url}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

const proponer = async (solicitud) => {
  const res = await post("/api/propuesta", solicitud);
  return { status: res.status, json: await res.json() };
};

const calcular = async (servicios) => {
  const res = await post("/api/presupuesto/servicios", { servicios });
  return { status: res.status, json: await res.json() };
};

const seleccionDe = (servicios) =>
  servicios.map((s) => (s.id === "paginaAdicional" ? { id: s.id, cantidad: s.cantidad } : { id: s.id }));

async function pdf(cuerpo) {
  const res = await post("/api/presupuesto/pdf", cuerpo);
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, tipo: res.headers.get("content-type"), bytes };
}

// ── 1. Solicitud clara que encaja con el catálogo ───────────────────────
describe("1 · Solicitud clara que encaja con el catálogo", () => {
  const solicitud = {
    cliente: "Restaurante La Brasa Imaginaria",
    descripcion:
      "Necesito una web para un restaurante. Quiero mostrar la carta, tener un formulario para " +
      "solicitar reservas y ofrecer el contenido en dos idiomas.",
  };
  const respuestaIA = {
    resumen: "Web para un restaurante con carta, solicitud de reservas y versión en dos idiomas.",
    servicios: [
      { id: "corporativa", cantidad: 1, justificacion: "Un restaurante necesita varias secciones." },
      { id: "paginaAdicional", cantidad: 2, justificacion: "Páginas para la carta y para reservas." },
      { id: "formulario", cantidad: 1, justificacion: "Permite que los clientes soliciten reserva." },
      { id: "segundoIdioma", cantidad: 1, justificacion: "Pide el contenido en dos idiomas." },
    ],
    dudas: [],
    pendientes: [],
  };

  test("propone solo servicios del catálogo, sin correcciones, y se calcula y descarga", async () => {
    const ia = iaSimulada(respuestaIA);
    const { status, json } = await proponer(solicitud);
    assert.equal(status, 200);
    assert.equal(ia.llamadas, 1);
    // Al modelo le llegan la descripción y el catálogo, nunca los precios
    assert.match(ia.ultimaPeticion.input, /mostrar la carta/);
    assert.doesNotMatch(ia.ultimaPeticion.instructions, /"precio"/);

    assert.deepEqual(json.propuesta.servicios.map((s) => s.id), ["corporativa", "paginaAdicional", "formulario", "segundoIdioma"]);
    assert.ok(json.propuesta.servicios.every((s) => s.justificacion.length > 0));
    assert.deepEqual(json.avisos, []);
    assert.deepEqual(json.propuesta.pendientes, []);

    // El usuario acepta todo
    const calculo = await calcular(seleccionDe(json.propuesta.servicios));
    assert.equal(calculo.status, 200);
    assert.equal(calculo.json.total, 930); // 600 + 2×50 + 80 + 150

    const documento = await pdf({
      cliente: json.cliente,
      resumen: json.propuesta.resumen,
      servicios: seleccionDe(json.propuesta.servicios),
      dudas: json.propuesta.dudas,
      pendientes: json.propuesta.pendientes,
    });
    assert.equal(documento.status, 200);
    assert.equal(documento.tipo, "application/pdf");
    assert.equal(documento.bytes.subarray(0, 5).toString(), "%PDF-");
  });
});

// ── 2. Solicitud ambigua que necesita aclaraciones ──────────────────────
describe("2 · Solicitud ambigua que necesita aclaraciones", () => {
  const solicitud = {
    cliente: "Estudio Ejemplo",
    descripcion: "Quiero una web para mi negocio, algo sencillo pero que quede bien y que me traiga clientes.",
  };
  // El modelo no tiene datos para elegir el tipo de web y lo pregunta
  const respuestaIA = {
    resumen: "Web sencilla para presentar un negocio y captar clientes.",
    servicios: [{ id: "formulario", cantidad: 1, justificacion: "Para que los interesados puedan contactar." }],
    dudas: [
      "¿A qué se dedica tu negocio?",
      "¿Te basta con una sola página o necesitas varias secciones?",
      "¿Necesitas la web en más de un idioma?",
    ],
    pendientes: [],
  };

  test("devuelve dudas y obliga a elegir el tipo de web antes de calcular", async () => {
    iaSimulada(respuestaIA);
    const { status, json } = await proponer(solicitud);
    assert.equal(status, 200);
    assert.ok(json.propuesta.dudas.length >= 3);
    // Sin servicio base, el servidor añade la pregunta y avisa
    assert.match(json.propuesta.dudas[0], /landing|corporativa/i);
    assert.ok(json.avisos.some((a) => /tipo de web/.test(a)));

    // Si el usuario intenta calcular sin elegir tipo de web → 400
    const sinBase = await calcular(seleccionDe(json.propuesta.servicios));
    assert.equal(sinBase.status, 400);
    assert.ok(sinBase.json.detalles.some((d) => /tipo de web/.test(d)));

    // Tras aclararlo, añade una landing y ya se calcula
    const conBase = await calcular([{ id: "landing" }, ...seleccionDe(json.propuesta.servicios)]);
    assert.equal(conBase.status, 200);
    assert.equal(conBase.json.total, 380); // 300 + 80

    // Las dudas viajan al PDF como aclaraciones
    const r = prepararDocumento({
      cliente: json.cliente,
      resumen: json.propuesta.resumen,
      servicios: [{ id: "landing" }, { id: "formulario" }],
      dudas: json.propuesta.dudas,
      pendientes: [],
    });
    assert.ok(r.ok);
    assert.deepEqual(r.documento.dudas, json.propuesta.dudas);
  });
});

// ── 3. Petición de un servicio que no ofrecemos ─────────────────────────
describe("3 · Petición de un servicio que no ofrecemos", () => {
  const solicitud = {
    cliente: "Cerámicas Ficticias",
    descripcion:
      "Hacemos cerámica artesanal y queremos vender online con pago con tarjeta, además de un blog " +
      "y una página sobre el taller.",
  };

  test("lo no ofrecido queda como pendiente de valorar y fuera del total", async () => {
    iaSimulada({
      resumen: "Web para un taller de cerámica con información del taller.",
      servicios: [
        { id: "corporativa", cantidad: 1, justificacion: "Necesitan varias secciones." },
        { id: "paginaAdicional", cantidad: 1, justificacion: "Página sobre el taller." },
      ],
      dudas: [],
      pendientes: ["Tienda online con pago con tarjeta", "Blog"],
    });
    const { status, json } = await proponer(solicitud);
    assert.equal(status, 200);
    assert.deepEqual(json.propuesta.pendientes, ["Tienda online con pago con tarjeta", "Blog"]);
    assert.deepEqual(json.propuesta.servicios.map((s) => s.id), ["corporativa", "paginaAdicional"]);

    const calculo = await calcular(seleccionDe(json.propuesta.servicios));
    assert.equal(calculo.json.total, 650); // solo lo que está en el catálogo
  });

  test("si la IA se inventa un servicio, el servidor lo descarta y avisa", async () => {
    // Simula un modelo que ignora el esquema (el esquema estricto ya lo impide)
    iaSimulada({
      resumen: "Tienda online de cerámica.",
      servicios: [
        { id: "corporativa", cantidad: 1, justificacion: "Varias secciones." },
        { id: "tiendaOnline", cantidad: 1, justificacion: "Para vender online." },
        { id: "blog", cantidad: 1, justificacion: "Para publicar noticias." },
      ],
      dudas: [],
      pendientes: [],
    });
    const { json } = await proponer(solicitud);
    assert.deepEqual(json.propuesta.servicios.map((s) => s.id), ["corporativa"]);
    assert.equal(json.avisos.filter((a) => /no existe en el catálogo/.test(a)).length, 2);

    // Y tampoco se puede colar al calcular
    const calculo = await calcular([{ id: "corporativa" }, { id: "tiendaOnline" }]);
    assert.equal(calculo.status, 400);
  });

  test("si la IA inventa precios o plazos, el servidor los retira", async () => {
    iaSimulada({
      resumen: "Tienda online lista en 3 semanas por 1.500 €.",
      servicios: [{ id: "corporativa", cantidad: 1, justificacion: "Incluye la tienda por solo 200 euros más." }],
      dudas: [],
      pendientes: ["Tienda online (la entregamos en 10 días)"],
    });
    const { json } = await proponer(solicitud);
    const texto = JSON.stringify(json.propuesta);
    assert.doesNotMatch(texto, /€|euros|semanas|días/);
    assert.equal(json.avisos.length, 3);
  });
});

// ── 4. Descripción vacía ────────────────────────────────────────────────
describe("4 · Descripción vacía", () => {
  for (const [nombre, descripcion] of [
    ["cadena vacía", ""],
    ["solo espacios y saltos de línea", "   \n\t  "],
    ["campo ausente", undefined],
  ]) {
    test(`${nombre} → 400 y no se llama a OpenAI`, async () => {
      const ia = iaSimulada({});
      const { status, json } = await proponer({ cliente: "Cliente Ficticio", descripcion });
      assert.equal(status, 400);
      assert.equal(json.error, "Solicitud no válida.");
      assert.ok(json.detalles.some((d) => /descripcion/.test(d)));
      assert.equal(ia.llamadas, 0);
    });
  }
});

// ── 5. Fallo en la llamada a OpenAI ─────────────────────────────────────
describe("5 · Fallo en la llamada a OpenAI", () => {
  const solicitud = {
    cliente: "Restaurante La Brasa Imaginaria",
    descripcion: "Necesito una web para un restaurante con la carta y un formulario de reservas.",
  };

  const errorSDK = (Clase, status, mensaje) =>
    new Clase(status, { error: { message: mensaje } }, mensaje, new Headers());

  for (const [nombre, comportamiento, mensaje] of [
    ["clave no válida (401)", () => { throw errorSDK(OpenAI.AuthenticationError, 401, "Incorrect API key"); }, /no está disponible/],
    ["límite de uso (429)", () => { throw errorSDK(OpenAI.RateLimitError, 429, "Rate limit reached"); }, /saturado/],
    ["error del servidor de OpenAI (500)", () => { throw errorSDK(OpenAI.InternalServerError, 500, "Server error"); }, /No se pudo contactar/],
    ["tiempo de espera agotado", () => { throw new OpenAI.APIConnectionTimeoutError(); }, /tardado demasiado/],
    ["sin conexión", () => { throw new OpenAI.APIConnectionError({ message: "fetch failed" }); }, /No se pudo contactar/],
    ["respuesta incompleta", () => ({ status: "incomplete", output: [], output_text: "" }), /no completó/],
    ["respuesta que no es JSON", () => ({ status: "completed", output: [], output_text: "Lo siento, no puedo" }), /no es un JSON válido/],
    ["rechazo del modelo", () => ({ status: "completed", output: [{ content: [{ type: "refusal", refusal: "No" }] }], output_text: "" }), /rechazó/],
  ]) {
    test(`${nombre} → 502 con mensaje claro y sin exponer detalles internos`, async () => {
      iaSimulada(comportamiento);
      const { status, json } = await proponer(solicitud);
      assert.equal(status, 502);
      assert.match(json.error, mensaje);
      assert.doesNotMatch(JSON.stringify(json), /Incorrect API key|stack|sk-/);
    });
  }

  test("sin OPENAI_API_KEY → 503", async () => {
    app.set("clienteIA", undefined);
    const clave = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const { status, json } = await proponer(solicitud);
      assert.equal(status, 503);
      assert.match(json.detalles[0], /OPENAI_API_KEY/);
    } finally {
      if (clave !== undefined) process.env.OPENAI_API_KEY = clave;
    }
  });

  test("tras un fallo, el resto de la aplicación sigue funcionando", async () => {
    iaSimulada(() => { throw new OpenAI.APIConnectionError({ message: "fetch failed" }); });
    assert.equal((await proponer(solicitud)).status, 502);
    // El configurador manual y el cálculo no dependen de la IA
    const calculo = await calcular([{ id: "landing" }, { id: "formulario" }]);
    assert.equal(calculo.json.total, 380);
    const estado = await fetch(`${url}/api/estado`);
    assert.equal(estado.status, 200);
  });
});

// ── 6. Modificación de los servicios antes de descargar el PDF ──────────
describe("6 · Modificación de los servicios antes de descargar el PDF", () => {
  test("el PDF refleja la selección modificada y no los importes que envíe el navegador", async () => {
    iaSimulada({
      resumen: "Web para un restaurante con carta, reservas y dos idiomas.",
      servicios: [
        { id: "corporativa", cantidad: 1, justificacion: "Varias secciones." },
        { id: "paginaAdicional", cantidad: 2, justificacion: "Carta y reservas." },
        { id: "formulario", cantidad: 1, justificacion: "Reservas." },
        { id: "segundoIdioma", cantidad: 1, justificacion: "Dos idiomas." },
      ],
      dudas: ["¿Qué segundo idioma necesitas?"],
      pendientes: [],
    });
    const { json } = await proponer({
      cliente: "Restaurante La Brasa Imaginaria",
      descripcion: "Necesito una web para un restaurante con carta, reservas y dos idiomas.",
    });
    const original = await calcular(seleccionDe(json.propuesta.servicios));
    assert.equal(original.json.total, 930);

    // El usuario cambia a landing, elimina el segundo idioma y pide 4 páginas adicionales
    const modificada = [{ id: "landing" }, { id: "paginaAdicional", cantidad: 4 }, { id: "formulario" }];
    const recalculo = await calcular(modificada);
    assert.equal(recalculo.json.total, 580); // 300 + 4×50 + 80

    // Edita también el resumen y las aclaraciones, e intenta colar otro total
    const cuerpo = {
      cliente: json.cliente,
      resumen: "Landing para el restaurante con carta y reservas, solo en español.",
      servicios: modificada,
      dudas: [],
      pendientes: ["Versión en inglés más adelante"],
      total: 1,
      desglose: { total: 1, lineas: [] },
    };
    const r = prepararDocumento(cuerpo);
    assert.ok(r.ok);
    assert.equal(r.documento.desglose.total, 580);
    assert.deepEqual(r.documento.servicios.map((s) => s.nombre), ["Landing page", "Página adicional", "Formulario de contacto"]);
    assert.equal(r.documento.resumen, cuerpo.resumen);
    assert.deepEqual(r.documento.pendientes, ["Versión en inglés más adelante"]);

    const documento = await pdf(cuerpo);
    assert.equal(documento.status, 200);
    assert.equal(documento.bytes.subarray(0, 5).toString(), "%PDF-");
  });

  test("una modificación que deja la selección incompleta impide generar el PDF", async () => {
    const sinPaginas = await pdf({
      cliente: "Restaurante La Brasa Imaginaria",
      resumen: "Web para un restaurante.",
      servicios: [{ id: "landing" }, { id: "paginaAdicional" }],
    });
    assert.equal(sinPaginas.status, 400);
    const error = JSON.parse(sinPaginas.bytes.toString());
    assert.ok(error.detalles.some((d) => /páginas adicionales/.test(d)));
  });
});
