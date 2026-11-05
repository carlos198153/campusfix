import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ArrowRight,
  Camera,
  PencilLine,
  CheckCircle2,
  Search,
  ClipboardList,
  FileDown,
} from "lucide-react";
import { useIncidents } from "./hooks";
import { Dolphin, StatusBadge, ErrorState, dateFormat, useSession } from "./ui";
import ReportPhoto from "./ReportPhoto";
export default function Incidents({
  resolved = false,
}: {
  resolved?: boolean;
}) {
  const session = useSession(),
    admin = session.user.role === "admin";
  const { data: reports = [], isPending, error, refetch } = useIncidents();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [visible, setVisible] = useState(3);
  const sectionReports = useMemo(
    () =>
      reports.filter(
        (report) => (report.status === "Solucionado") === resolved,
      ),
    [reports, resolved],
  );
  const filtered = useMemo(
    () =>
      sectionReports.filter(
        (r) =>
          (!status || r.status === status) &&
          (r.title + " " + r.description + " " + r.folio)
            .toLocaleLowerCase("es")
            .includes(search.toLocaleLowerCase("es")),
      ),
    [sectionReports, status, search],
  );
  return (
    <>
      {admin || resolved ? (
        <section className="admin-heading">
          <div>
            <h1>
              {resolved
                ? "Problemas que ya se arreglaron."
                : "Los reportes de nuestro campus."}
            </h1>
            <p>
              {resolved
                ? "Los problemas solucionados se guardan aquí para que puedas consultarlos."
                : "Atiende los reportes pendientes y urgentes. Al solucionarlos, pasan a Arreglados."}
            </p>
          </div>
          <Link className="button primary" to="/nuevo">
            <Plus size={19} />
            Hacer un reporte
          </Link>
        </section>
      ) : (
        <>
          <section className="report-hero">
            <div className="hero-copy">
              <h1>
                ¿Algo no funciona
                <br />
                en tu campus?
              </h1>
              <p>
                Cuéntanos qué falta o qué necesita atención.
                <br />
                Tu reporte nos ayuda a mejorar la UNACAR.
              </p>
              <Link className="button hero-button" to="/nuevo">
                <Plus size={21} />
                Hacer un reporte
                <ArrowRight size={18} />
              </Link>
            </div>
            <div className="hero-dolphin-art">
              <span className="dolphin-circle" />
              <Dolphin />
              <span className="dolphin-caption">Cuidamos nuestra UNACAR.</span>
            </div>
          </section>
          <div className="simple-steps">
            <span>
              <Camera size={20} />
              <strong>Agrega una foto</strong>
              <small>Si puedes, muéstranos el problema.</small>
            </span>
            <span>
              <PencilLine size={20} />
              <strong>Cuéntanos qué pasa</strong>
              <small>Solo un título y una descripción.</small>
            </span>
            <span>
              <CheckCircle2 size={20} />
              <strong>Consulta su estado</strong>
              <small>La administración le dará seguimiento.</small>
            </span>
          </div>
        </>
      )}
      <section className="reports-section">
        <div className="section-heading">
          <div>
            <h2>
              {resolved
                ? "Arreglados"
                : admin
                  ? "Reportes por atender"
                  : "Mis reportes por atender"}
              <span className="count">{sectionReports.length}</span>
            </h2>
            <p>
              {resolved
                ? "Estos reportes ya no aparecen en la lista por atender."
                : admin
                  ? "Abre un reporte para revisar la foto y actualizar su estado."
                  : "Aquí puedes ver cómo va la atención de lo que reportaste."}
            </p>
          </div>
          {admin && (
            <Link className="button secondary" to="/semanal">
              <FileDown size={17} />
              PDF semanal
            </Link>
          )}
        </div>
        {(sectionReports.length > 0 || search || status) && (
          <div className="report-filters">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Buscar reportes"
                placeholder="Buscar un reporte"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisible(3);
                }}
              />
            </label>
            {!resolved && (
              <label className="status-filter">
                <span className="sr-only">Filtrar por estado</span>
                <select
                  aria-label="Filtrar por estado"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setVisible(3);
                  }}
                >
                  <option value="">Pendientes y urgentes</option>
                  {["Pendiente", "Urgente"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {error ? (
          <ErrorState error={error} retry={() => refetch()} />
        ) : isPending ? (
          <div className="report-grid">
            {[1, 2, 3].map((i) => (
              <div className="skeleton-card" key={i}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <>
            <div className="report-grid">
              {filtered.slice(0, visible).map((report) => (
                <Link
                  className="report-card"
                  key={report.id}
                  to={"/reporte/" + report.id}
                >
                  <ReportPhoto report={report} />
                  <div className="report-card-content">
                    <div className="report-meta">
                      <StatusBadge status={report.status} />
                      <time dateTime={report.created_at}>
                        {dateFormat(report.created_at)}
                      </time>
                    </div>
                    <h3>{report.title}</h3>
                    <p>{report.description}</p>
                    <div className="card-bottom">
                      <span>
                        {admin
                          ? report.reporter_name || "Estudiante"
                          : report.folio}
                      </span>
                      <strong>
                        {admin ? "Revisar reporte" : "Ver reporte"}
                        <ArrowRight size={15} />
                      </strong>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {visible < filtered.length && (
              <button
                className="button secondary load-more"
                onClick={() => setVisible(visible + 3)}
              >
                Ver más reportes
              </button>
            )}
          </>
        ) : (
          <div className="empty empty-reports">
            <ClipboardList size={36} />
            <h3>
              {search || status
                ? "No encontramos reportes con ese filtro"
                : resolved
                  ? "Todavía no hay reportes arreglados"
                  : reports.length
                    ? "No hay reportes por atender"
                    : "Tu primer reporte empieza aquí"}
            </h3>
            <p>
              {search || status
                ? "Prueba otro título o cambia el estado."
                : resolved
                  ? "Cuando un administrador marque un reporte como solucionado, aparecerá aquí."
                  : reports.length
                    ? "Los reportes solucionados están en Arreglados. Puedes enviar uno nuevo si hace falta."
                    : "Si algo falta o no funciona, cuéntanos. Es rápido y sencillo."}
            </p>
            {search || status ? (
              <button
                className="button secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                Ver todos
              </button>
            ) : resolved ? (
              <Link to="/" className="button secondary">
                Volver a reportes
              </Link>
            ) : (
              <Link to="/nuevo" className="button primary">
                <Plus size={18} />
                Hacer un reporte
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
