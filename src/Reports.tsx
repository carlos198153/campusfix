import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileDown,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { dataService, getWeekRange } from "./lib/data";
import { generateIncidentsPdf } from "./lib/pdf";
import { StatusBadge, useSession, useToast, ErrorState, Loading } from "./ui";
function currentWeek() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(today + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
function mondayOf(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return currentWeek();
  const date = new Date(value + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return currentWeek();
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
function longDate(value: string) {
  return new Date(value + "T12:00:00Z").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}
export default function Reports() {
  const session = useSession(),
    toast = useToast();
  const [week, setWeek] = useState(currentWeek),
    [busy, setBusy] = useState(false);
  const range = getWeekRange(week);
  const {
    data: reports = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["weekly", week],
    queryFn: () => dataService.getWeeklyIncidents(week),
  });
  async function download() {
    setBusy(true);
    try {
      const rows = await dataService.getWeeklyIncidents(week);
      generateIncidentsPdf(rows, {
        title: "Reporte semanal de incidencias",
        subtitle: longDate(range.dateFrom) + " al " + longDate(range.dateTo),
        generatedBy: session.user.full_name,
        maxRecords: rows.length || 1,
      }).save("CampusFix-semana-" + week + ".pdf");
      toast("Tu reporte semanal se descargó en PDF.");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "No se pudo generar el reporte.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="weekly-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={17} />
        Volver a reportes
      </Link>
      <div className="form-heading">
        <h1>Reporte semanal en PDF</h1>
        <p>
          Elige una semana y descarga los reportes que se recibieron en esos
          días.
        </p>
      </div>
      <section className="weekly-settings">
        <span className="weekly-icon">
          <FileDown size={32} />
        </span>
        <div>
          <label>
            Semana del
            <input
              type="date"
              value={week}
              onChange={(e) => setWeek(mondayOf(e.target.value))}
              required
            />
          </label>
          <p>
            <CalendarDays size={16} />
            {longDate(range.dateFrom)} al {longDate(range.dateTo)}
          </p>
          <small>De lunes a domingo · hora de Ciudad de México.</small>
        </div>
        <button
          className="button primary"
          onClick={download}
          disabled={busy || isPending || !!error}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <FileDown size={18} />
          )}{" "}
          {busy ? "Generando PDF…" : "Descargar PDF semanal"}
        </button>
      </section>
      <section className="weekly-records">
        <div className="section-heading">
          <div>
            <h2>{reports.length} reportes esta semana</h2>
            <p>Estos son los registros que se incluirán en el documento.</p>
          </div>
          <span className="admin-only">
            <CheckCircle2 size={16} />
            Solo administradores
          </span>
        </div>
        {error ? (
          <ErrorState error={error} retry={() => refetch()} />
        ) : isPending ? (
          <Loading />
        ) : reports.length ? (
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <Link to={"/reporte/" + report.id}>
                  <strong>{report.title}</strong>
                  <small>
                    {report.folio} · {report.reporter_name || "Estudiante"}
                  </small>
                </Link>
                <StatusBadge status={report.status} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <CalendarDays size={32} />
            <h3>No se recibieron reportes esta semana</h3>
            <p>Puedes elegir otra semana o descargar el PDF sin registros.</p>
          </div>
        )}
      </section>
    </div>
  );
}
