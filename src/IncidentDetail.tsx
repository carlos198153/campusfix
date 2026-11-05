import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  UserRound,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Save,
  LoaderCircle,
} from "lucide-react";
import { dataService } from "./lib/data";
import { useRefresh } from "./hooks";
import { STATUSES, type IncidentStatus } from "./types";
import {
  StatusBadge,
  Loading,
  ErrorState,
  useSession,
  useToast,
  dateFormat,
} from "./ui";
import ReportPhoto from "./ReportPhoto";
const explanations: Record<string, string> = {
  Pendiente: "La administración revisará este reporte.",
  Urgente: "Este reporte necesita atención prioritaria.",
  Solucionado: "La administración marcó el problema como solucionado.",
};
export default function IncidentDetail() {
  const { id } = useParams(),
    location = useLocation(),
    navigate = useNavigate(),
    session = useSession(),
    toast = useToast(),
    refresh = useRefresh();
  const admin = session.user.role === "admin";
  const [chosen, setChosen] = useState<IncidentStatus | null>(null),
    [busy, setBusy] = useState(false);
  const {
    data: report,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["incidents", id],
    queryFn: () => dataService.getIncident(id!),
  });
  async function save() {
    if (!chosen) return;
    setBusy(true);
    try {
      await dataService.updateIncident(id!, { status: chosen });
      refresh();
      toast(
        chosen === "Solucionado"
          ? "Reporte solucionado. Ahora está en Arreglados."
          : "Estado del reporte actualizado.",
      );
      if (chosen === "Solucionado") navigate("/arreglados");
      setChosen(null);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "No se pudo actualizar el estado.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <Loading />;
  if (error || !report)
    return (
      <ErrorState
        error={error || new Error("No encontramos este reporte.")}
        retry={() => refetch()}
      />
    );
  return (
    <div className="detail-page">
      <Link
        className="back-link"
        to={report.status === "Solucionado" ? "/arreglados" : "/"}
      >
        <ArrowLeft size={17} />
        {report.status === "Solucionado"
          ? "Volver a Arreglados"
          : admin
            ? "Volver a reportes"
            : "Volver a mis reportes"}
      </Link>
      {location.state?.sent && (
        <div className="sent-banner">
          <CheckCircle2 size={24} />
          <div>
            <strong>¡Recibimos tu reporte!</strong>
            <p>
              La administración ya puede revisarlo. Aquí verás las
              actualizaciones.
            </p>
          </div>
        </div>
      )}
      <article className="report-detail">
        <div className="detail-photo">
          <ReportPhoto report={report} large />
        </div>
        <div className="detail-content">
          <div className="detail-top">
            <StatusBadge status={report.status} />
            <span>{report.folio}</span>
          </div>
          <h1>{report.title}</h1>
          <p className="detail-description">{report.description}</p>
          <div className="detail-byline">
            <span>
              <CalendarDays size={16} />
              {dateFormat(report.created_at)}
            </span>
            {admin && (
              <span>
                <UserRound size={16} />
                {report.reporter_name || "Estudiante"}
              </span>
            )}
          </div>
          <section className="status-explanation">
            <span
              className={
                "status-icon status-icon-" + report.status.toLowerCase()
              }
            >
              {report.status === "Solucionado" ? (
                <CheckCircle2 size={22} />
              ) : report.status === "Urgente" ? (
                <AlertCircle size={22} />
              ) : (
                <Clock3 size={22} />
              )}
            </span>
            <div>
              <h2>{report.status}</h2>
              <p>{explanations[report.status]}</p>
              {report.resolved_at && (
                <small>Solucionado el {dateFormat(report.resolved_at)}</small>
              )}
            </div>
          </section>
          {admin && (
            <section className="change-status">
              <h2>Cambiar estado</h2>
              <p>Selecciona cómo se encuentra el problema.</p>
              <div
                className="status-options"
                role="group"
                aria-label="Estado del reporte"
              >
                {STATUSES.map((status) => (
                  <button
                    type="button"
                    aria-pressed={(chosen || report.status) === status}
                    className={
                      "status-option " +
                      ((chosen || report.status) === status ? "selected" : "")
                    }
                    onClick={() => setChosen(status)}
                    key={status}
                  >
                    {status === "Pendiente" ? (
                      <Clock3 size={17} />
                    ) : status === "Urgente" ? (
                      <AlertCircle size={17} />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}{" "}
                    {status}
                  </button>
                ))}
              </div>
              <button
                className="button primary"
                disabled={busy || !chosen || chosen === report.status}
                onClick={save}
              >
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Save size={17} />
                )}{" "}
                {busy ? "Guardando…" : "Guardar estado"}
              </button>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
