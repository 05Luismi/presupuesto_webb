// POST /api/ia/propuesta — Route Handler de Next.js que hace de pasarela con OpenAI.
//
//  · Seguridad: se ejecuta solo en el servidor. La clave se lee de
//    process.env.OPENAI_API_KEY (archivo .env de la raíz) y nunca llega al navegador.
//  · Pasarela: recibe { cliente, descripcion }, la empaqueta con el catálogo y el
//    esquema de salida, llama a OpenAI y devuelve la propuesta validada.
//  · Streaming: va enviando el resumen palabra por palabra y los servicios a medida
//    que el modelo los escribe (NDJSON: un objeto JSON por línea).
//  · Control de acceso: comprueba el origen y limita las peticiones por IP ANTES de
//    gastar créditos del LLM.
//
// La validación es la misma que usa Express (carpeta server/): la IA propone, pero
// el servidor decide qué se envía como propuesta final.

import type { NextRequest } from "next/server"

import { buscarServicio } from "@servidor/catalogo.js"
import { obtenerClienteOpenAI, obtenerModelo } from "@servidor/openai.js"
import {
  construirPeticion,
  contieneCompromiso,
  mensajeDeFallo,
  validarPropuesta,
} from "@servidor/propuesta.js"
import { validarSolicitudCliente } from "@servidor/validarSolicitudCliente.js"
import { comprobarLimite } from "@/lib/limite-peticiones"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const LIMITE = { maximo: 5, ventanaMs: 60_000 } // 5 propuestas por minuto e IP

type Evento =
  | { tipo: "resumen"; texto: string }
  | { tipo: "servicio"; id: string; nombre: string }
  | { tipo: "fin"; cliente: string; propuesta: unknown; avisos: string[] }
  | { tipo: "error"; error: string; detalles: string[] }

const errorJson = (
  status: number,
  error: string,
  detalles: string[] = [],
  cabeceras?: HeadersInit
) => Response.json({ error, detalles }, { status, headers: cabeceras })

function ipDe(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  )
}

// Solo se aceptan peticiones hechas desde nuestra propia web
function origenPermitido(request: NextRequest) {
  const origen = request.headers.get("origin")
  if (!origen) return true // peticiones sin navegador (curl, pruebas): las frena el límite por IP
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origen).host === host
  } catch {
    return false
  }
}

// Extrae el valor (posiblemente incompleto) de "resumen" del JSON que va llegando
function resumenParcial(json: string): string | null {
  const m = json.match(/"resumen"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!m) return null
  let crudo = m[1]
  // Si el trozo termina a mitad de una secuencia de escape, se espera al siguiente
  crudo = crudo.replace(/\\(u[0-9a-fA-F]{0,3})?$/, "")
  try {
    return JSON.parse(`"${crudo}"`) as string
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  // ── 1. Control de acceso (antes de gastar créditos) ─────────────────
  if (!origenPermitido(request)) {
    return errorJson(403, "Origen no permitido.")
  }
  // Aquí se comprobaría la sesión del usuario si la aplicación tuviera login.

  const limite = comprobarLimite(`propuesta:${ipDe(request)}`, LIMITE)
  if (!limite.permitido) {
    return errorJson(
      429,
      "Has hecho demasiadas solicitudes seguidas.",
      [`Espera ${limite.reintentarEnS} s y vuelve a intentarlo.`],
      { "Retry-After": String(limite.reintentarEnS) }
    )
  }

  // ── 2. Validación de la entrada ─────────────────────────────────────
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorJson(
      400,
      "La petición debe enviarse con la cabecera Content-Type: application/json."
    )
  }
  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return errorJson(400, "El cuerpo no es un JSON válido.")
  }
  const validacion = validarSolicitudCliente(cuerpo)
  if (!validacion.ok || !validacion.datos) {
    return errorJson(400, "Solicitud no válida.", validacion.errores ?? [])
  }
  const solicitud: { cliente: string; descripcion: string } = validacion.datos

  const clienteIA = obtenerClienteOpenAI()
  if (!clienteIA) {
    return errorJson(503, "El asistente de IA no está configurado.", [
      "Falta la variable de entorno OPENAI_API_KEY en el servidor.",
    ])
  }

  // ── 3. Llamada a OpenAI con streaming ───────────────────────────────
  let flujoIA
  try {
    flujoIA = await clienteIA.responses.create(
      { ...construirPeticion(solicitud, obtenerModelo()), stream: true },
      // Si el usuario cierra la página, se corta la llamada y no se siguen gastando tokens
      { signal: request.signal }
    )
  } catch (err) {
    console.error("[IA]", (err as Error).message)
    return errorJson(502, mensajeDeFallo(err), [
      "Inténtalo de nuevo en unos segundos.",
    ])
  }

  const codificador = new TextEncoder()

  const cuerpoRespuesta = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const enviar = (evento: Evento) =>
        controlador.enqueue(codificador.encode(JSON.stringify(evento) + "\n"))

      let acumulado = ""
      let resumenEnviado = ""
      let resumenBloqueado = false
      const serviciosEnviados = new Set<string>()

      try {
        for await (const evento of flujoIA) {
          if (evento.type === "response.output_text.delta") {
            acumulado += evento.delta

            // Resumen palabra por palabra. Solo se envían palabras completas y se
            // deja de mostrar en cuanto aparece una cifra o un importe/plazo: así
            // no se filtra a medias un precio que luego retirará validarPropuesta.
            // (El resumen definitivo, ya validado, llega en el evento "fin".)
            const parcial = resumenParcial(acumulado)
            const cerrado = /"resumen"\s*:\s*"(?:[^"\\]|\\.)*"/.test(acumulado)
            const resumen =
              parcial === null
                ? null
                : cerrado
                  ? parcial
                  : parcial.slice(0, parcial.lastIndexOf(" ") + 1)
            if (resumen !== null && !resumenBloqueado) {
              if (/\d/.test(parcial ?? "") || contieneCompromiso(resumen)) {
                resumenBloqueado = true
              } else if (resumen.length > resumenEnviado.length) {
                enviar({
                  tipo: "resumen",
                  texto: resumen.slice(resumenEnviado.length),
                })
                resumenEnviado = resumen
              }
            }

            // Servicios a medida que aparecen (solo ids que existen en el catálogo)
            for (const [, id] of acumulado.matchAll(
              /"id"\s*:\s*"([A-Za-z]+)"/g
            )) {
              const servicio = buscarServicio(id)
              if (servicio && !serviciosEnviados.has(id)) {
                serviciosEnviados.add(id)
                enviar({ tipo: "servicio", id, nombre: servicio.nombre })
              }
            }
          } else if (evento.type === "response.refusal.delta") {
            throw new Error("La IA rechazó procesar la solicitud.")
          } else if (
            evento.type === "response.incomplete" ||
            evento.type === "response.failed"
          ) {
            throw new Error(
              `La IA no completó la respuesta (estado: ${evento.response.status}).`
            )
          } else if (evento.type === "error") {
            throw new Error("El servicio de IA devolvió un error.")
          }
        }

        // ── 4. Validación final en el servidor ─────────────────────────
        let bruta: unknown
        try {
          bruta = JSON.parse(acumulado)
        } catch {
          throw new Error("La respuesta de la IA no es un JSON válido.")
        }
        const { propuesta, avisos } = validarPropuesta(bruta)
        enviar({ tipo: "fin", cliente: solicitud.cliente, propuesta, avisos })
      } catch (err) {
        if (request.signal.aborted) return // el usuario se fue: no hay a quién responder
        const mensaje =
          err instanceof Error && err.message.startsWith("La ")
            ? err.message
            : mensajeDeFallo(err)
        console.error("[IA]", (err as Error).message)
        enviar({
          tipo: "error",
          error: mensaje,
          detalles: ["Inténtalo de nuevo en unos segundos."],
        })
      } finally {
        try {
          controlador.close()
        } catch {
          // ya cerrado
        }
      }
    },
  })

  return new Response(cuerpoRespuesta, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no", // evita que un proxy acumule la respuesta
    },
  })
}
