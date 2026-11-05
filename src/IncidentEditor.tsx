import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  X,
  Send,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import { dataService, STUDENT_INCIDENT_DEFAULTS } from "./lib/data";
import { incidentSchema, readableError } from "./lib/validation";
import { useRefresh } from "./hooks";
import { useToast } from "./ui";
const reportSchema = incidentSchema.pick({ title: true, description: true });
type ReportForm = { title: string; description: string };
export default function IncidentEditor() {
  const navigate = useNavigate(),
    toast = useToast(),
    refresh = useRefresh();
  const camera = useRef<HTMLInputElement>(null),
    gallery = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: { title: "", description: "" },
  });
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function chooseFile(selected?: File) {
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Elige una foto JPG, PNG o WebP.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("La foto debe pesar menos de 5 MB.");
      return;
    }
    setError("");
    setFile(selected);
  }
  async function submit(values: ReportForm) {
    setError("");
    try {
      const photo = file ? await dataService.uploadPhoto(file) : null;
      const report = await dataService.createIncident({
        ...STUDENT_INCIDENT_DEFAULTS,
        ...values,
        photo_url: photo,
      });
      refresh();
      toast("¡Listo! Tu reporte ya fue enviado.");
      navigate("/reporte/" + report.id, { state: { sent: true } });
    } catch (err) {
      setError(readableError(err));
    }
  }
  return (
    <div className="form-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={17} />
        Volver a mis reportes
      </Link>
      <div className="form-heading">
        <h1>Hacer un reporte</h1>
        <p>¿Qué está pasando? Con estos datos podemos empezar.</p>
      </div>
      <form className="report-form" onSubmit={handleSubmit(submit)}>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <section className="photo-section">
          <div className="field-heading">
            <label htmlFor="report-photo">
              Fotografía <span>(opcional)</span>
            </label>
            <small>JPG, PNG o WebP · hasta 5 MB</small>
          </div>
          <input
            ref={camera}
            id="report-photo"
            className="sr-only"
            type="file"
            capture="environment"
            accept="image/jpeg,image/png,image/webp"
            tabIndex={-1}
            onChange={(e) => {
              chooseFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={gallery}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            tabIndex={-1}
            aria-label="Elegir fotografía"
            onChange={(e) => {
              chooseFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {preview ? (
            <div className="selected-photo">
              <img src={preview} alt="Fotografía que se adjuntará al reporte" />
              <button
                type="button"
                className="remove-photo"
                aria-label="Quitar fotografía"
                onClick={() => setFile(null)}
              >
                <X size={18} />
              </button>
              <span>
                <CheckCircle2 size={16} />
                Foto lista para enviar
              </span>
            </div>
          ) : (
            <div className="photo-upload">
              <span className="photo-upload-icon">
                <Camera size={33} />
              </span>
              <strong>Una imagen ayuda a entender el problema.</strong>
              <p>Puedes tomar una foto ahora o elegir una de tu dispositivo.</p>
              <div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => camera.current?.click()}
                >
                  <Camera size={18} />
                  Tomar foto
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => gallery.current?.click()}
                >
                  <ImagePlus size={18} />
                  Subir foto
                </button>
              </div>
            </div>
          )}
        </section>
        <label>
          Título <span className="required">*</span>
          <input
            {...register("title")}
            maxLength={150}
            placeholder="Ej. No prende el aire del salón"
            aria-invalid={!!errors.title}
          />
          {errors.title && (
            <small className="field-error" role="alert">
              {errors.title.message}
            </small>
          )}
        </label>
        <label>
          Descripción <span className="required">*</span>
          <textarea
            {...register("description")}
            rows={5}
            maxLength={5000}
            placeholder="Cuéntanos qué falta o qué falla. Incluye el salón, edificio o lugar para poder encontrarlo."
            aria-invalid={!!errors.description}
          />
          {errors.description ? (
            <small className="field-error" role="alert">
              {errors.description.message}
            </small>
          ) : (
            <small>
              Incluye dónde sucede y cualquier detalle que ayude a atenderlo.
            </small>
          )}
        </label>
        <div className="form-submit-row">
          <span>
            Tu reporte se enviará como <strong>Pendiente.</strong>
          </span>
          <button className="button primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle size={19} className="spin" />
            ) : (
              <Send size={18} />
            )}{" "}
            {isSubmitting ? "Enviando…" : "Enviar reporte"}
          </button>
        </div>
      </form>
      <p className="privacy-note">
        Un administrador revisará tu reporte y actualizará su estado.
      </p>
    </div>
  );
}
