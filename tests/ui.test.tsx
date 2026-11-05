import { webcrypto } from "node:crypto";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { dataService } from "../src/lib/data";

const pdf = vi.hoisted(() => ({ generate: vi.fn(), save: vi.fn() }));
vi.mock("../src/lib/pdf", () => ({
  generateIncidentsPdf: (records: unknown[], options: unknown) => {
    pdf.generate(records, options);
    return { save: pdf.save };
  },
}));
let container: HTMLDivElement;
let root: Root | null = null;
let client: QueryClient;
function RouteProbe() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}</output>;
}
async function mount(path: string) {
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <RouteProbe />
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
  });
}
async function until(predicate: () => boolean, label: string) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error(`${label}: ${container.textContent?.slice(0, 1200)}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}
function element<T extends HTMLElement>(selector: string): T {
  const found = container.querySelector<T>(selector);
  if (!found) throw new Error(`No se encontró ${selector}`);
  return found;
}
function button(
  text: string,
  scope: ParentNode = container,
): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll("button")).find(
    (control) => control.textContent?.trim() === text,
  );
  if (!found) throw new Error(`No se encontró el botón ${text}`);
  return found;
}
async function click(control: HTMLElement) {
  await act(async () => {
    control.click();
  });
}
async function fill(selector: string, value: string) {
  const control = element<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(selector);
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : control instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      control,
      value,
    );
    control.dispatchEvent(
      new Event(control instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
async function submit(selector: string) {
  await act(async () => {
    element(selector).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}
beforeEach(async () => {
  history.replaceState(null, "", "/");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("crypto", webcrypto);
  await dataService.enterDemo("admin");
  await dataService.resetDemo();
  await dataService.signOut();
  localStorage.setItem("campusfix.simple.onboarded", "1");
  pdf.generate.mockClear();
  pdf.save.mockClear();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(async () => {
  if (root)
    await act(async () => {
      root!.unmount();
    });
  root = null;
  client.clear();
  container.remove();
  await dataService.signOut();
  history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("CampusFix simplificado: flujos de estudiante y administración", () => {
  it("abre la recuperación después de inicializar sesión y consume el indicador una vez en StrictMode", async () => {
    history.replaceState({ test: "callback" }, "", "/?recovery=1&kept=yes");
    await mount("/");
    await until(
      () => element('[data-testid="route"]').textContent === "/restablecer",
      "ruta de recuperación tras callback",
    );
    expect(new URLSearchParams(location.search).has("recovery")).toBe(false);
    expect(new URLSearchParams(location.search).get("kept")).toBe("yes");
    expect(
      container.querySelector('input[autocomplete="new-password"]'),
    ).not.toBeNull();
  });
  it("muestra login sin sesión y registra un administrador después de verificar el NIP", async () => {
    await mount("/login");
    await until(
      () =>
        container.querySelector("h2")?.textContent === "Bienvenido a CampusFix",
      "inicio de sesión",
    );
    expect(container.querySelector(".main-nav")).toBeNull();
    await click(button("Crear cuenta de administrador"));
    await fill(".pin-input", "0000");
    await submit('[role="dialog"] form');
    expect(
      container.querySelector('[role="dialog"] [role="alert"]')?.textContent,
    ).toContain("NIP incorrecto");
    expect(
      container.querySelector('[role="dialog"] input[autocomplete="name"]'),
    ).toBeNull();
    await fill(".pin-input", "1324");
    await submit('[role="dialog"] form');
    await until(
      () =>
        container.querySelector(
          '[role="dialog"] input[autocomplete="name"]',
        ) !== null,
      "segundo paso de registro",
    );
    await fill(
      '[role="dialog"] input[autocomplete="name"]',
      "Administradora Integración",
    );
    await fill(
      '[role="dialog"] input[type="email"]',
      "admin.integracion@unacar.mx",
    );
    await fill('[role="dialog"] input[autocomplete="new-password"]', "a1234");
    await submit('[role="dialog"] form');
    await until(
      () => container.querySelector('nav a[href="/estudiantes"]') !== null,
      "sesión administrativa recién creada",
    );
    expect((await dataService.getSession())?.user.email).toBe(
      "admin.integracion@unacar.mx",
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it("redirige rutas administrativas y muestra al alumno sólo sus reportes y acciones", async () => {
    await dataService.enterDemo("user");
    await mount("/estudiantes");
    await until(
      () => container.querySelectorAll(".report-card").length > 0,
      "inicio del estudiante",
    );
    expect(element('[data-testid="route"]').textContent).toBe("/");
    expect(container.querySelector('nav a[href="/estudiantes"]')).toBeNull();
    expect(container.querySelector('nav a[href="/semanal"]')).toBeNull();
    expect(container.textContent).toContain("Mis reportes");
    expect(container.textContent).not.toContain("Descargar PDF");
    const own = await dataService.listIncidents();
    expect(own.every((record) => record.reporter_id === "demo-user")).toBe(
      true,
    );
    const ids = new Set(own.map((record) => "/reporte/" + record.id));
    expect(
      Array.from(container.querySelectorAll(".report-card")).every((link) =>
        ids.has(link.getAttribute("href")!),
      ),
    ).toBe(true);
    await fill('input[aria-label="Buscar reportes"]', "INC-000036");
    await until(
      () => container.querySelectorAll(".report-card").length === 1,
      "búsqueda en reportes propios",
    );
    expect(element(".report-card h3").textContent).toBe(
      "Aire acondicionado sin funcionar",
    );
  });
  it("crea un estudiante y elimina su acceso después de confirmar la acción", async () => {
    await dataService.enterDemo("admin");
    await mount("/estudiantes");
    await until(
      () => container.querySelectorAll(".student-list li").length > 0,
      "lista de estudiantes",
    );
    await click(button("Crear estudiante"));
    await fill('[role="dialog"] input[name="name"]', "Estudiante Integración");
    await fill(
      '[role="dialog"] input[name="email"]',
      "estudiante.integracion@unacar.mx",
    );
    await fill(
      '[role="dialog"] input[name="password"]',
      "Clave-estudiante-segura-2026",
    );
    await submit('[role="dialog"] form');
    await until(
      () =>
        container.querySelector(
          'button[aria-label="Eliminar a Estudiante Integración"]',
        ) !== null,
      "cuenta creada visible",
    );
    await click(
      element('button[aria-label="Eliminar a Estudiante Integración"]'),
    );
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Sus reportes se conservarán",
    );
    expect(
      container.querySelector(
        'button[aria-label="Eliminar a Estudiante Integración"]',
      ),
    ).not.toBeNull();
    await click(button("Eliminar acceso", element('[role="dialog"]')));
    await until(
      () =>
        container.querySelector(
          'button[aria-label="Eliminar a Estudiante Integración"]',
        ) === null,
      "acceso eliminado",
    );
    await expect(
      dataService.signIn(
        "estudiante.integracion@unacar.mx",
        "Clave-estudiante-segura-2026",
      ),
    ).rejects.toThrow("incorrectos");
  });
  it("envía un reporte con dos campos y foto opcional y abre su detalle sin controles administrativos", async () => {
    await dataService.enterDemo("user");
    await mount("/nuevo");
    await until(
      () => container.querySelector('input[name="title"]') !== null,
      "formulario simple",
    );
    expect(
      container.querySelector('input[capture="environment"]'),
    ).not.toBeNull();
    expect(button("Tomar foto")).not.toBeNull();
    expect(button("Subir foto")).not.toBeNull();
    expect(container.querySelector('select[name="status"]')).toBeNull();
    expect(container.querySelector('input[name="building"]')).toBeNull();
    await fill('input[name="title"]', "El lavabo del salón presenta una fuga");
    await fill(
      'textarea[name="description"]',
      "En el baño del edificio B hay una fuga junto al lavabo de planta baja.",
    );
    await submit("form.report-form");
    await until(
      () =>
        container.querySelector("h1")?.textContent ===
        "El lavabo del salón presenta una fuga",
      "detalle después del envío",
    );
    expect(container.textContent).toContain("¡Recibimos tu reporte!");
    expect(container.textContent).toContain("INC-000037");
    expect(container.querySelector(".status-explanation h2")?.textContent).toBe(
      "Pendiente",
    );
    expect(container.querySelector(".change-status")).toBeNull();
    expect(container.textContent).not.toContain("Descargar PDF");
    expect(
      (await dataService.getIncident((await dataService.listIncidents())[0].id))
        .photo_url,
    ).toBeNull();
  });
  it("permite cambiar los tres estados sólo al administrador y conserva la consulta del estudiante", async () => {
    await dataService.enterDemo("admin");
    await mount("/reporte/demo-incident-36");
    await until(
      () => container.querySelector(".change-status") !== null,
      "administración del reporte",
    );
    await click(button("Urgente", element(".status-options")));
    await click(button("Guardar estado"));
    await until(
      () =>
        container.querySelector(".status-explanation h2")?.textContent ===
        "Urgente",
      "estado urgente guardado",
    );
    await click(button("Solucionado", element(".status-options")));
    await click(button("Guardar estado"));
    await until(
      () =>
        element('[data-testid="route"]').textContent === "/arreglados" &&
        container.querySelector(
          '.report-card[href="/reporte/demo-incident-36"]',
        ) !== null,
      "reporte movido a Arreglados",
    );
    expect(
      (await dataService.getIncident("demo-incident-36")).resolved_at,
    ).toBeTruthy();
    expect(container.textContent).toContain("Ahora está en Arreglados");
    await click(element('nav a[href="/"]'));
    await fill('input[aria-label="Buscar reportes"]', "INC-000036");
    await until(
      () =>
        container.textContent?.includes(
          "No encontramos reportes con ese filtro",
        ) === true,
      "reporte solucionado fuera de la cola",
    );
    expect(
      container.querySelector('.report-card[href="/reporte/demo-incident-36"]'),
    ).toBeNull();
    await click(element('nav a[href="/arreglados"]'));
    await act(async () => {
      await dataService.enterDemo("user");
    });
    await until(
      () =>
        container.querySelector(
          '.report-card[href="/reporte/demo-incident-36"]',
        ) !== null,
      "reporte arreglado del estudiante",
    );
    const ownResolved = (await dataService.listIncidents()).filter(
      (report) => report.status === "Solucionado",
    );
    const ownIds = new Set(
      ownResolved.map((report) => "/reporte/" + report.id),
    );
    expect(
      Array.from(container.querySelectorAll(".report-card")).every((link) =>
        ownIds.has(link.getAttribute("href")!),
      ),
    ).toBe(true);
    await click(element('.report-card[href="/reporte/demo-incident-36"]'));
    await until(
      () =>
        container.querySelector(".change-status") === null &&
        container.querySelector(".status-explanation h2")?.textContent ===
          "Solucionado",
      "consulta del alumno sin edición",
    );
    expect(element(".back-link").getAttribute("href")).toBe("/arreglados");
    expect(container.querySelector('nav a[href="/semanal"]')).toBeNull();
  });
  it("devuelve a la lista por atender un reporte arreglado que el administrador reabre", async () => {
    await dataService.enterDemo("admin");
    await mount("/arreglados");
    await until(
      () =>
        container.querySelector(
          '.report-card[href="/reporte/demo-incident-32"]',
        ) !== null,
      "reporte arreglado inicial",
    );
    await click(element(".skip-link"));
    expect(element('[data-testid="route"]').textContent).toBe("/arreglados");
    expect(document.activeElement).toBe(element("main"));
    await click(element('.report-card[href="/reporte/demo-incident-32"]'));
    await until(
      () => container.querySelector(".change-status") !== null,
      "detalle para reabrir",
    );
    await click(button("Pendiente", element(".status-options")));
    await click(button("Guardar estado"));
    await until(
      () =>
        container.querySelector(".status-explanation h2")?.textContent ===
        "Pendiente",
      "reporte reabierto",
    );
    await click(element(".back-link"));
    await until(
      () =>
        container.querySelector('input[aria-label="Buscar reportes"]') !== null,
      "cola por atender",
    );
    await fill('input[aria-label="Buscar reportes"]', "INC-000032");
    await until(
      () =>
        container.querySelector(
          '.report-card[href="/reporte/demo-incident-32"]',
        ) !== null,
      "reporte pendiente en cola",
    );
    await click(element('nav a[href="/arreglados"]'));
    await fill('input[aria-label="Buscar reportes"]', "INC-000032");
    await until(
      () =>
        container.textContent?.includes(
          "No encontramos reportes con ese filtro",
        ) === true,
      "reporte fuera de arreglados",
    );
    expect(
      container.querySelector('.report-card[href="/reporte/demo-incident-32"]'),
    ).toBeNull();
    expect(
      (await dataService.getIncident("demo-incident-32")).resolved_at,
    ).toBeNull();
  });
  it("descarga un PDF semanal con exactamente los registros de la semana seleccionada", async () => {
    await dataService.enterDemo("admin");
    await mount("/semanal");
    await until(
      () => container.querySelector('input[type="date"]') !== null,
      "selector semanal",
    );
    await fill('input[type="date"]', "2026-11-02");
    const expected = await dataService.getWeeklyIncidents("2026-11-02");
    await until(
      () =>
        container.querySelectorAll(".weekly-records li").length ===
          expected.length && !button("Descargar PDF semanal").disabled,
      "registros semanales cargados",
    );
    await click(button("Descargar PDF semanal"));
    await until(() => pdf.save.mock.calls.length === 1, "PDF generado");
    expect(
      pdf.generate.mock.calls[0][0].map((record: { id: string }) => record.id),
    ).toEqual(expected.map((record) => record.id));
    expect(pdf.generate.mock.calls[0][1]).toMatchObject({
      title: "Reporte semanal de incidencias",
      generatedBy: "María Fernanda López",
    });
    expect(pdf.save).toHaveBeenCalledWith("CampusFix-semana-2026-11-02.pdf");
  });
});
