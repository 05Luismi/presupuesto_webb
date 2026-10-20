import { PresupuestoForm } from "@/components/presupuesto-form"

export default function Page() {
  return (
    <main className="relative mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-96 max-w-3xl rounded-full bg-primary/20 blur-3xl"
      />
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Agencia web · Presupuestos al instante
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Presupuesta{" "}
          <span className="bg-linear-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
            mi web
          </span>
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Elige qué web necesitas y obtén un presupuesto desglosado. El precio lo
          calcula nuestro servidor con sus propias tarifas.
        </p>
      </header>

      <PresupuestoForm />

      <footer className="mt-auto pt-8 text-xs text-muted-foreground">
        API: Node.js + Express · Interfaz: Next.js + shadcn/ui · Pulsa{" "}
        <kbd className="rounded border px-1 font-mono">d</kbd> para cambiar el tema
      </footer>
    </main>
  )
}
