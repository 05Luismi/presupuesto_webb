import path from "node:path"
import { loadEnvConfig } from "@next/env"
import type { NextConfig } from "next"

// Carpeta raíz del proyecto (la que contiene server/ y el archivo .env)
const raiz = path.resolve("..")

// Carga el .env de la raíz en process.env SOLO en el servidor de Next, para que
// el Route Handler (app/api/ia/propuesta/route.ts) lea OPENAI_API_KEY.
// Las variables sin el prefijo NEXT_PUBLIC_ nunca se envían al navegador.
loadEnvConfig(raiz)

const config: NextConfig = {
  // La raíz de Turbopack es la carpeta del proyecto: así el Route Handler puede
  // reutilizar la validación de server/ (catálogo, esquema, comprobaciones).
  turbopack: { root: raiz },

  // El resto de rutas /api/... las atiende la API de Express (puerto 4000).
  // Son rewrites "afterFiles": las rutas propias de Next (route.ts) tienen prioridad.
  async rewrites() {
    const api = process.env.API_URL || "http://localhost:4000"
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }]
  },
}

export default config
