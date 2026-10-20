"use client"

import { useEffect, useState } from "react"
import {
  AlertCircleIcon,
  CalculatorIcon,
  FileTextIcon,
  LanguagesIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  MailIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type Tipo = "landing" | "corporativa"

type Tarifas = {
  landing: number
  corporativa: number
  paginaAdicional: number
  formulario: number
  segundoIdioma: number
}

type Presupuesto = {
  base: number
  paginasAdicionales: number
  formulario: number
  segundoIdioma: number
  total: number
  moneda: string
}

type Resultado =
  | { ok: true; datos: Presupuesto; tipo: Tipo; paginas: number }
  | { ok: false; status: number; error: string; detalles: string[] }

const euros = (n: number) =>
  n.toLocaleString("es-ES", { useGrouping: "always" }) + " €"

const TIPOS: { valor: Tipo; titulo: string; descripcion: string; Icono: typeof FileTextIcon }[] = [
  {
    valor: "landing",
    titulo: "Landing",
    descripcion: "Una página enfocada a convertir.",
    Icono: FileTextIcon,
  },
  {
    valor: "corporativa",
    titulo: "Corporativa",
    descripcion: "La web completa de tu empresa.",
    Icono: LayoutTemplateIcon,
  },
]

export function PresupuestoForm() {
  const [tarifas, setTarifas] = useState<Tarifas | null>(null)
  const [apiActiva, setApiActiva] = useState<boolean | null>(null)

  const [tipo, setTipo] = useState<Tipo>("corporativa")
  const [paginas, setPaginas] = useState("4")
  const [formulario, setFormulario] = useState(true)
  const [segundoIdioma, setSegundoIdioma] = useState(false)

  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    fetch("/api/estado")
      .then((r) => r.json())
      .then((d) => setApiActiva(d.status === "ok"))
      .catch(() => setApiActiva(false))
    fetch("/api/tarifas")
      .then((r) => r.json())
      .then((d) => setTarifas(d.tarifas))
      .catch(() => setTarifas(null))
  }, [])

  const numPaginas = Number(paginas)
  const cambiarPaginas = (delta: number) =>
    setPaginas(String(Math.min(20, Math.max(1, Math.round(numPaginas || 1) + delta))))

  async function calcular(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)

    // El navegador solo envía los datos; el precio lo calcula el servidor
    const solicitud = {
      tipo,
      paginas: paginas.trim() === "" ? null : numPaginas,
      formulario,
      segundoIdioma,
    }

    try {
      const res = await fetch("/api/presupuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(solicitud),
      })
      const datos = await res.json()
      if (res.ok) {
        setResultado({ ok: true, datos, tipo, paginas: numPaginas })
      } else {
        setResultado({
          ok: false,
          status: res.status,
          error: datos.error,
          detalles: datos.detalles ?? [],
        })
      }
    } catch {
      setResultado({
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
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configura tu web</CardTitle>
          <CardDescription>
            Elige el tipo, las páginas y los extras que necesitas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={calcular} className="flex flex-col gap-7">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm font-medium">Tipo de web</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {TIPOS.map(({ valor, titulo, descripcion, Icono }) => {
                  const activo = tipo === valor
                  return (
                    <label
                      key={valor}
                      className={cn(
                        "flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        activo && "border-primary bg-primary/10 ring-1 ring-primary/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="tipo"
                        value={valor}
                        checked={activo}
                        onChange={() => setTipo(valor)}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <Icono className="size-5 text-primary" />
                        <span
                          className={cn(
                            "size-4 rounded-full border",
                            activo && "border-4 border-primary"
                          )}
                        />
                      </div>
                      <span className="font-medium">{titulo}</span>
                      <span className="text-sm text-muted-foreground">
                        {descripcion}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {tarifas ? `desde ${euros(tarifas[valor])}` : "…"}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-3">
              <Label htmlFor="paginas">Número de páginas</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Quitar una página"
                  onClick={() => cambiarPaginas(-1)}
                >
                  <MinusIcon />
                </Button>
                <Input
                  id="paginas"
                  type="number"
                  inputMode="numeric"
                  value={paginas}
                  onChange={(e) => setPaginas(e.target.value)}
                  className="h-9 text-center text-base"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Añadir una página"
                  onClick={() => cambiarPaginas(1)}
                >
                  <PlusIcon />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Entre 1 y 20. La primera está incluida; cada página adicional
                cuesta {tarifas ? euros(tarifas.paginaAdicional) : "…"}.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">Extras</span>
              <Extra
                id="formulario"
                titulo="Formulario de contacto"
                Icono={MailIcon}
                precio={tarifas?.formulario}
                activo={formulario}
                onChange={setFormulario}
              />
              <Extra
                id="segundoIdioma"
                titulo="Segundo idioma"
                Icono={LanguagesIcon}
                precio={tarifas?.segundoIdioma}
                activo={segundoIdioma}
                onChange={setSegundoIdioma}
              />
            </div>

            <Button type="submit" size="lg" className="h-11 text-base" disabled={cargando}>
              {cargando ? <Loader2Icon className="animate-spin" /> : <CalculatorIcon />}
              {cargando ? "Calculando…" : "Calcular presupuesto"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              Presupuesto
              {resultado && (
                <Badge variant={resultado.ok ? "secondary" : "destructive"}>
                  HTTP {resultado.ok ? 200 : resultado.status || "—"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Calculado por el servidor con sus tarifas.</CardDescription>
          </CardHeader>
          <CardContent>
            {!resultado && (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
                <CalculatorIcon className="size-10 text-primary opacity-60" />
                <p className="text-sm">
                  Configura tu web y pulsa <strong>Calcular presupuesto</strong>.
                </p>
              </div>
            )}

            {resultado?.ok && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Web {resultado.tipo} · {resultado.paginas}{" "}
                  {resultado.paginas === 1 ? "página" : "páginas"}
                </p>
                <Linea texto="Precio base (incluye 1ª página)" valor={resultado.datos.base} />
                <Linea
                  texto={`Páginas adicionales (${resultado.paginas - 1})`}
                  valor={resultado.datos.paginasAdicionales}
                />
                <Linea texto="Formulario de contacto" valor={resultado.datos.formulario} />
                <Linea texto="Segundo idioma" valor={resultado.datos.segundoIdioma} />
                <Separator className="my-1" />
                <div className="flex items-end justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-4xl font-semibold tracking-tight text-primary">
                    {euros(resultado.datos.total)}
                  </span>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  {resultado.datos.moneda} · sin impuestos
                </p>
              </div>
            )}

            {resultado && !resultado.ok && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{resultado.error}</AlertTitle>
                {resultado.detalles.length > 0 && (
                  <AlertDescription>
                    <ul className="list-inside list-disc">
                      {resultado.detalles.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Tarifas
              <Badge variant="outline" className="gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full bg-muted-foreground",
                    apiActiva === true && "bg-emerald-500",
                    apiActiva === false && "bg-destructive"
                  )}
                />
                {apiActiva === null ? "Conectando…" : apiActiva ? "API operativa" : "API sin conexión"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {tarifas ? (
              <>
                <Linea texto="Landing" valor={tarifas.landing} />
                <Linea texto="Web corporativa" valor={tarifas.corporativa} />
                <Linea texto="Página adicional" valor={tarifas.paginaAdicional} />
                <Linea texto="Formulario de contacto" valor={tarifas.formulario} />
                <Linea texto="Segundo idioma" valor={tarifas.segundoIdioma} />
              </>
            ) : (
              <p className="text-muted-foreground">Cargando tarifas…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Extra({
  id,
  titulo,
  Icono,
  precio,
  activo,
  onChange,
}: {
  id: string
  titulo: string
  Icono: typeof MailIcon
  precio?: number
  activo: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-4 font-normal transition-colors hover:bg-muted/50",
        activo && "border-primary bg-primary/10 ring-1 ring-primary/40"
      )}
    >
      <Icono className="size-5 text-primary" />
      <span className="flex-1 font-medium">{titulo}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {precio != null ? `+${euros(precio)}` : "…"}
      </span>
      <Switch id={id} checked={activo} onCheckedChange={onChange} />
    </Label>
  )
}

function Linea({ texto, valor }: { texto: string; valor: number }) {
  return (
    <div className={cn("flex justify-between gap-4 text-sm", valor === 0 && "text-muted-foreground")}>
      <span>{texto}</span>
      <span className="font-mono">{euros(valor)}</span>
    </div>
  )
}
