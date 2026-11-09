import PDFDocument from "pdfkit";

/**
 * Genera el PDF del presupuesto con PDFKit y devuelve un Buffer.
 * Recibe un documento ya validado y calculado por prepararDocumento().
 * Usa Helvetica (fuente estándar de PDF): admite tildes, ñ, «», ¿¡ y €.
 */

const COLOR = {
  marca: "#ea580c",
  texto: "#1c1917",
  suave: "#57534e",
  linea: "#e7e5e4",
  fondo: "#fff7ed",
};

const MARGEN = 50;

const euros = (n) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" }) + " €";

export function generarPDF(doc) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margins: { top: MARGEN, bottom: MARGEN + 20, left: MARGEN, right: MARGEN },
      bufferPages: true, // para numerar las páginas al final
      info: {
        Title: `Presupuesto · ${doc.cliente}`,
        Author: "Presupuesta mi web",
        Subject: "Presupuesto de proyecto web",
      },
    });

    const trozos = [];
    pdf.on("data", (t) => trozos.push(t));
    pdf.on("end", () => resolve(Buffer.concat(trozos)));
    pdf.on("error", reject);

    const ancho = pdf.page.width - MARGEN * 2;
    const izq = MARGEN;

    // Salta de página si no caben `alto` puntos
    const asegurarEspacio = (alto) => {
      if (pdf.y + alto > pdf.page.height - pdf.page.margins.bottom) pdf.addPage();
    };

    const titulo = (texto) => {
      asegurarEspacio(50);
      pdf.moveDown(0.9);
      pdf.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.marca).text(texto.toUpperCase(), izq, pdf.y, {
        characterSpacing: 0.8,
      });
      const y = pdf.y + 3;
      pdf.moveTo(izq, y).lineTo(izq + ancho, y).lineWidth(0.8).strokeColor(COLOR.linea).stroke();
      pdf.y = y + 8;
      pdf.font("Helvetica").fontSize(10).fillColor(COLOR.texto);
    };

    const lista = (items) => {
      for (const item of items) {
        asegurarEspacio(20);
        const y = pdf.y;
        pdf.circle(izq + 4, y + 5, 1.6).fillColor(COLOR.marca).fill();
        pdf.font("Helvetica").fontSize(10).fillColor(COLOR.texto).text(item, izq + 14, y, { width: ancho - 14 });
        pdf.moveDown(0.3);
      }
    };

    // ── Cabecera ────────────────────────────────────────────────
    pdf.rect(0, 0, pdf.page.width, 8).fill(COLOR.marca);
    pdf.font("Helvetica-Bold").fontSize(20).fillColor(COLOR.texto).text("Presupuesta ", izq, MARGEN, { continued: true });
    pdf.fillColor(COLOR.marca).text("mi web");
    pdf.font("Helvetica").fontSize(9).fillColor(COLOR.suave).text("Agencia de desarrollo web");
    pdf.font("Helvetica-Bold").fontSize(22).fillColor(COLOR.texto).text("PRESUPUESTO", izq, MARGEN, {
      width: ancho,
      align: "right",
    });
    pdf.font("Helvetica").fontSize(10).fillColor(COLOR.suave).text(doc.fecha, { width: ancho, align: "right" });

    // Datos del cliente
    pdf.y = MARGEN + 62;
    const yCaja = pdf.y;
    pdf.rect(izq, yCaja, ancho, 46).fill(COLOR.fondo);
    pdf.font("Helvetica").fontSize(8).fillColor(COLOR.suave).text("CLIENTE", izq + 14, yCaja + 10);
    pdf.font("Helvetica-Bold").fontSize(13).fillColor(COLOR.texto).text(doc.cliente, izq + 14, yCaja + 22, {
      width: ancho * 0.65,
      ellipsis: true,
      height: 16,
    });
    pdf.font("Helvetica").fontSize(8).fillColor(COLOR.suave).text("FECHA", izq, yCaja + 10, {
      width: ancho - 14,
      align: "right",
    });
    pdf.font("Helvetica-Bold").fontSize(11).fillColor(COLOR.texto).text(doc.fecha, izq, yCaja + 23, {
      width: ancho - 14,
      align: "right",
    });
    pdf.x = izq;
    pdf.y = yCaja + 46;

    // ── Resumen ─────────────────────────────────────────────────
    titulo("Resumen del proyecto");
    pdf.text(doc.resumen, izq, pdf.y, { width: ancho, lineGap: 2 });

    // ── Servicios ───────────────────────────────────────────────
    titulo("Servicios incluidos");
    for (const s of doc.servicios) {
      asegurarEspacio(40);
      pdf.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.texto).text(s.nombre, izq, pdf.y, { width: ancho });
      pdf.font("Helvetica").fontSize(9.5).fillColor(COLOR.suave).text(s.descripcion, { width: ancho, lineGap: 1 });
      pdf.moveDown(0.4);
    }

    // ── Desglose ────────────────────────────────────────────────
    titulo("Desglose de importes");
    const col = { concepto: izq + 8, cantidad: izq + ancho * 0.55, precio: izq + ancho * 0.66, importe: izq + ancho * 0.82 };
    const anchoNum = ancho * 0.16;
    const fila = (c, cant, precio, importe, { negrita = false, fondo = null, alto = 20 } = {}) => {
      asegurarEspacio(alto);
      const y = pdf.y;
      if (fondo) pdf.rect(izq, y, ancho, alto).fill(fondo);
      const ty = y + (alto - 10) / 2;
      pdf.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(COLOR.texto);
      pdf.text(c, col.concepto, ty, { width: col.cantidad - col.concepto - 8, lineBreak: false, ellipsis: true });
      pdf.text(cant, col.cantidad, ty, { width: col.precio - col.cantidad - 8, align: "right", lineBreak: false });
      pdf.text(precio, col.precio, ty, { width: anchoNum, align: "right", lineBreak: false });
      pdf.text(importe, col.importe, ty, { width: anchoNum - 8, align: "right", lineBreak: false });
      pdf.moveTo(izq, y + alto).lineTo(izq + ancho, y + alto).lineWidth(0.5).strokeColor(COLOR.linea).stroke();
      pdf.x = izq;
      pdf.y = y + alto;
    };

    fila("Concepto", "Cant.", "Precio unit.", "Importe", { negrita: true, fondo: COLOR.fondo });
    for (const l of doc.desglose.lineas) {
      fila(l.nombre, String(l.cantidad), euros(l.precioUnitario), euros(l.importe));
    }

    asegurarEspacio(40);
    const yTotal = pdf.y + 8;
    pdf.rect(izq + ancho * 0.5, yTotal, ancho * 0.5, 30).fill(COLOR.marca);
    pdf.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff").text("TOTAL", izq + ancho * 0.5 + 12, yTotal + 10);
    pdf.fontSize(14).text(euros(doc.desglose.total), izq, yTotal + 8, { width: ancho - 12, align: "right" });
    pdf.font("Helvetica").fontSize(8).fillColor(COLOR.suave).text("Importes en euros, sin impuestos.", izq, yTotal + 36, {
      width: ancho,
      align: "right",
    });
    pdf.x = izq;

    // ── Aclaraciones ────────────────────────────────────────────
    if (doc.dudas.length > 0 || doc.pendientes.length > 0) {
      titulo("Aclaraciones y aspectos pendientes");
      if (doc.dudas.length > 0) {
        pdf.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.texto).text("Por concretar con el cliente", izq, pdf.y);
        pdf.moveDown(0.3);
        lista(doc.dudas);
        pdf.moveDown(0.4);
      }
      if (doc.pendientes.length > 0) {
        asegurarEspacio(40);
        pdf.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.texto).text("Pendiente de valorar (no incluido en el total)", izq, pdf.y);
        pdf.moveDown(0.3);
        lista(doc.pendientes);
      }
    }

    // ── Condiciones ─────────────────────────────────────────────
    const condiciones =
      "Presupuesto calculado con las tarifas vigentes de Presupuesta mi web. Los aspectos pendientes de valorar no " +
      "están incluidos en el total y se presupuestarán por separado una vez concretados. Este documento no incluye " +
      "plazos de entrega ni otros compromisos, que se acordarán con el cliente.";
    pdf.font("Helvetica").fontSize(8).fillColor(COLOR.suave);
    pdf.moveDown(1);
    asegurarEspacio(pdf.heightOfString(condiciones, { width: ancho, lineGap: 1 }));
    pdf.text(condiciones, izq, pdf.y, { width: ancho, lineGap: 1 });

    // ── Pie con numeración ──────────────────────────────────────
    const { start, count } = pdf.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      pdf.switchToPage(i);
      const yPie = pdf.page.height - MARGEN;
      pdf.page.margins.bottom = 0; // permite escribir en el margen sin crear páginas
      pdf.moveTo(izq, yPie - 6).lineTo(izq + ancho, yPie - 6).lineWidth(0.5).strokeColor(COLOR.linea).stroke();
      pdf.font("Helvetica").fontSize(8).fillColor(COLOR.suave);
      pdf.text(`Presupuesto · ${doc.cliente}`, izq, yPie, { width: ancho * 0.7, lineBreak: false, ellipsis: true });
      pdf.text(`Página ${i - start + 1} de ${count}`, izq, yPie, { width: ancho, align: "right", lineBreak: false });
    }

    pdf.end();
  });
}
