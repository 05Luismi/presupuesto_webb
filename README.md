# Presupuesta mi web

**🌐 Demo en vivo: [https://presupuesto-web-web.vercel.app/](https://presupuesto-web-web.vercel.app/)**

API REST hecha con **Node.js + Express + JavaScript** que calcula el presupuesto de un proyecto web. El servidor valida los datos recibidos y calcula el precio **siempre con sus propias tarifas**: nunca acepta un precio o un total enviado por el cliente.

Como ampliación, incluye una interfaz web (Next.js + shadcn/ui) para pedir presupuestos desde el navegador.

> Actividad 0613 · Desarrollo web en entorno servidor · RA7 (CE 7.4, 7.6 y 7.7)

## Índice

1. [Inicio rápido](#inicio-rápido)
2. [Requisitos](#requisitos)
3. [Instalación y ejecución](#instalación-y-ejecución)
4. [Tarifas](#tarifas)
5. [Rutas de la API](#rutas-de-la-api)
6. [Cómo funciona](#cómo-funciona)
7. [Pruebas](#pruebas)
8. [Interfaz web](#interfaz-web)
9. [Despliegue en Vercel](#despliegue-en-vercel)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [Problemas frecuentes](#problemas-frecuentes)

## Inicio rápido

```bash
git clone https://github.com/05Luismi/presupuesto_web.git
cd presupuesto_web
npm install
npm start
```

| Qué | Dirección |
| --- | --- |
| API de Express | **http://localhost:4000/api/estado** |
| Interfaz web | **http://localhost:3000** |

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior (probado con Node 25.9)
- npm (se instala junto con Node.js)

Para comprobarlo: `node -v` y `npm -v`.

## Instalación y ejecución

### Instalación

```bash
npm install
```

Instala Express y, automáticamente, las dependencias de la interfaz web (carpeta `web/`). La carpeta `node_modules` no se incluye en el repositorio: se genera con este comando a partir de `package.json` y `package-lock.json`.

### Ejecución

| Comando | Qué hace |
| --- | --- |
| `npm start` | Arranca la API (puerto **4000**) y la interfaz web (puerto **3000**) a la vez |
| `npm run api` | Arranca **solo la API** en el puerto 4000 |
| `npm run dev` | Igual que `npm start`, pero reinicia la API al guardar cambios |
| `npm test` | Ejecuta las pruebas automáticas de la API |

Al arrancar, la terminal muestra:

```
[api] API de presupuestos escuchando en http://localhost:4000
[web] - Local:         http://localhost:3000
```

### Puerto

La API usa el puerto **4000** por defecto. Se puede cambiar con la variable de entorno `PORT`:

```bash
# Linux / macOS / Git Bash
PORT=5000 npm run api
```

```powershell
# PowerShell (Windows)
$env:PORT=5000; npm run api
```

## Tarifas

Definidas en [`server/tarifas.js`](server/tarifas.js). Son la única fuente de precios y están congeladas con `Object.freeze`.

| Concepto | Clave | Precio |
| --- | --- | --- |
| Landing (incluye la primera página) | `landing` | 300 € |
| Web corporativa (incluye la primera página) | `corporativa` | 600 € |
| Cada página adicional a la primera | `paginaAdicional` | 50 € |
| Formulario de contacto | `formulario` | 80 € |
| Segundo idioma | `segundoIdioma` | 150 € |

Sin impuestos, descuentos ni conceptos adicionales.

## Rutas de la API

URL base en local: `http://localhost:4000`

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/estado` | Confirma que el servicio funciona |
| GET | `/api/tarifas` | Devuelve las tarifas que usa el servidor |
| POST | `/api/presupuesto` | Valida la solicitud y devuelve el presupuesto desglosado |

`GET /` redirige a `/api/estado`. Cualquier otra ruta responde `404` con un JSON de error.

### GET /api/estado

```json
{ "status": "ok" }
```

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

Requiere la cabecera `Content-Type: application/json` y un cuerpo con estos **cuatro campos obligatorios**:

| Campo | Tipo | Valores válidos |
| --- | --- | --- |
| `tipo` | texto | `"landing"` o `"corporativa"` |
| `paginas` | número entero | de `1` a `20` |
| `formulario` | booleano | `true` o `false` |
| `segundoIdioma` | booleano | `true` o `false` |

**Ejemplo de petición**

```bash
# Linux / macOS / Git Bash
curl -X POST http://localhost:4000/api/presupuesto \
  -H "Content-Type: application/json" \
  -d '{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}'
```

```powershell
# PowerShell (Windows)
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/presupuesto `
  -ContentType "application/json" `
  -Body '{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}'
```

**Respuesta correcta · `200 OK`**

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

`paginasAdicionales` es el coste de las páginas extra: 3 páginas adicionales × 50 € = 150 €.

**Respuesta con error · `400 Bad Request`** (ejemplo con `"paginas": 21`)

```json
{
  "error": "Solicitud no válida.",
  "detalles": ["\"paginas\" debe estar entre 1 y 20 (recibido: 21)."]
}
```

| Situación | Código | Mensaje |
| --- | --- | --- |
| Datos no válidos o campo ausente | 400 | `Solicitud no válida.` + lista `detalles` |
| Falta `Content-Type: application/json` | 400 | `La petición debe enviarse con la cabecera Content-Type: application/json.` |
| El cuerpo no es un JSON válido | 400 | `El cuerpo no es un JSON válido.` |
| Ruta inexistente | 404 | `Ruta no encontrada: <método> <ruta>` |

> No se puede probar `POST /api/presupuesto` escribiendo la URL en el navegador, porque así solo se envían peticiones GET. Usa la terminal, un cliente HTTP (Postman, Thunder Client…) o la interfaz web.

## Cómo funciona

Cada petición a `POST /api/presupuesto` pasa por tres pasos ([`server/app.js`](server/app.js)):

```
petición ──► 1. ¿Content-Type JSON? ──► 2. validarSolicitud() ──► 3. calcularPresupuesto() ──► 200
                     │ no                       │ errores
                     ▼                          ▼
                    400                        400 (no se calcula)
```

### 1. Validación — [`server/validar.js`](server/validar.js)

Antes de calcular se comprueba que:

- el cuerpo es un objeto (no un array ni `null`) y contiene los cuatro campos;
- `tipo` es exactamente `"landing"` o `"corporativa"`;
- `paginas` es de tipo `number`, entero (`Number.isInteger`) y está entre 1 y 20, así que `"4"` (texto) y `2.5` no son válidos;
- `formulario` y `segundoIdioma` son de tipo `boolean`, así que el texto `"false"` no es válido.

Si algo falla se responde **400** con la lista de errores y **no se calcula** el presupuesto.

La función devuelve un objeto nuevo **solo con los cuatro campos permitidos**. Cualquier propiedad adicional (`total`, `base`, `tarifas`…) se descarta, así que el cliente no puede imponer un precio ni modificar las tarifas.

### 2. Cálculo — [`server/calcular.js`](server/calcular.js)

`calcularPresupuesto()` es una función independiente de Express: recibe los datos ya validados y aplica la regla

```
total = precio base + (páginas − 1) × 50 + formulario + segundo idioma
```

usando siempre las tarifas de `server/tarifas.js`.

**Ejemplo:** web corporativa, 4 páginas, con formulario y sin segundo idioma

| Concepto | Cálculo | Importe |
| --- | --- | --- |
| Base corporativa | tarifa `corporativa` | 600 € |
| Páginas adicionales | (4 − 1) × 50 € | 150 € |
| Formulario | seleccionado | 80 € |
| Segundo idioma | no seleccionado | 0 € |
| **Total** | 600 + 150 + 80 + 0 | **830 €** |

Los presupuestos no se guardan en ninguna base de datos.

## Pruebas

### Pruebas automáticas

```bash
npm test
```

Ejecuta [`test/api.test.js`](test/api.test.js) con el *test runner* integrado de Node (`node:test`), sin dependencias extra. Arranca la API en un puerto libre y envía peticiones reales a las tres rutas.

Resultado: **20 pruebas, 20 correctas, 0 fallos.**

### Tabla de pruebas

En los casos inválidos (5 a 9) se cambia **un solo campo** y el resto se mantiene correcto, partiendo de la solicitud válida `{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}`, para comprobar cada error por separado.

| Caso | Solicitud | Resultado esperado | Resultado obtenido |
| --- | --- | --- | --- |
| Estado | `GET /api/estado` | 200 · `{"status":"ok"}` | ✅ 200 · `{"status":"ok"}` |
| Tarifas | `GET /api/tarifas` | 200 · tarifas del servidor | ✅ 200 · 300 / 600 / 50 / 80 / 150 |
| 1 | `{"tipo":"landing","paginas":1,"formulario":false,"segundoIdioma":false}` | 200 · Total: 300 € | ✅ 200 · 300 € (300 + 0 + 0 + 0) |
| 2 | `{"tipo":"corporativa","paginas":4,"formulario":true,"segundoIdioma":false}` | 200 · Total: 830 € | ✅ 200 · 830 € (600 + 150 + 80 + 0) |
| 3 | `{"tipo":"landing","paginas":2,"formulario":true,"segundoIdioma":true}` | 200 · Total: 580 € | ✅ 200 · 580 € (300 + 50 + 80 + 150) |
| 4 | `{"tipo":"landing","paginas":20,"formulario":false,"segundoIdioma":false}` | 200 · Total: 1.250 € | ✅ 200 · 1.250 € (300 + 950 + 0 + 0) |
| 5 | `{"tipo":"corporativa","paginas":0,"formulario":true,"segundoIdioma":false}` | 400 | ✅ 400 · "paginas" debe estar entre 1 y 20 |
| 6 | `{"tipo":"corporativa","paginas":21,"formulario":true,"segundoIdioma":false}` | 400 | ✅ 400 · "paginas" debe estar entre 1 y 20 |
| 7 | `{"tipo":"corporativa","paginas":2.5,"formulario":true,"segundoIdioma":false}` | 400 | ✅ 400 · "paginas" debe ser un número entero |
| 8 | `{"tipo":"tienda","paginas":4,"formulario":true,"segundoIdioma":false}` | 400 | ✅ 400 · "tipo" debe ser "landing" o "corporativa" |
| 9 | `{"tipo":"corporativa","paginas":4,"formulario":"false","segundoIdioma":false}` | 400 | ✅ 400 · "formulario" debe ser un booleano |

Pruebas adicionales:

| Solicitud | Resultado esperado | Resultado obtenido |
| --- | --- | --- |
| `"paginas": "4"` (texto) | 400 | ✅ 400 · "paginas" debe ser un número entero |
| Sin el campo `segundoIdioma` | 400 | ✅ 400 · Falta el campo obligatorio "segundoIdioma" |
| El cuerpo es un array | 400 | ✅ 400 · El cuerpo de la petición debe ser un objeto JSON |
| Solicitud válida + `"total": 1, "base": 0, "tarifas": {...}` | 200 · Total: 830 € | ✅ 200 · 830 € (las propiedades extra se ignoran) |
| Sin cabecera `Content-Type: application/json` | 400 | ✅ 400 |
| JSON mal formado | 400 | ✅ 400 · El cuerpo no es un JSON válido |
| `GET /` | Redirige a `/api/estado` | ✅ 200 · `{"status":"ok"}` |
| `calcularPresupuesto()` llamada directamente, sin Express | Total: 550 € | ✅ 550 € |

## Interfaz web

Ampliación opcional (CE 7.7): formulario en **Next.js + shadcn/ui**, en la carpeta [`web/`](web/), que consume la API.

- Se abre en **http://localhost:3000** con `npm start`.
- Carga las tarifas y el estado del servicio desde `GET /api/tarifas` y `GET /api/estado`.
- Envía la solicitud a `POST /api/presupuesto` y muestra el desglose o los errores 400 que devuelve el servidor.
- **No calcula ningún precio**: solo muestra lo que responde la API.

En local, Next.js redirige las llamadas `/api/...` a la API de Express en el puerto 4000 (configurado en [`web/next.config.ts`](web/next.config.ts)).

## Despliegue en Vercel

Web y API se despliegan en **un solo proyecto**:

1. En Vercel: **Add New → Project** e importa este repositorio.
2. **Root Directory**: déjalo vacío (raíz del repositorio). No pongas `web`.
3. **Framework Preset**: *Other*. No actives ningún *Override*: los comandos ya están en [`vercel.json`](vercel.json).
4. Pulsa **Deploy**.

Resultado:

- `https://<tu-proyecto>.vercel.app/` → interfaz web (compilada como página estática en `web/out`).
- `https://<tu-proyecto>.vercel.app/api/estado` → API de Express, ejecutada como función desde [`api/index.js`](api/index.js).

## Estructura del proyecto

```
presupuesto_web/
├── server/
│   ├── index.js        → arranca el servidor en el puerto 4000
│   ├── app.js          → rutas de Express y manejo de errores
│   ├── tarifas.js      → tarifas del servidor
│   ├── validar.js      → validación de la solicitud
│   └── calcular.js     → función de cálculo (independiente de Express)
├── test/
│   └── api.test.js     → pruebas automáticas
├── api/
│   └── index.js        → entrada para Vercel (exporta la app de Express)
├── web/                → interfaz web (Next.js + shadcn/ui)
│   └── components/presupuesto-form.tsx
├── package.json        → dependencias y scripts
├── package-lock.json   → versiones exactas de las dependencias
├── vercel.json         → configuración del despliegue
└── README.md
```

## Problemas frecuentes

| Problema | Solución |
| --- | --- |
| `node` o `npm` no se reconoce como comando | Instala Node.js desde https://nodejs.org (versión LTS) y abre una terminal nueva. |
| `Cannot find package 'express'` | Falta instalar las dependencias: ejecuta `npm install`. |
| `EADDRINUSE: address already in use` | El puerto está ocupado por otro servidor. Ciérralo con `Ctrl + C` o usa otro puerto con `PORT`. |
| Al abrir `/api/presupuesto` en el navegador sale `Ruta no encontrada` | Es normal: esa ruta solo acepta POST. Usa la terminal, un cliente HTTP o la interfaz web. |
| La web muestra «API sin conexión» | La API no está arrancada. Usa `npm start`, que arranca las dos partes. |
