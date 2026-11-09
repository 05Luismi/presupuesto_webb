"use client"

import { useEffect, useState } from "react"
import {
  AlertCircleIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  Loader2Icon,
  PencilIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type LineaPresupuesto = {
  id: string
  nombre: string
  cantidad: number
  precioUnitario: number
  importe: number
}

// Mismos límites que server/documento.js (el servidor es quien los aplica)
const RESUMEN_MAX = 800
const NOTAS_MAX = 15
const NOTA_MAX = 300

const euros = (n: number) =>
  n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: "always",
  }) + " €"

const lineas = (texto: string) =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

type ErrorDocumento = { error: string; detalles: string[] }

export function DocumentoPresupuesto({
  cliente,
  resumenInicial,
  dudasIniciales,
  pendientesIniciales,
  seleccion,
  desglose,
  total,
  descripciones,
}: {
  cliente: string
  resumenInicial: string
  dudasIniciales: string[]
  pendientesIniciales: string[]
  seleccion: { id: string; cantidad?: number }[]
  desglose: LineaPresupuesto[]
  total: number
  descripciones: Record<string, string>
}) {
  const [resumen, setResumen] = useState(resumenInicial)
  const [dudas, setDudas] = useState(dudasIniciales.join("\n"))
  const [pendientes, setPendientes] = useState(pendientesIniciales.join("\n"))

  const [vista, setVista] = useState<{ url: string; archivo: string } | null>(
    null
  )
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<ErrorDocumento | null>(null)

  // Libera la URL del PDF anterior al cambiar o al desmontar
  useEffect(() => {
    if (!vista) return
    return () => URL.revokeObjectURL(vista.url)
  }, [vista])

  const fecha = new Date().toLocaleDateString("es-ES", { dateStyle: "long" })
  const listaDudas = lineas(dudas)
  const listaPendientes = lineas(pendientes)

  const faltan = [
    ...(resumen.trim() === "" ? ["Escribe un resumen del proyecto."] : []),
    ...(resumen.trim().length > RESUMEN_MAX
      ? [`El resumen admite como máximo ${RESUMEN_MAX} caracteres.`]
      : []),
    ...([listaDudas, listaPendientes].some((l) => l.length > NOTAS_MAX)
      ? [`Cada lista de aclaraciones admite como máximo ${NOTAS_MAX} líneas.`]
      : []),
    ...([...listaDudas, ...listaPendientes].some((l) => l.length > NOTA_MAX)
      ? [`Cada aclaración admite como máximo ${NOTA_MAX} caracteres.`]
      : []),
  ]

  async function generarVistaPrevia() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch("/api/presupuesto/pdf?vista=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No se envían importes: el servidor los recalcula
        body: JSON.stringify({
          cliente,
          resumen,
          servicios: seleccion,
          dudas: listaDudas,
          pendientes: listaPendientes,
        }),
      })
      if (!res.ok) {
        const datos = await res.json().catch(() => ({}))
        setError({
          error: datos.error ?? `Error ${res.status} al generar el PDF.`,
          detalles: datos.detalles ?? [],
        })
        return
      }
      const archivo =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "presupuesto.pdf"
      const blob = await res.blob()
      setVista({ url: URL.createObjectURL(blob), archivo })
    } catch {
      setError({
        error: "No se pudo conectar con la API.",
        detalles: ["Comprueba que el servidor de Express está arrancado."],
      })
    } finally {
      setCargando(false)
    }
  }

  // Se descarga exactamente el PDF que se ha previsualizado
  function descargar() {
    if (!vista) return
    const a = document.createElement("a")
    a.href = vista.url
    a.download = vista.archivo
    a.click()
  }

  if (vista) {
    return (
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <EyeIcon className="size-4 text-primary" />
          Vista previa del PDF
        </span>
        <p className="text-sm text-muted-foreground">
          Comprueba el documento. Si todo está bien, acéptalo para descargarlo.
        </p>
        <iframe
          src={vista.url}
          title="Vista previa del presupuesto en PDF"
          className="h-[75vh] w-full rounded-lg border bg-white"
        />
        <a
          href={vista.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 self-end text-xs text-muted-foreground underline underline-offset-2"
        >
          ¿No se ve? Ábrelo en otra pestaña{" "}
          <ExternalLinkIcon className="size-3" />
        </a>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="h-11 flex-1 text-base"
            onClick={descargar}
          >
            <DownloadIcon /> Aceptar y descargar PDF
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11"
            onClick={() => setVista(null)}
          >
            <PencilIcon /> Seguir editando
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <FileTextIcon className="size-4 text-primary" />
          Revisa el documento
        </span>
        <p className="text-sm text-muted-foreground">
          Este es el contenido del PDF. Puedes retocar el resumen y las
          aclaraciones; los servicios y los importes vienen del servidor.
        </p>
      </div>

      {/* Hoja con el mismo orden que el PDF */}
      <article className="flex flex-col gap-5 rounded-lg border bg-background p-4 shadow-sm sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-2 border-t-4 border-primary pt-4">
          <div>
            <p className="font-semibold">
              Presupuesta <span className="text-primary">mi web</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Agencia de desarrollo web
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold tracking-tight">PRESUPUESTO</p>
            <p className="text-xs text-muted-foreground">{fecha}</p>
          </div>
        </header>

        <div className="flex flex-wrap justify-between gap-2 rounded-md bg-primary/10 p-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-wide text-muted-foreground">
              CLIENTE
            </p>
            <p className="font-semibold break-words">{cliente}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-wide text-muted-foreground">
              FECHA
            </p>
            <p className="text-sm font-semibold">{fecha}</p>
          </div>
        </div>

        <Seccion titulo="Resumen del proyecto">
          <Label htmlFor="doc-resumen" className="sr-only">
            Resumen del proyecto
          </Label>
          <Textarea
            id="doc-resumen"
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            placeholder="Describe en pocas frases el proyecto."
            aria-invalid={
              resumen.trim() === "" ||
              resumen.trim().length > RESUMEN_MAX ||
              undefined
            }
            className="min-h-20"
          />
          <p
            className={cn(
              "text-right font-mono text-xs text-muted-foreground",
              resumen.trim().length > RESUMEN_MAX && "text-destructive"
            )}
          >
            {resumen.trim().length} / {RESUMEN_MAX}
          </p>
        </Seccion>

        <Seccion titulo="Servicios incluidos">
          <ul className="flex flex-col gap-2">
            {desglose.map((l) => (
              <li key={l.id}>
                <p className="text-sm font-medium">{l.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {descripciones[l.id]}
                </p>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Desglose de importes">
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-sm">
              <thead>
                <tr className="bg-primary/10 text-left">
                  <th className="p-2 font-medium">Concepto</th>
                  <th className="p-2 text-right font-medium">Cant.</th>
                  <th className="p-2 text-right font-medium">Precio unit.</th>
                  <th className="p-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {desglose.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="p-2">{l.nombre}</td>
                    <td className="p-2 text-right font-mono">{l.cantidad}</td>
                    <td className="p-2 text-right font-mono">
                      {euros(l.precioUnitario)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {euros(l.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between rounded-md bg-primary px-3 py-2 text-primary-foreground sm:ml-auto sm:w-1/2">
            <span className="text-sm font-semibold">TOTAL</span>
            <span className="text-lg font-semibold">{euros(total)}</span>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Importes en euros, sin impuestos.
          </p>
        </Seccion>

        <Seccion titulo="Aclaraciones y aspectos pendientes">
          <Label htmlFor="doc-dudas">Por concretar con el cliente</Label>
          <Textarea
            id="doc-dudas"
            value={dudas}
            onChange={(e) => setDudas(e.target.value)}
            placeholder="Una aclaración por línea (opcional)"
            className="min-h-16"
          />
          <Label htmlFor="doc-pendientes" className="mt-2">
            Pendiente de valorar (no incluido en el total)
          </Label>
          <Textarea
            id="doc-pendientes"
            value={pendientes}
            onChange={(e) => setPendientes(e.target.value)}
            placeholder="Una necesidad por línea (opcional)"
            className="min-h-16"
          />
          <p className="text-xs text-muted-foreground">
            Una por línea · máx. {NOTAS_MAX} líneas por lista y {NOTA_MAX}{" "}
            caracteres por línea.
          </p>
        </Seccion>
      </article>

      {faltan.length > 0 && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>Antes de generar el PDF</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{error.error}</AlertTitle>
          {error.detalles.length > 0 && (
            <AlertDescription>
              <ul className="list-inside list-disc">
                {error.detalles.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      <Button
        size="lg"
        className="h-11 text-base"
        onClick={generarVistaPrevia}
        disabled={cargando || faltan.length > 0}
      >
        {cargando ? <Loader2Icon className="animate-spin" /> : <EyeIcon />}
        {cargando ? "Generando PDF…" : "Ver vista previa del PDF"}
      </Button>
    </div>
  )
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="border-b pb-1 text-xs font-semibold tracking-wider text-primary uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  )
}
