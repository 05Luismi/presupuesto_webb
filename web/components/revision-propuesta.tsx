"use client"

import { useEffect, useState } from "react"
import {
  AlertCircleIcon,
  CalculatorIcon,
  CheckIcon,
  ClipboardListIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { DocumentoPresupuesto } from "@/components/documento-presupuesto"

export type ServicioPropuesto = {
  id: string
  nombre: string
  categoria: "base" | "extra"
  cantidad: number
  justificacion: string
}

type ServicioCatalogo = {
  id: string
  nombre: string
  categoria: "base" | "extra"
  descripcion: string
  precio: number
  regla: string
}

type Estado = "propuesto" | "aceptado" | "eliminado"

type Item = {
  id: string
  origen: "ia" | "usuario"
  estado: Estado
  justificacion?: string
  cantidad: string // solo se usa en "paginaAdicional"
}

type Seleccion = { id: string; cantidad?: number }[]

type Linea = {
  id: string
  nombre: string
  cantidad: number
  precioUnitario: number
  importe: number
}

type Calculo =
  | {
      ok: true
      lineas: Linea[]
      total: number
      moneda: string
      seleccion: Seleccion
    }
  | { ok: false; status: number; error: string; detalles: string[] }

const MAX_PAGINAS_ADICIONALES = 19

const euros = (n: number) =>
  n.toLocaleString("es-ES", { useGrouping: "always" }) + " €"

function cantidadValida(texto: string) {
  const n = Number(texto)
  return (
    texto.trim() !== "" &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= MAX_PAGINAS_ADICIONALES
  )
}

export function RevisionPropuesta({
  propuestos,
  cliente,
  resumen,
  dudas,
  pendientes,
}: {
  propuestos: ServicioPropuesto[]
  cliente: string
  resumen: string
  dudas: string[]
  pendientes: string[]
}) {
  const [catalogo, setCatalogo] = useState<ServicioCatalogo[]>([])
  const [items, setItems] = useState<Item[]>(() =>
    propuestos.map((s) => ({
      id: s.id,
      origen: "ia",
      estado: "propuesto",
      justificacion: s.justificacion,
      cantidad: String(s.cantidad),
    }))
  )
  const [cargando, setCargando] = useState(false)
  const [calculo, setCalculo] = useState<Calculo | null>(null)

  useEffect(() => {
    fetch("/api/catalogo")
      .then((r) => r.json())
      .then((d) => setCatalogo(d.servicios))
      .catch(() => setCatalogo([]))
  }, [])

  const servicio = (id: string) => catalogo.find((s) => s.id === id)
  const nombre = (id: string) =>
    servicio(id)?.nombre ?? propuestos.find((p) => p.id === id)?.nombre ?? id
  const esBase = (id: string) =>
    (servicio(id)?.categoria ??
      propuestos.find((p) => p.id === id)?.categoria) === "base"

  const activos = items.filter((i) => i.estado !== "eliminado")
  const baseActiva = activos.find((i) => esBase(i.id))

  // Lo que falta antes de poder calcular
  const paginas = activos.find((i) => i.id === "paginaAdicional")
  const faltan = [
    ...items
      .filter((i) => i.estado === "propuesto")
      .map((i) => `Acepta o elimina «${nombre(i.id)}».`),
    ...(baseActiva
      ? []
      : ["Elige el tipo de web (Landing page o Web corporativa)."]),
    ...(paginas && !cantidadValida(paginas.cantidad)
      ? [
          `Indica cuántas páginas adicionales necesitas (de 1 a ${MAX_PAGINAS_ADICIONALES}).`,
        ]
      : []),
  ]

  function cambiar(actualizar: (items: Item[]) => Item[]) {
    setItems(actualizar)
    setCalculo(null) // cualquier cambio invalida el cálculo anterior
  }

  const fijarEstado = (id: string, estado: Estado) =>
    cambiar((prev) =>
      prev
        // Lo añadido por el usuario se quita sin dejar rastro
        .filter(
          (i) =>
            !(i.id === id && estado === "eliminado" && i.origen === "usuario")
        )
        .map((i) => (i.id === id ? { ...i, estado } : i))
    )

  function recuperar(id: string) {
    cambiar((prev) =>
      quitarOtraBase(prev, id).map((i) =>
        i.id === id ? { ...i, estado: "aceptado" } : i
      )
    )
  }

  function anadir(id: string) {
    cambiar((prev) => [
      ...quitarOtraBase(prev, id),
      // Las páginas adicionales se añaden vacías: el usuario debe indicar cuántas
      { id, origen: "usuario", estado: "aceptado", cantidad: "" },
    ])
  }

  // Solo puede haber un tipo de web: al elegir otro, el anterior se elimina
  function quitarOtraBase(prev: Item[], id: string) {
    if (!esBase(id)) return prev
    return prev
      .filter((i) => !(esBase(i.id) && i.id !== id && i.origen === "usuario"))
      .map((i) =>
        esBase(i.id) && i.id !== id ? { ...i, estado: "eliminado" as const } : i
      )
  }

  const setCantidad = (id: string, cantidad: string) =>
    cambiar((prev) => prev.map((i) => (i.id === id ? { ...i, cantidad } : i)))

  const disponibles = catalogo.filter((s) => !items.some((i) => i.id === s.id))

  async function calcular() {
    if (faltan.length > 0) return
    setCargando(true)
    try {
      // Solo se envían ids y cantidad; los importes los pone el servidor
      const seleccion: Seleccion = activos.map((i) =>
        i.id === "paginaAdicional"
          ? { id: i.id, cantidad: Number(i.cantidad) }
          : { id: i.id }
      )
      const res = await fetch("/api/presupuesto/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicios: seleccion,
        }),
      })
      const datos = await res.json()
      if (res.ok) {
        setCalculo({ ok: true, ...datos, seleccion })
      } else {
        setCalculo({
          ok: false,
          status: res.status,
          error: datos.error,
          detalles: datos.detalles ?? [],
        })
      }
    } catch {
      setCalculo({
        ok: false,
        status: 0,
        error: "No se pudo conectar con la API.",
        detalles: ["Comprueba que el servidor de Express está arrancado."],
      })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <ClipboardListIcon className="size-4 text-primary" />
          Revisa los servicios
        </span>
        <p className="text-sm text-muted-foreground">
          Acepta o elimina cada propuesta y añade lo que eches en falta.
        </p>

        {items.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            La IA no ha propuesto servicios. Añádelos desde el catálogo.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {items.map((i) => {
            const s = servicio(i.id)
            const eliminado = i.estado === "eliminado"
            const pendiente = i.estado === "propuesto"
            const paginasInvalidas =
              i.id === "paginaAdicional" &&
              !eliminado &&
              !cantidadValida(i.cantidad)
            return (
              <li
                key={i.id}
                className={cn(
                  "flex flex-col gap-3 rounded-md border bg-background p-3",
                  pendiente && "border-primary/50",
                  i.estado === "aceptado" && "border-emerald-500/50",
                  eliminado && "opacity-60"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        eliminado && "line-through"
                      )}
                    >
                      {nombre(i.id)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {i.justificacion ?? s?.descripcion}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EstadoBadge item={i} />
                    {s && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {euros(s.precio)}
                        {i.id === "paginaAdicional" && "/pág."}
                      </span>
                    )}
                  </div>
                </div>

                {i.id === "paginaAdicional" && !eliminado && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="cantidad-paginas" className="font-normal">
                      Páginas adicionales
                    </Label>
                    <Input
                      id="cantidad-paginas"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_PAGINAS_ADICIONALES}
                      value={i.cantidad}
                      placeholder="¿Cuántas?"
                      onChange={(e) => setCantidad(i.id, e.target.value)}
                      aria-invalid={paginasInvalidas || undefined}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">
                      además de la primera (máx. {MAX_PAGINAS_ADICIONALES})
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {pendiente && (
                    <Button
                      size="sm"
                      onClick={() => fijarEstado(i.id, "aceptado")}
                    >
                      <CheckIcon /> Aceptar
                    </Button>
                  )}
                  {!eliminado && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fijarEstado(i.id, "eliminado")}
                    >
                      <Trash2Icon /> Eliminar
                    </Button>
                  )}
                  {eliminado && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recuperar(i.id)}
                    >
                      <RotateCcwIcon /> Recuperar
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {disponibles.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Añadir del catálogo</span>
          <ul className="flex flex-col gap-2">
            {disponibles.map((s) => {
              const sustituye = s.categoria === "base" && baseActiva
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{s.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.descripcion}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {euros(s.precio)}
                      {s.id === "paginaAdicional" && "/pág."}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => anadir(s.id)}
                    >
                      <PlusIcon /> {sustituye ? "Cambiar a este" : "Añadir"}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {faltan.length > 0 && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>Antes de calcular</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Button
        size="lg"
        className="h-11 text-base"
        onClick={calcular}
        disabled={cargando || faltan.length > 0}
      >
        {cargando ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <CalculatorIcon />
        )}
        {cargando ? "Calculando…" : "Confirmar selección y calcular"}
      </Button>

      {calculo?.ok && (
        <div
          className="flex flex-col gap-3 rounded-lg border bg-background p-4"
          aria-live="polite"
        >
          <span className="flex items-center justify-between gap-2 font-medium">
            Presupuesto
            <Badge variant="secondary">Calculado por el servidor</Badge>
          </span>
          {calculo.lineas.map((l) => (
            <div key={l.id} className="flex justify-between gap-4 text-sm">
              <span>
                {l.nombre}
                {l.cantidad > 1 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {l.cantidad} × {euros(l.precioUnitario)}
                  </span>
                )}
              </span>
              <span className="font-mono">{euros(l.importe)}</span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex items-end justify-between">
            <span className="font-medium">Total</span>
            <span className="text-3xl font-semibold tracking-tight text-primary">
              {euros(calculo.total)}
            </span>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {calculo.moneda} · sin impuestos
          </p>
        </div>
      )}

      {calculo?.ok && (
        <>
          <Separator />
          <DocumentoPresupuesto
            cliente={cliente}
            resumenInicial={resumen}
            dudasIniciales={dudas}
            pendientesIniciales={pendientes}
            seleccion={calculo.seleccion}
            desglose={calculo.lineas}
            total={calculo.total}
            descripciones={Object.fromEntries(
              catalogo.map((s) => [s.id, s.descripcion])
            )}
          />
        </>
      )}

      {calculo && !calculo.ok && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{calculo.error}</AlertTitle>
          {calculo.detalles.length > 0 && (
            <AlertDescription>
              <ul className="list-inside list-disc">
                {calculo.detalles.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  )
}

function EstadoBadge({ item }: { item: Item }) {
  if (item.estado === "eliminado")
    return <Badge variant="outline">Eliminado</Badge>
  if (item.estado === "propuesto") return <Badge>Propuesto por la IA</Badge>
  return (
    <Badge variant="secondary" className="gap-1">
      <CheckIcon className="size-3" />
      {item.origen === "ia" ? "Aceptado" : "Añadido por ti"}
    </Badge>
  )
}
