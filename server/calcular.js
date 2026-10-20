import { TARIFAS, MONEDA } from "./tarifas.js";

/**
 * Calcula el presupuesto desglosado a partir de datos YA validados.
 * Total = precio base + páginas adicionales + extras seleccionados.
 * No depende de Express: se puede usar y probar por separado.
 */
export function calcularPresupuesto({ tipo, paginas, formulario, segundoIdioma }) {
  const base = TARIFAS[tipo];
  const paginasAdicionales = (paginas - 1) * TARIFAS.paginaAdicional;
  const costeFormulario = formulario ? TARIFAS.formulario : 0;
  const costeSegundoIdioma = segundoIdioma ? TARIFAS.segundoIdioma : 0;

  return {
    base,
    paginasAdicionales,
    formulario: costeFormulario,
    segundoIdioma: costeSegundoIdioma,
    total: base + paginasAdicionales + costeFormulario + costeSegundoIdioma,
    moneda: MONEDA,
  };
}
