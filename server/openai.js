import OpenAI from "openai";

// La clave se lee SOLO de la variable de entorno OPENAI_API_KEY
// (archivo .env en local, panel de Vercel en producción). Nunca va al navegador.
export const obtenerModelo = () => process.env.OPENAI_MODEL || "gpt-5-mini";

let cliente = null;

/** Devuelve el cliente de OpenAI o null si no hay clave configurada. */
export function obtenerClienteOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  cliente ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
  return cliente;
}
