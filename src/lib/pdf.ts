import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  CATEGORIES,
  STATUSES,
  type Incident,
  type ReportOptions,
} from "../types";

const navy: [number, number, number] = [8, 30, 64];
const blue: [number, number, number] = [16, 96, 224];
const gray: [number, number, number] = [94, 111, 134];
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Mexico_City",
      })
    : "Sin registrar";

function lastY(doc: jsPDF) {
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 43
  );
}
function clean(value: unknown) {
  return String(value ?? "").replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
    "",
  );
}

function brandMark(doc: jsPDF, x: number, y: number) {
  doc.setFillColor(...blue);
  doc.roundedRect(x, y, 11, 11, 3, 3, "F");
  doc.setFillColor(255, 255, 255);
  doc
    .path([
      { op: "m", c: [x + 1.7, y + 6.7] },
      { op: "c", c: [x + 3.6, y + 2.4, x + 7.5, y + 2.8, x + 8.5, y + 5.6] },
      { op: "l", c: [x + 10, y + 5.9] },
      { op: "l", c: [x + 8.1, y + 6.4] },
      { op: "c", c: [x + 7.1, y + 5.4, x + 4.2, y + 4.7, x + 2.5, y + 7.6] },
      { op: "l", c: [x + 1.7, y + 6.7] },
      { op: "h", c: [] },
    ])
    .fill();
  doc.triangle(x + 4.5, y + 4, x + 5.8, y + 1.8, x + 6.2, y + 4.3, "F");
  doc.setDrawColor(159, 220, 255);
  doc.setLineWidth(0.45);
  doc.line(x + 2.2, y + 8.7, x + 8.8, y + 8.7);
}

function decorate(
  doc: jsPDF,
  title: string,
  options: ReportOptions,
  total: number,
) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const generated = new Date().toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    brandMark(doc, 14, 10);
    doc
      .setFont("helvetica", "bold")
      .setFontSize(16)
      .setTextColor(...navy);
    doc.text("CampusFix", 29, 15);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(...gray);
    doc.text("UNACAR · Universidad Autónoma del Carmen", 29, 20);
    doc.setFontSize(7.5);
    doc.text(`Emitido: ${generated}`, width - 14, 14, { align: "right" });
    if (options.generatedBy)
      doc.text(clean(options.generatedBy).slice(0, 55), width - 14, 19, {
        align: "right",
      });
    doc
      .setDrawColor(220, 229, 241)
      .setLineWidth(0.3)
      .line(14, 25, width - 14, 25);
    doc
      .setFont("helvetica", "bold")
      .setFontSize(12)
      .setTextColor(...navy);
    const titleLines = doc.splitTextToSize(
      clean(title),
      width - 28,
    ) as string[];
    doc.text(titleLines.slice(0, 1), 14, 33);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .setTextColor(...gray);
    if (options.subtitle)
      doc.text(
        (
          doc.splitTextToSize(clean(options.subtitle), width - 28) as string[]
        ).slice(0, 1),
        14,
        38,
      );
    doc
      .setDrawColor(220, 229, 241)
      .line(14, height - 16, width - 14, height - 16);
    doc.setFontSize(7.5).setTextColor(...gray);
    doc.text(
      `Reporta, gestiona y transforma tu campus · ${total} registro${total === 1 ? "" : "s"}`,
      14,
      height - 10,
    );
    doc.text(`Página ${page} de ${pages}`, width - 14, height - 10, {
      align: "right",
    });
  }
  doc.setProperties({
    title,
    subject: "Gestión de mantenimiento universitario UNACAR",
    author: "CampusFix · UNACAR",
    creator: "CampusFix",
  });
  return doc;
}

function tableStyles() {
  return {
    font: "helvetica",
    fontSize: 8,
    cellPadding: 3,
    textColor: navy,
    lineColor: [229, 235, 244] as [number, number, number],
    lineWidth: 0.1,
    overflow: "linebreak" as const,
  };
}

function observationTable(doc: jsPDF, observations: string) {
  if (!observations.trim()) return;
  autoTable(doc, {
    startY: lastY(doc) + 7,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["Observaciones generales"]],
    body: [[clean(observations)]],
    styles: tableStyles(),
    headStyles: { fillColor: navy, fontStyle: "bold" },
    theme: "grid",
  });
}

export function generateIncidentPdf(
  incident: Incident,
  options: ReportOptions = {},
): jsPDF {
  const doc = new jsPDF({ format: "a4", compress: true });
  const title = options.title || `Orden de trabajo · ${incident.folio}`;
  autoTable(doc, {
    startY: 44,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["INFORMACIÓN DE LA INCIDENCIA", ""]],
    body: [
      ["Folio", incident.folio],
      ["Título", clean(incident.title)],
      ["Estado / Prioridad", `${incident.status} / ${incident.priority}`],
      ["Categoría", incident.category],
      ["Edificio o área", clean(incident.building)],
      ["Ubicación específica", clean(incident.location)],
      ["Reportado por", clean(incident.reporter_name || "Usuario registrado")],
      ["Responsable", clean(incident.assignee_name || "Sin asignar")],
      ["Fecha de registro", date(incident.created_at)],
      ["Última actualización", date(incident.updated_at)],
      ["Fecha de resolución", date(incident.resolved_at)],
    ],
    styles: tableStyles(),
    headStyles: { fillColor: blue, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 249, 253] },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" } },
    theme: "grid",
  });
  autoTable(doc, {
    startY: lastY(doc) + 7,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["Descripción del problema"]],
    body: [[clean(incident.description)]],
    styles: tableStyles(),
    headStyles: { fillColor: navy },
    theme: "grid",
  });
  if (incident.observations)
    autoTable(doc, {
      startY: lastY(doc) + 7,
      margin: { top: 44, bottom: 24, left: 14, right: 14 },
      head: [["Seguimiento y observaciones"]],
      body: [[clean(incident.observations)]],
      styles: tableStyles(),
      headStyles: { fillColor: navy },
      theme: "grid",
    });
  observationTable(doc, options.observations ?? "");
  autoTable(doc, {
    startY: lastY(doc) + 12,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    body: [
      [
        "Responsable de atención\n\n____________________________",
        "Validación del área solicitante\n\n____________________________",
      ],
    ],
    styles: { ...tableStyles(), minCellHeight: 22, halign: "center" },
    theme: "plain",
  });
  return decorate(doc, title, options, 1);
}

function selected(incidents: Incident[], options: ReportOptions): Incident[] {
  const active = incidents.filter((incident) => !incident.deleted_at);
  return options.maxRecords && Number.isFinite(options.maxRecords)
    ? active.slice(0, Math.max(1, Math.floor(options.maxRecords)))
    : active;
}

export function generateIncidentsPdf(
  incidents: Incident[],
  options: ReportOptions = {},
): jsPDF {
  const doc = new jsPDF({
    orientation: "landscape",
    format: "a4",
    compress: true,
  });
  const records = selected(incidents, options);
  const title = options.title || "Reporte general de incidencias";
  autoTable(doc, {
    startY: 44,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["Folio", "Fecha", "Título", "Descripción", "Reportado por", "Estado"]],
    body: records.map((item) => [
      item.folio,
      date(item.created_at),
      clean(item.title),
      clean(item.description),
      clean(item.reporter_name || "Usuario registrado"),
      item.status,
    ]),
    styles: { ...tableStyles(), fontSize: 7.5 },
    headStyles: { fillColor: blue, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 249, 253] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 24 },
      2: { cellWidth: 45 },
      3: { cellWidth: 100 },
      4: { cellWidth: 42 },
      5: { cellWidth: 28 },
    },
    theme: "grid",
  });
  if (!records.length)
    autoTable(doc, {
      startY: lastY(doc) + 5,
      margin: { top: 44, bottom: 24, left: 14, right: 14 },
      body: [
        ["No hay incidencias que coincidan con los filtros seleccionados."],
      ],
      styles: tableStyles(),
      theme: "plain",
    });
  observationTable(doc, options.observations ?? "");
  return decorate(doc, title, options, records.length);
}

export function generateStatsPdf(
  incidents: Incident[],
  options: ReportOptions = {},
): jsPDF {
  const doc = new jsPDF({ format: "a4", compress: true });
  const records = selected(incidents, options);
  const title = options.title || "Reporte estadístico de mantenimiento";
  const count = (status: Incident["status"]) =>
    records.filter((item) => item.status === status).length;
  const resolved = count("Solucionado");
  const high = records.filter(
    (item) =>
      ["Alta", "Crítica"].includes(item.priority) &&
      item.status !== "Solucionado",
  ).length;
  autoTable(doc, {
    startY: 44,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["Indicador", "Resultado"]],
    body: [
      ["Incidencias registradas", String(records.length)],
      ["Pendientes de atención", String(count("Pendiente"))],
      ["Urgente", String(count("Urgente"))],
      ["Solucionados", String(resolved)],
      ["Prioridad alta o crítica sin solucionar", String(high)],
      [
        "Porcentaje de resolución",
        `${records.length ? Math.round((resolved / records.length) * 100) : 0}%`,
      ],
    ],
    styles: tableStyles(),
    headStyles: { fillColor: blue },
    alternateRowStyles: { fillColor: [246, 249, 253] },
    theme: "grid",
  });
  autoTable(doc, {
    startY: lastY(doc) + 8,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["Distribución por estado", "Incidencias", "Porcentaje"]],
    body: STATUSES.map((status) => [
      status,
      String(count(status)),
      `${records.length ? Math.round((count(status) / records.length) * 100) : 0}%`,
    ]),
    styles: tableStyles(),
    headStyles: { fillColor: navy },
    alternateRowStyles: { fillColor: [246, 249, 253] },
    theme: "grid",
  });
  autoTable(doc, {
    startY: lastY(doc) + 8,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["Distribución por categoría", "Incidencias"]],
    body: CATEGORIES.map((category) => [
      category,
      String(records.filter((item) => item.category === category).length),
    ]),
    styles: tableStyles(),
    headStyles: { fillColor: navy },
    alternateRowStyles: { fillColor: [246, 249, 253] },
    theme: "grid",
  });
  observationTable(doc, options.observations ?? "");
  return decorate(doc, title, options, records.length);
}

export function generateUsersPdf(
  users: import("../types").Profile[],
  options: ReportOptions = {},
): jsPDF {
  const doc = new jsPDF({
    orientation: "landscape",
    format: "a4",
    compress: true,
  });
  const records = options.maxRecords
    ? users.slice(0, options.maxRecords)
    : users;
  autoTable(doc, {
    startY: 44,
    margin: { top: 44, bottom: 24, left: 14, right: 14 },
    head: [["Nombre", "Correo", "Departamento", "Rol", "Cuenta", "Registro"]],
    body: records.map((user) => [
      clean(user.full_name),
      clean(user.email),
      clean(user.department || "Sin especificar"),
      user.role === "admin" ? "Administrador" : "Usuario",
      user.active ? "Activa" : "Inactiva",
      date(user.created_at),
    ]),
    styles: tableStyles(),
    headStyles: { fillColor: blue },
    alternateRowStyles: { fillColor: [246, 249, 253] },
    theme: "grid",
  });
  observationTable(doc, options.observations ?? "");
  return decorate(
    doc,
    options.title || "Directorio de usuarios CampusFix",
    options,
    records.length,
  );
}

export function printPdf(doc: jsPDF): string {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.setAttribute("aria-label", "Documento PDF para impresión");
  frame.src = url;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  document.body.appendChild(frame);
  // Retain the frame while the native print dialog is open.
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120000);
  return url;
}
