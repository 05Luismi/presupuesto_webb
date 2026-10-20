import path from "node:path"
import type { NextConfig } from "next"
import { PHASE_PRODUCTION_BUILD } from "next/constants"

export default function config(phase: string): NextConfig {
  const base: NextConfig = {
    // La carpeta web/ es la raíz del proyecto Next (evita el aviso
    // "Next.js inferred your workspace root" por el package-lock.json de la API)
    turbopack: { root: path.resolve(".") },
  }

  // Al compilar (Vercel) se genera una web estática en web/out.
  // La API de Express se sirve en el mismo dominio desde api/index.js.
  if (phase === PHASE_PRODUCTION_BUILD) {
    return { ...base, output: "export" }
  }

  // En local, las llamadas /api/... se redirigen a la API de Express (puerto 4000)
  return {
    ...base,
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:4000/api/:path*",
        },
      ]
    },
  }
}
