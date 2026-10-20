// Tarifas oficiales del servidor. Son la única fuente de precios:
// nada de lo que envíe el cliente puede modificarlas.
export const TARIFAS = Object.freeze({
  landing: 300, // incluye la primera página
  corporativa: 600, // incluye la primera página
  paginaAdicional: 50,
  formulario: 80,
  segundoIdioma: 150,
});

export const MONEDA = "EUR";
