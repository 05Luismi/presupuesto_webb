# Presupuesta mi web

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
| `npm run probar:ia` | Prueba las situaciones del apartado 6 contra OpenAI real (consume tokens) |

Al arrancar, la terminal muestra:

```
[api] API de presupuestos escuchando en http://localhost:4000
[web] - Local:         http://localhost:3000
```

### Clave de OpenAI

La propuesta con IA necesita una clave de la API de OpenAI. Va en una **variable de entorno**, nunca en el código:

```bash
cp .env.example .env      # y escribe tu clave en OPENAI_API_KEY
```

| Variable | Obligatoria | Valor |
| --- | --- | --- |
| `OPENAI_API_KEY` | Sí, para `/api/propuesta` | Tu clave (`sk-...`) |
| `OPENAI_MODEL` | No | Modelo a usar; por defecto `gpt-5-mini` |

El archivo `.env` está en `.gitignore` y **no se sube al repositorio** (solo `.env.example`, sin clave). [`server/env.js`](server/env.js) lo carga al arrancar con `process.loadEnvFile()`. En Vercel, añade las variables en **Settings → Environment Variables**.

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

### Catálogo de servicios

[`server/catalogo.js`](server/catalogo.js) describe cada tarifa como un servicio. Es la referencia que usará la IA para proponer servicios: solo puede elegir identificadores que existan en el catálogo, y lo que el cliente pida fuera de él se marcará como **necesidad pendiente de valorar**. Los precios no se repiten: se leen de `TARIFAS`.

| Campo | Contenido |
| --- | --- |
| `id` | Identificador (igual que la clave de la tarifa) |
| `nombre` | Nombre visible para el cliente |
| `categoria` | `base` (tipo de web, se elige uno) o `extra` |
| `descripcion` | Qué incluye el servicio |
| `noIncluye` | Límites del servicio (ayuda a detectar peticiones fuera de catálogo) |
| `precio` | Importe en euros |
| `regla` | Cómo se aplica el precio (fijo, por unidad…) |

## Rutas de la API

URL base en local: `http://localhost:4000`

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/estado` | Confirma que el servicio funciona |
| GET | `/api/tarifas` | Devuelve las tarifas que usa el servidor |
| GET | `/api/catalogo` | Devuelve el catálogo de servicios con nombre, descripción, precio y regla |
| GET | `/api/solicitud/limites` | Devuelve los límites de longitud de la solicitud del cliente |
| POST | `/api/solicitud` | Recoge y valida la explicación del proyecto (`cliente` + `descripcion`) |
| POST | `/api/propuesta` | La IA propone servicios del catálogo y el servidor comprueba la respuesta |
| POST | `/api/presupuesto/servicios` | Calcula la selección confirmada por el usuario, partida a partida |
| POST | `/api/ia/propuesta` | **Route Handler de Next** (no Express): propuesta con IA en *streaming* |
| POST | `/api/presupuesto/pdf` | Genera el PDF del presupuesto con el contenido revisado (`?vista=1` para verlo en el navegador) |
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

### POST /api/solicitud

El cliente explica su proyecto con sus palabras. Lo valida [`server/validarSolicitudCliente.js`](server/validarSolicitudCliente.js):

| Campo | Regla |
| --- | --- |
| `cliente` | Texto obligatorio, entre 2 y 100 caracteres (sin contar espacios al principio y al final) |
| `descripcion` | Texto obligatorio, **no puede estar vacío**, entre 20 y 2.000 caracteres |

Se descartan las propiedades adicionales y se recortan los espacios.

```json
// Petición (datos ficticios)
{ "cliente": "Restaurante La Brasa Imaginaria",
  "descripcion": "Necesito una web para un restaurante. Quiero mostrar la carta, tener un formulario para solicitar reservas y ofrecer el contenido en dos idiomas." }

// 200 OK
{ "recibida": true, "solicitud": { "cliente": "Restaurante La Brasa Imaginaria", "descripcion": "Necesito una web…" } }

// 400 (descripción vacía)
{ "error": "Solicitud no válida.", "detalles": ["\"descripcion\" no puede estar vacía: explica qué necesitas."] }
```

### POST /api/propuesta

Recibe el mismo cuerpo que `/api/solicitud`, lo valida y pide a OpenAI una propuesta. **La llamada se hace solo desde el servidor** ([`server/propuesta.js`](server/propuesta.js)), así que la clave nunca llega al navegador.

**Qué se envía al modelo**

- Unas instrucciones fijas con el catálogo en JSON **sin precios**: el modelo no puede citar ni inventar importes.
- La descripción del cliente, entre comillas triples y marcada como dato (no como instrucción).
- Un esquema de *Structured Outputs* en modo estricto (`text.format.type: "json_schema"`), que obliga a devolver este JSON:

```json
{
  "resumen": "Web para un restaurante con carta, reservas y dos idiomas.",
  "servicios": [
    { "id": "corporativa", "cantidad": 1, "justificacion": "Necesita varias secciones." },
    { "id": "paginaAdicional", "cantidad": 2, "justificacion": "Páginas para la carta y las reservas." },
    { "id": "formulario", "cantidad": 1, "justificacion": "Permite solicitar reserva." },
    { "id": "segundoIdioma", "cantidad": 1, "justificacion": "Pide el contenido en dos idiomas." }
  ],
  "dudas": ["¿Qué segundo idioma necesitas?"],
  "pendientes": []
}
```

`dudas` son preguntas para el cliente; `pendientes` son necesidades que el catálogo no cubre (pago online, reservas con calendario…) y que el equipo debe valorar.

**Qué comprueba el servidor** (`validarPropuesta`) — nunca se fía de la respuesta:

| Comprobación | Qué hace si falla |
| --- | --- |
| Cada `id` existe en el catálogo | Lo descarta y lo indica en `avisos` |
| No hay servicios repetidos | Se queda con el primero |
| Exactamente un tipo de web (`landing` o `corporativa`) | Si hay dos, deja `corporativa`; si no hay ninguno, añade una duda |
| `cantidad` válida | `paginaAdicional` entre 1 y 19; el resto, siempre 1 |
| Ningún texto menciona importes (`€`, `euros`) ni plazos (`2 semanas`, `entregaremos en…`) | Retira o sustituye ese texto |

**Respuesta · `200 OK`**: `{ "cliente": "...", "propuesta": { resumen, servicios, dudas, pendientes }, "avisos": [] }`. Cada servicio incluye además su `nombre` y `categoria` del catálogo. **No incluye precios**: se calcularán con las tarifas del servidor.

| Situación | Código |
| --- | --- |
| Cliente o descripción no válidos (no se llama a la IA) | 400 |
| Falta `OPENAI_API_KEY` | 503 |
| Error de OpenAI, respuesta incompleta, rechazo o JSON inválido | 502 |

### POST /api/presupuesto/servicios

Recibe la selección que el usuario ha confirmado tras revisar la propuesta. Solo se envían **identificadores** (y la cantidad de páginas adicionales): cualquier precio, importe o total que llegue se ignora. Lo valida [`server/seleccion.js`](server/seleccion.js):

- cada `id` existe en el catálogo y no está repetido;
- hay exactamente un tipo de web (`landing` o `corporativa`);
- `paginaAdicional` **exige** `cantidad`, un entero entre 1 y 19: sin ese dato no se puede calcular la partida.

Después convierte la selección al formato de `calcularPresupuesto()` y la calcula con las tarifas de `server/tarifas.js`, así que da siempre el mismo total que `POST /api/presupuesto`.

```json
// Petición
{ "servicios": [
    { "id": "corporativa" },
    { "id": "paginaAdicional", "cantidad": 2 },
    { "id": "formulario" },
    { "id": "segundoIdioma" } ] }

// 200 OK
{ "lineas": [
    { "id": "corporativa", "nombre": "Web corporativa", "cantidad": 1, "precioUnitario": 600, "importe": 600 },
    { "id": "paginaAdicional", "nombre": "Página adicional", "cantidad": 2, "precioUnitario": 50, "importe": 100 },
    { "id": "formulario", "nombre": "Formulario de contacto", "cantidad": 1, "precioUnitario": 80, "importe": 80 },
    { "id": "segundoIdioma", "nombre": "Segundo idioma", "cantidad": 1, "precioUnitario": 150, "importe": 150 } ],
  "paginas": 3, "total": 930, "moneda": "EUR" }

// 400 (páginas adicionales sin cantidad)
{ "error": "Selección no válida.",
  "detalles": ["Indica cuántas páginas adicionales necesitas para calcular \"Página adicional\"."] }
```

### POST /api/ia/propuesta (Route Handler de Next.js)

[`web/app/api/ia/propuesta/route.ts`](web/app/api/ia/propuesta/route.ts) es la pasarela que usa la interfaz para hablar con OpenAI. Se ejecuta **solo en el servidor de Next**:

- **Seguridad**: lee `OPENAI_API_KEY` de `process.env`. [`web/next.config.ts`](web/next.config.ts) carga el `.env` de la raíz con `loadEnvConfig` de `@next/env`; como la variable no lleva el prefijo `NEXT_PUBLIC_`, nunca se incluye en el código del navegador.
- **Pasarela**: valida `{ cliente, descripcion }`, monta la petición con el catálogo y el esquema (`construirPeticion`, compartida con Express) y, al terminar, pasa la respuesta por `validarPropuesta`: misma validación que `/api/propuesta`.
- **Streaming**: responde en NDJSON (un JSON por línea) mientras el modelo escribe:

  ```
  {"tipo":"resumen","texto":"Web para un "}
  {"tipo":"resumen","texto":"restaurante "}
  {"tipo":"servicio","id":"corporativa","nombre":"Web corporativa"}
  …
  {"tipo":"fin","cliente":"…","propuesta":{…validada…},"avisos":[]}
  ```

  El resumen se envía por palabras completas y **deja de enviarse si aparece una cifra o un importe/plazo**, para no mostrar a medias algo que la validación final va a retirar. Solo se anuncian servicios cuyo `id` existe en el catálogo. Si el usuario cierra la página, se cancela la llamada a OpenAI (`request.signal`) para no gastar tokens.
- **Control de acceso** (antes de gastar créditos): rechaza peticiones con `Origin` de otra web (**403**) y limita a **5 propuestas por minuto e IP** (**429** + `Retry-After`, [`web/lib/limite-peticiones.ts`](web/lib/limite-peticiones.ts)). El límite vive en memoria de cada proceso; con varias instancias haría falta un almacén compartido (Redis…). Si la app tuviera login, la comprobación de sesión iría en el mismo punto.

Errores antes de empezar el flujo: 400, 403, 429, 502 y 503 en JSON, como en Express. Si el fallo ocurre a mitad, llega `{"tipo":"error",…}`.

Las demás rutas `/api/...` siguen en Express: Next las reenvía con `rewrites` (por defecto a `http://localhost:4000`; configurable con `API_URL`). Las rutas propias de Next (`route.ts`) tienen prioridad sobre esos `rewrites`.

### POST /api/presupuesto/pdf

Genera el presupuesto en PDF con [PDFKit](https://pdfkit.org) ([`server/pdf.js`](server/pdf.js)). Recibe el contenido que el usuario ha revisado:

```json
{ "cliente": "Restaurante La Brasa Imaginaria",
  "resumen": "Web bilingüe para el restaurante, con carta y petición de reservas.",
  "servicios": [{ "id": "corporativa" }, { "id": "paginaAdicional", "cantidad": 2 }, { "id": "formulario" }, { "id": "segundoIdioma" }],
  "dudas": ["¿Qué segundo idioma necesitas?"],
  "pendientes": ["Reservas con calendario de disponibilidad"] }
```

[`server/documento.js`](server/documento.js) lo valida (cliente; resumen obligatorio de hasta 800 caracteres; hasta 15 dudas y 15 pendientes de 300 caracteres como máximo; selección válida igual que en `/api/presupuesto/servicios`) y prepara el documento. **Los importes, las descripciones de los servicios y la fecha los pone el servidor**: si la petición trae un `total`, un `desglose` o una `fecha`, se ignoran.

Responde `200` con `Content-Type: application/pdf` y `Content-Disposition: attachment; filename="presupuesto-<cliente>-<AAAA-MM-DD>.pdf"` (`inline` con `?vista=1`), o `400` con la lista de errores.

**Contenido del PDF** (A4, se pagina solo y numera las páginas):

1. Cabecera con la marca, nombre del cliente o empresa y fecha.
2. Resumen del proyecto.
3. Servicios incluidos con su descripción del catálogo.
4. Desglose de importes (concepto, cantidad, precio unitario, importe) y total.
5. Aclaraciones: lo que hay que concretar con el cliente y lo pendiente de valorar (no incluido en el total).
6. Nota final: importes sin impuestos, sin plazos de entrega ni otros compromisos.

### Librerías de PDF: cuál y por qué

| Librería | Dónde se ejecuta | Valoración |
| --- | --- | --- |
| **PDFKit** ✅ | Node (servidor) | Madura y mantenida, sin dependencias nativas, texto real (seleccionable), paginación y control total del diseño. Las 14 fuentes estándar ya incluyen tildes, ñ y €. Encaja con el principio de la app: **el servidor calcula y genera**, el navegador no puede alterar los importes. |
| pdfmake | Servidor o navegador | Buena alternativa: definición declarativa con tablas (por debajo usa PDFKit). Su API cambió en la 0.3 y hay que configurar las fuentes. |
| @react-pdf/renderer | Servidor o navegador | Cómodo si se piensa en componentes React y flexbox; más pesado y con su propio motor de maquetación. |
| jsPDF (+ autotable) | Navegador | Muy usada, pero de bajo nivel: posiciones a mano y problemas con caracteres no latinos sin cargar fuentes. Generar en el cliente permite manipular los importes. |
| pdf-lib | Servidor o navegador | Útil para **rellenar o modificar** PDFs existentes (p. ej. una plantilla con campos), pero no ajusta texto ni pagina. Sin actualizaciones desde 2022. |
| Puppeteer / Playwright | Servidor (Chrome sin ventana) | Máxima fidelidad HTML→PDF, pero descarga un navegador entero (~150 MB); en Vercel necesita una versión recortada de Chromium y es lento al arrancar. |
| html2pdf.js / html2canvas | Navegador | ❌ Hace una **captura en imagen**: texto no seleccionable, borroso al imprimir, cortes de página malos. |
| wkhtmltopdf | Binario externo | ❌ Proyecto archivado y sin mantenimiento. |
| `window.print()` | Navegador | Sin dependencias, pero el resultado depende del navegador y el usuario tiene que elegir «Guardar como PDF». |

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

Resultado: **97 pruebas, 97 correctas, 0 fallos** ([`test/api.test.js`](test/api.test.js) + [`test/escenarios.test.js`](test/escenarios.test.js)). Las pruebas de la solicitud usan solo datos ficticios, y las de la IA usan un cliente de OpenAI **simulado** (`app.set("clienteIA", …)`): no necesitan clave ni hacen llamadas reales.

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

### Comprobación del funcionamiento

[`test/escenarios.test.js`](test/escenarios.test.js) recorre cada situación **de principio a fin por la API** (propuesta → revisión → cálculo → PDF). La IA se sustituye por un cliente simulado que devuelve lo que respondería el modelo, para comprobar qué hace **nuestra aplicación** en cada caso. Además, [`scripts/probar-ia.js`](scripts/probar-ia.js) (`npm run probar:ia`) lanza las situaciones 1, 2, 3 y 5 contra **OpenAI de verdad**, y el flujo se ha recorrido en el navegador (Chrome) con la IA simulada.

| # | Situación (datos ficticios) | Resultado esperado | Resultado obtenido |
| --- | --- | --- | --- |
| 1 | **Clara**: «Necesito una web para un restaurante… carta, formulario para reservas… dos idiomas» | Servicios del catálogo con justificación, sin correcciones; se calcula y se descarga el PDF | ✅ 200 · corporativa + 2 páginas + formulario + segundo idioma · **930 €** · PDF `%PDF-` |
| 2 | **Ambigua**: «Quiero una web para mi negocio, algo sencillo pero que quede bien» | Dudas para el cliente; no se puede calcular sin elegir el tipo de web | ✅ 200 · 3 dudas + la del tipo de web añadida por el servidor · calcular sin tipo → **400** · con landing → **380 €** · dudas en el PDF |
| 3 | **Fuera de catálogo**: «vender online con pago con tarjeta, además de un blog» | Lo no ofrecido como *pendiente de valorar*, fuera del total | ✅ pendientes «Tienda online con pago con tarjeta», «Blog» · total solo del catálogo (**650 €**) · ids inventados (`tiendaOnline`, `blog`) descartados con aviso · precios y plazos inventados retirados |
| 4 | **Descripción vacía**: `""`, solo espacios, campo ausente | 400 sin llamar a OpenAI | ✅ **400** «"descripcion" no puede estar vacía» · 0 llamadas a la IA · en la web, alerta roja con el error |
| 5 | **Fallo de OpenAI**: 401, 429, 500, tiempo agotado, sin conexión, respuesta incompleta, no JSON, rechazo; sin clave | 502 con mensaje claro (503 sin clave), sin detalles internos; el resto de la app sigue funcionando | ✅ **502** con mensaje según el fallo («saturado», «ha tardado demasiado»…) · **503** sin clave · cálculo y estado siguen respondiendo · **llamada real** con clave falsa: OpenAI responde 401 → `ErrorIA` |
| 6 | **Modificación antes del PDF**: cambiar a landing, quitar segundo idioma, 4 páginas, editar resumen y pendientes, enviar `total: 1` | El PDF refleja la selección modificada con importes del servidor | ✅ 930 € → **580 €** · PDF con Landing, 4 páginas y formulario · el `total` enviado se ignora · selección incompleta → 400 · en el navegador: 880 € tras modificar, vista previa, «Seguir editando» conserva cambios y se descarga el mismo PDF |

**Con OpenAI real** (`npm run probar:ia`, necesita `OPENAI_API_KEY`): envía las descripciones 1, 2 y 3 y comprueba propiedades, no textos exactos (las respuestas varían): todos los ids son del catálogo, sin importes ni plazos, y además (1) tipo de web + formulario + segundo idioma, (2) hay dudas, (3) el pago/tienda aparece en pendientes. La situación 5 se ejecuta siempre con una clave falsa.

## Interfaz web

Ampliación opcional (CE 7.7): formulario en **Next.js + shadcn/ui**, en la carpeta [`web/`](web/), que consume la API.

- Se abre en **http://localhost:3000** con `npm start`.
- Carga las tarifas y el estado del servicio desde `GET /api/tarifas` y `GET /api/estado`.
- Envía la solicitud a `POST /api/presupuesto` y muestra el desglose o los errores 400 que devuelve el servidor.
- **No calcula ningún precio**: solo muestra lo que responde la API.
- Formulario **«Cuéntanos tu proyecto»** ([`web/components/solicitud-form.tsx`](web/components/solicitud-form.tsx)): nombre del cliente o empresa y descripción libre, con contador de caracteres y botones que rellenan ejemplos ficticios. Envía a `POST /api/propuesta` y muestra el resumen, las dudas, lo pendiente de valorar y las correcciones del servidor.
- **Revisión de la propuesta** ([`web/components/revision-propuesta.tsx`](web/components/revision-propuesta.tsx)): cada servicio propuesto aparece con su justificación y se puede **aceptar** o **eliminar** (y recuperar). Desde «Añadir del catálogo» se añaden otros servicios; elegir otro tipo de web sustituye al anterior. El botón **Confirmar selección y calcular** está bloqueado, con la lista de lo que falta, mientras quede algún servicio sin revisar, no haya tipo de web o falte el número de páginas adicionales. El cálculo lo hace `POST /api/presupuesto/servicios`; cualquier cambio posterior borra el resultado para no mostrar un total desactualizado.
- **Documento y PDF** ([`web/components/documento-presupuesto.tsx`](web/components/documento-presupuesto.tsx)): tras calcular aparece **Revisa el documento**, una hoja con el mismo orden que el PDF. El resumen y las aclaraciones se pueden editar (una por línea); los servicios e importes son los del servidor. **Ver vista previa del PDF** genera el PDF real y lo muestra en la página; desde ahí se puede **Seguir editando** o **Aceptar y descargar PDF**, que descarga exactamente el documento previsualizado.

En local, Next.js redirige las llamadas `/api/...` a la API de Express en el puerto 4000 (configurado en [`web/next.config.ts`](web/next.config.ts)).

## Despliegue en Vercel

Web y API se despliegan en **un solo proyecto**:

1. En Vercel: **Add New → Project** e importa este repositorio.
2. **Root Directory**: déjalo vacío (raíz del repositorio). No pongas `web`.
3. **Framework Preset**: *Other*. No actives ningún *Override*: los comandos ya están en [`vercel.json`](vercel.json).
4. Pulsa **Deploy**.

Resultado:

> ⚠️ **Pendiente de adaptar.** Con el Route Handler de Next, la web ya **no se compila como estática** (`output: "export"` no admite rutas POST), así que la configuración de abajo (`web/out`) ya no sirve tal cual. En local todo funciona con `npm start`.

- `https://<tu-proyecto>.vercel.app/` → interfaz web (compilada como página estática en `web/out`).
- `https://<tu-proyecto>.vercel.app/api/estado` → API de Express, ejecutada como función desde [`api/index.js`](api/index.js).

`vercel.json` incluye en la función los archivos de fuentes de PDFKit (`node_modules/pdfkit/js/data`), que se leen del disco al generar el PDF. Recuerda definir `OPENAI_API_KEY` en **Settings → Environment Variables**.

## Estructura del proyecto

```
presupuesto_web/
├── server/
│   ├── index.js        → arranca el servidor en el puerto 4000
│   ├── app.js          → rutas de Express y manejo de errores
│   ├── tarifas.js      → tarifas del servidor
│   ├── catalogo.js     → catálogo de servicios (referencia para la IA)
│   ├── validar.js      → validación de la solicitud
│   ├── validarSolicitudCliente.js → validación de la descripción del cliente
│   ├── propuesta.js    → instrucciones, esquema y validación de la respuesta de la IA
│   ├── seleccion.js    → validación y cálculo por partidas de la selección confirmada
│   ├── documento.js    → validación y preparación del contenido del PDF
│   ├── pdf.js          → generación del PDF con PDFKit
│   ├── openai.js       → cliente de OpenAI (lee OPENAI_API_KEY)
│   ├── env.js          → carga el archivo .env
│   └── calcular.js     → función de cálculo (independiente de Express)
├── test/
│   ├── api.test.js     → pruebas automáticas de las rutas
│   └── escenarios.test.js → situaciones del apartado 6 de principio a fin
├── scripts/
│   └── probar-ia.js    → prueba contra OpenAI real (npm run probar:ia)
├── api/
│   └── index.js        → entrada para Vercel (exporta la app de Express)
├── web/                → interfaz web (Next.js + shadcn/ui)
│   ├── app/api/ia/propuesta/route.ts → Route Handler: OpenAI con streaming
│   ├── lib/limite-peticiones.ts      → límite de peticiones por IP
│   └── components/                   → formularios, revisión y documento
├── .env.example        → plantilla de variables de entorno (sin clave)
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
| «El asistente de IA no está configurado» (503) | Falta `OPENAI_API_KEY`. Crea el `.env` a partir de `.env.example` y reinicia la API. |
| La web muestra «API sin conexión» | La API no está arrancada. Usa `npm start`, que arranca las dos partes. |
