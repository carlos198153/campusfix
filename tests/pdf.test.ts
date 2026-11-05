import { describe, expect, it } from "vitest";
import { createDemoData } from "../src/lib/demo";
import {
  generateIncidentPdf,
  generateIncidentsPdf,
  generateStatsPdf,
  generateUsersPdf,
} from "../src/lib/pdf";

describe("Reportes PDF", () => {
  it("genera orden de trabajo individual válida con marca, tabla y observaciones", () => {
    const incident = createDemoData().incidents[0];
    const doc = generateIncidentPdf(incident, {
      observations: "Priorizar la revisión antes del siguiente turno.",
      generatedBy: "Coordinación UNACAR",
    });
    const content = doc.output("arraybuffer");
    expect(
      new TextDecoder().decode(new Uint8Array(content).slice(0, 8)),
    ).toContain("%PDF-");
    expect(content.byteLength).toBeGreaterThan(2000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output()).toContain(`/Title (Orden de trabajo`);
    expect(doc.output()).toContain(incident.folio);
  });
  it("pagina reportes grandes y respeta el límite solicitado", () => {
    const incidents = createDemoData().incidents;
    const many = Array.from({ length: 180 }, (_, index) => ({
      ...incidents[index % incidents.length],
      id: `test-${index}`,
    }));
    const complete = generateIncidentsPdf(many, {
      title: "Mantenimiento UNACAR",
    });
    const limited = generateIncidentsPdf(many, { maxRecords: 2 });
    expect(complete.getNumberOfPages()).toBeGreaterThan(3);
    expect(limited.getNumberOfPages()).toBe(1);
    expect(complete.output("arraybuffer").byteLength).toBeGreaterThan(
      limited.output("arraybuffer").byteLength,
    );
  });
  it("genera reportes estadísticos y listados vacíos sin errores", () => {
    expect(generateStatsPdf([]).getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(
      generateIncidentsPdf([]).output("arraybuffer").byteLength,
    ).toBeGreaterThan(1000);
    expect(generateStatsPdf(createDemoData().incidents).output()).toContain(
      "/Title (Reporte estad",
    );
  });
  it("permite un reporte del directorio de usuarios", () => {
    const doc = generateUsersPdf(createDemoData().profiles);
    expect(doc.output()).toContain("/Title (Directorio");
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(2000);
  });
});
