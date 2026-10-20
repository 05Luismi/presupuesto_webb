import express from "express";
import { TARIFAS, MONEDA } from "./tarifas.js";
import { validarSolicitud } from "./validar.js";
import { calcularPresupuesto } from "./calcular.js";

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

// POST /api/presupuesto → valida y después calcula
app.post("/api/presupuesto", (req, res) => {
  if (!req.is("application/json")) {
    return res.status(400).json({
      error: "La petición debe enviarse con la cabecera Content-Type: application/json.",
    });
  }

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
