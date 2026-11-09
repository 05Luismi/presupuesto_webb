import express from "express";
import { TARIFAS, MONEDA } from "./tarifas.js";
import { CATALOGO } from "./catalogo.js";
import { validarSolicitud } from "./validar.js";
import { calcularPresupuesto } from "./calcular.js";
import { validarSolicitudCliente, LIMITES_SOLICITUD } from "./validarSolicitudCliente.js";
import { pedirPropuestaIA, validarPropuesta, ErrorIA } from "./propuesta.js";
import { obtenerClienteOpenAI, obtenerModelo } from "./openai.js";
import { validarSeleccion, desglosarSeleccion } from "./seleccion.js";
import { prepararDocumento, nombreArchivo } from "./documento.js";
import { generarPDF } from "./pdf.js";

const app = express();
app.use(express.json());

// GET / → redirige a la comprobación de estado
app.get("/", (req, res) => {
  res.redirect("/api/estado");
});

// GET /api/estado → comprueba que el servicio está vivo
app.get("/api/estado", (req, res) => {
  res.json({ status: "ok" });
});

// GET /api/tarifas → publica las tarifas que usa el servidor
app.get("/api/tarifas", (req, res) => {
  res.json({ moneda: MONEDA, tarifas: { ...TARIFAS } });
});

// GET /api/catalogo → catálogo de servicios (referencia para las propuestas)
app.get("/api/catalogo", (req, res) => {
  res.json({ moneda: MONEDA, servicios: CATALOGO });
});

// Las rutas POST solo aceptan JSON
function exigirJson(req, res, next) {
  if (!req.is("application/json")) {
    return res.status(400).json({
      error: "La petición debe enviarse con la cabecera Content-Type: application/json.",
    });
  }
  next();
}

// GET /api/solicitud/limites → límites de longitud que aplica el servidor
app.get("/api/solicitud/limites", (req, res) => {
  res.json(LIMITES_SOLICITUD);
});

// POST /api/solicitud → recoge y valida la explicación del cliente
app.post("/api/solicitud", exigirJson, (req, res) => {
  const resultado = validarSolicitudCliente(req.body);
  if (!resultado.ok) {
    return res.status(400).json({ error: "Solicitud no válida.", detalles: resultado.errores });
  }
  res.status(200).json({ recibida: true, solicitud: resultado.datos });
});

// POST /api/propuesta → la IA propone servicios del catálogo y el servidor los comprueba
app.post("/api/propuesta", exigirJson, async (req, res, next) => {
  const resultado = validarSolicitudCliente(req.body);
  if (!resultado.ok) {
    return res.status(400).json({ error: "Solicitud no válida.", detalles: resultado.errores });
  }

  // En las pruebas se inyecta un cliente simulado con app.set("clienteIA", …)
  const clienteIA = req.app.get("clienteIA") ?? obtenerClienteOpenAI();
  if (!clienteIA) {
    return res.status(503).json({
      error: "El asistente de IA no está configurado.",
      detalles: ["Falta la variable de entorno OPENAI_API_KEY en el servidor."],
    });
  }

  try {
    const bruta = await pedirPropuestaIA(clienteIA, resultado.datos, { modelo: obtenerModelo() });
    const { propuesta, avisos } = validarPropuesta(bruta);
    res.status(200).json({ cliente: resultado.datos.cliente, propuesta, avisos });
  } catch (err) {
    if (err instanceof ErrorIA) {
      console.error("[IA]", err.message, err.cause?.message ?? "");
      return res.status(502).json({ error: err.message, detalles: ["Inténtalo de nuevo en unos segundos."] });
    }
    next(err);
  }
});

// POST /api/presupuesto/servicios → calcula la selección confirmada tras revisar la propuesta
app.post("/api/presupuesto/servicios", exigirJson, (req, res) => {
  const resultado = validarSeleccion(req.body);
  if (!resultado.ok) {
    return res.status(400).json({ error: "Selección no válida.", detalles: resultado.errores });
  }
  res.status(200).json(desglosarSeleccion(resultado.datos));
});

// POST /api/presupuesto/pdf → genera el PDF con el contenido revisado por el usuario.
// Los importes se recalculan aquí; ?vista=1 lo devuelve para verlo en el navegador.
app.post("/api/presupuesto/pdf", exigirJson, async (req, res, next) => {
  const ahora = new Date();
  const resultado = prepararDocumento(req.body, ahora);
  if (!resultado.ok) {
    return res.status(400).json({ error: "No se puede generar el documento.", detalles: resultado.errores });
  }
  try {
    const pdf = await generarPDF(resultado.documento);
    const disposicion = req.query.vista === "1" ? "inline" : "attachment";
    res
      .status(200)
      .type("application/pdf")
      .set("Content-Disposition", `${disposicion}; filename="${nombreArchivo(resultado.documento.cliente, ahora)}"`)
      .set("Cache-Control", "no-store")
      .send(pdf);
  } catch (err) {
    next(err);
  }
});

// POST /api/presupuesto → valida y después calcula
app.post("/api/presupuesto", exigirJson, (req, res) => {
  const resultado = validarSolicitud(req.body);
  if (!resultado.ok) {
    return res.status(400).json({ error: "Solicitud no válida.", detalles: resultado.errores });
  }

  res.status(200).json(calcularPresupuesto(resultado.datos));
});

// Rutas desconocidas
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// JSON mal formado u otros errores
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo no es un JSON válido." });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

export default app;
