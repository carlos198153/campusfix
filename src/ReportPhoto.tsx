import { useQuery } from "@tanstack/react-query";
import { Camera, ImageOff, RotateCcw } from "lucide-react";
import { dataService } from "./lib/data";
import type { Incident } from "./types";
export default function ReportPhoto({
  report,
  large = false,
}: {
  report: Incident;
  large?: boolean;
}) {
  const {
    data: url,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["photo", report.photo_url],
    queryFn: () => dataService.resolvePhotoUrl(report.photo_url!),
    enabled: !!report.photo_url,
    staleTime: 45 * 60 * 1000,
  });
  if (!report.photo_url)
    return (
      <div className={"report-photo placeholder " + (large ? "large" : "")}>
        <Camera size={large ? 48 : 32} />
        <span>Sin fotografía</span>
      </div>
    );
  if (error)
    return (
      <div className="report-photo placeholder">
        <ImageOff size={30} />
        <span>No pudimos cargar la fotografía.</span>
        {large ? (
          <button
            type="button"
            aria-label="Reintentar fotografía"
            onClick={(event) => {
              event.preventDefault();
              refetch();
            }}
          >
            <RotateCcw size={15} />
            Reintentar
          </button>
        ) : (
          <span>Abre el reporte para reintentar.</span>
        )}
      </div>
    );
  if (isPending)
    return (
      <div
        className="report-photo photo-skeleton"
        aria-label="Cargando fotografía"
      />
    );
  return (
    <div className={"report-photo " + (large ? "large" : "")}>
      <img
        src={url}
        alt={"Fotografía del reporte: " + report.title}
        loading="lazy"
      />
    </div>
  );
}
