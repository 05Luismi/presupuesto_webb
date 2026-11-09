// Límite de peticiones por IP con ventana deslizante, en memoria.
// Evita que alguien gaste los créditos del LLM lanzando peticiones sin parar.
//
// Limitación: la memoria es de cada proceso. Con varias instancias (p. ej. funciones
// serverless) cada una lleva su propia cuenta; para algo estricto haría falta un
// almacén compartido (Redis, Upstash…).

const registros = new Map<string, number[]>()

export function comprobarLimite(
  clave: string,
  { maximo, ventanaMs }: { maximo: number; ventanaMs: number }
): { permitido: true } | { permitido: false; reintentarEnS: number } {
  const ahora = Date.now()
  const recientes = (registros.get(clave) ?? []).filter(
    (t) => ahora - t < ventanaMs
  )

  if (recientes.length >= maximo) {
    registros.set(clave, recientes)
    return {
      permitido: false,
      reintentarEnS: Math.ceil((recientes[0] + ventanaMs - ahora) / 1000),
    }
  }

  recientes.push(ahora)
  registros.set(clave, recientes)

  // Limpieza ocasional para que el mapa no crezca sin límite
  if (registros.size > 5000) {
    for (const [k, v] of registros) {
      if (v.every((t) => ahora - t >= ventanaMs)) registros.delete(k)
    }
  }
  return { permitido: true }
}
