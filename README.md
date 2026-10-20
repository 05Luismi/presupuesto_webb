# Presupuesta mi web

API hecha con **Node.js + Express + JavaScript** que calcula presupuestos de proyectos web con las tarifas del servidor. Incluye una interfaz web (Next.js + shadcn/ui) en la carpeta `web/` para pedir presupuestos desde el navegador.

## Requisitos

- Node.js 20 o superior (probado con Node 25)
- npm

## Instalación

```bash
git clone https://github.com/05Luismi/presupuesto_web.git
cd presupuesto_web
npm install
```

`npm install` instala también las dependencias de la web (carpeta `web/`).

## Ejecución

```bash
npm start
```

Arranca las dos partes a la vez:

| Parte | Dirección |
| --- | --- |
| Web para pedir presupuestos | **http://localhost:3000** |
| API de Express | **http://localhost:4000** (rutas en `/api/...`) |

La web no calcula nada: envía la solicitud a `POST /api/presupuesto` y muestra el desglose o los errores que devuelve la API.

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm run api` | Arranca solo la API en el puerto 4000 |
| `npm run dev` | Igual que `npm start`, pero reinicia la API al guardar cambios |
| `npm test` | Ejecuta las pruebas automáticas de la API |

**Puerto de la API:** 4000 por defecto. Se puede cambiar con la variable de entorno `PORT` (en PowerShell: `$env:PORT=5000; npm run api`).

## Despliegue en Vercel

Un solo proyecto: en Vercel, **Add New → Project**, importa este repositorio y deja *Root Directory* en la raíz (`./`) y *Framework Preset* en *Other*. No hace falta configurar nada más: `vercel.json` ya indica cómo compilar.

- La web se compila como página estática (`web/out`) y se sirve en `https://<tu-proyecto>.vercel.app/`.
- La API de Express se ejecuta como función desde `api/index.js` en el mismo dominio: `https://<tu-proyecto>.vercel.app/api/estado`.

## Rutas

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/estado` | Devuelve `{ "status": "ok" }` |
| GET | `/api/tarifas` | Devuelve las tarifas que usa el servidor |
| POST | `/api/presupuesto` | Valida la solicitud y devuelve el presupuesto desglosado |

### GET /api/tarifas

```json
{
  "moneda": "EUR",
  "tarifas": {
    "landing": 300,
    "corporativa": 600,
    "paginaAdicional": 50,
    "formulario": 80,
    "segundoIdioma": 150
  }
}
```

### POST /api/presupuesto

Cabecera obligatoria: `Content-Type: application/json`

```bash
curl -X POST http://localhost:4000/api/presupuesto \
  -H "Content-Type: application/json" \
  -d '{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}'
```

Respuesta `200`:

```json
{
  "base": 600,
  "paginasAdicionales": 150,
  "formulario": 80,
  "segundoIdioma": 0,
  "total": 830,
  "moneda": "EUR"
}
```

Respuesta `400` (ejemplo con `"paginas": 21`):

```json
{
  "error": "Solicitud no válida.",
  "detalles": ["\"paginas\" debe estar entre 1 y 20 (recibido: 21)."]
}
```

## Estructura

```
server/
  index.js      → arranca el servidor (puerto)
  app.js        → rutas de Express y manejo de errores
  tarifas.js    → tarifas del servidor (congeladas, nadie las puede modificar)
  validar.js    → validación de la solicitud
  calcular.js   → función de cálculo, independiente de Express
test/
  api.test.js   → pruebas automáticas (node:test)
api/
  index.js      → entrada para Vercel (exporta la app de Express)
web/            → interfaz Next.js + shadcn/ui
  components/presupuesto-form.tsx → formulario que llama a la API
```

## Cómo funciona

1. **Validación** (`server/validar.js`): antes de calcular se comprueba que el cuerpo es un objeto, que están los cuatro campos, que `tipo` es `"landing"` o `"corporativa"`, que `paginas` es un número entero entre 1 y 20 (`typeof === "number"` y `Number.isInteger`, por eso `"4"` y `2.5` fallan) y que `formulario` y `segundoIdioma` son booleanos (`typeof === "boolean"`, por eso `"false"` falla). Si algo falla se responde `400` y **no se calcula**.
2. **Solo se usan los cuatro campos validados**: cualquier otra propiedad (`total`, `base`, `tarifas`…) se descarta, así que el cliente no puede imponer un precio.
3. **Cálculo** (`server/calcular.js`): `total = base + (paginas − 1) × 50 + formulario + segundoIdioma`, usando siempre las tarifas de `server/tarifas.js`.

Ejemplo: corporativa con 4 páginas y formulario → 600 + 3 × 50 + 80 + 0 = **830 €**.

## Pruebas

Se pueden reproducir con `npm test` o enviando las peticiones con `curl` o un cliente HTTP (Postman, Thunder Client…). En los casos inválidos el resto de campos es el ejemplo válido: `{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}`.

| Caso | Solicitud | Resultado esperado | Resultado obtenido |
| --- | --- | --- | --- |
| Estado | `GET /api/estado` | 200 · `{"status":"ok"}` | ✅ 200 · `{"status":"ok"}` |
| Tarifas | `GET /api/tarifas` | 200 · tarifas | ✅ 200 · 300 / 600 / 50 / 80 / 150 |
| 1 | `{"tipo":"landing","paginas":1,"formulario":false,"segundoIdioma":false}` | 200 · Total: 300 € | ✅ 200 · 300 € |
| 2 | `{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}` | 200 · Total: 830 € | ✅ 200 · 830 € (600 + 150 + 80 + 0) |
| 3 | `{"tipo":"landing","paginas":2,"formulario":true,"segundoIdioma":true}` | 200 · Total: 580 € | ✅ 200 · 580 € (300 + 50 + 80 + 150) |
| 4 | `{"tipo":"landing","paginas":20,"formulario":false,"segundoIdioma":false}` | 200 · Total: 1.250 € | ✅ 200 · 1.250 € (300 + 950) |
| 5 | `"paginas": 0` | 400 | ✅ 400 · "paginas" debe estar entre 1 y 20 |
| 6 | `"paginas": 21` | 400 | ✅ 400 · "paginas" debe estar entre 1 y 20 |
| 7 | `"paginas": 2.5` | 400 | ✅ 400 · "paginas" debe ser un número entero |
| 8 | `"tipo": "tienda"` | 400 | ✅ 400 · "tipo" debe ser "landing" o "corporativa" |
| 9 | `"formulario": "false"` | 400 | ✅ 400 · "formulario" debe ser un booleano |
| Extra | `"paginas": "4"` | 400 | ✅ 400 · "paginas" debe ser un número entero |
| Extra | Falta `segundoIdioma` | 400 | ✅ 400 · Falta el campo obligatorio |
| Extra | Ejemplo válido + `"total": 1` | 200 · Total: 830 € | ✅ 200 · 830 € (se ignora) |
| Extra | Sin cabecera `Content-Type: application/json` | 400 | ✅ 400 |
| Extra | JSON mal formado | 400 | ✅ 400 · El cuerpo no es un JSON válido |

Salida de `npm test`: **20 pruebas, 20 correctas, 0 fallos.**
