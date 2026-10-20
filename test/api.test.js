import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import app from "../server/app.js";
import { calcularPresupuesto } from "../server/calcular.js";

let servidor;
let url;

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  url = `http://localhost:${servidor.address().port}`;
});

after(() => servidor.close());

const valido = { tipo: "corporativa", paginas: 4, formulario: true, segundoIdioma: false };

function enviar(cuerpo) {
  return fetch(`${url}/api/presupuesto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

test("GET / → redirige a /api/estado", async () => {
  const res = await fetch(`${url}/`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("GET /api/estado → 200 { status: 'ok' }", async () => {
  const res = await fetch(`${url}/api/estado`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("GET /api/tarifas → tarifas del servidor", async () => {
  const res = await fetch(`${url}/api/tarifas`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    moneda: "EUR",
    tarifas: { landing: 300, corporativa: 600, paginaAdicional: 50, formulario: 80, segundoIdioma: 150 },
  });
});

// Casos obligatorios del enunciado
const casosValidos = [
  ["1 · Landing, 1 página, sin extras", { tipo: "landing", paginas: 1, formulario: false, segundoIdioma: false }, 300],
  ["2 · Corporativa, 4 páginas, formulario", valido, 830],
  ["3 · Landing, 2 páginas, ambos extras", { tipo: "landing", paginas: 2, formulario: true, segundoIdioma: true }, 580],
  ["4 · Landing, 20 páginas, sin extras", { tipo: "landing", paginas: 20, formulario: false, segundoIdioma: false }, 1250],
];

for (const [nombre, cuerpo, total] of casosValidos) {
  test(`Caso ${nombre} → 200 · ${total} €`, async () => {
    const res = await enviar(cuerpo);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).total, total);
  });
}

const casosInvalidos = [
  ["5 · paginas: 0", { ...valido, paginas: 0 }],
  ["6 · paginas: 21", { ...valido, paginas: 21 }],
  ["7 · paginas: 2.5", { ...valido, paginas: 2.5 }],
  ["8 · tipo: 'tienda'", { ...valido, tipo: "tienda" }],
  ["9 · formulario: 'false'", { ...valido, formulario: "false" }],
  ["extra · paginas: '4'", { ...valido, paginas: "4" }],
  ["extra · falta segundoIdioma", { tipo: "landing", paginas: 1, formulario: false }],
  ["extra · cuerpo es un array", [valido]],
];

for (const [nombre, cuerpo] of casosInvalidos) {
  test(`Caso ${nombre} → 400`, async () => {
    const res = await enviar(cuerpo);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
    assert.equal(json.total, undefined);
  });
}

test("Ejemplo del enunciado → desglose exacto", async () => {
  const res = await enviar(valido);
  assert.deepEqual(await res.json(), {
    base: 600,
    paginasAdicionales: 150,
    formulario: 80,
    segundoIdioma: 0,
    total: 830,
    moneda: "EUR",
  });
});

test("Las propiedades extra (total, tarifas…) se ignoran", async () => {
  const res = await enviar({ ...valido, total: 1, base: 0, tarifas: { corporativa: 1 } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).total, 830);
});

test("Sin Content-Type: application/json → 400", async () => {
  const res = await fetch(`${url}/api/presupuesto`, { method: "POST", body: JSON.stringify(valido) });
  assert.equal(res.status, 400);
});

test("JSON mal formado → 400", async () => {
  const res = await fetch(`${url}/api/presupuesto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ tipo: landing",
  });
  assert.equal(res.status, 400);
});

test("calcularPresupuesto funciona sin Express", () => {
  assert.equal(calcularPresupuesto({ tipo: "landing", paginas: 3, formulario: false, segundoIdioma: true }).total, 550);
});
