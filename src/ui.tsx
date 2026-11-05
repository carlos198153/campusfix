import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, X, LoaderCircle, AlertCircle, ChevronDown } from "lucide-react";
import type { AuthSession } from "./types";

export const SessionContext = createContext<AuthSession | null>(null);
export function useSession() {
  return useContext(SessionContext)!;
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  return (
    <ToastContext.Provider
      value={(message, error) => {
        setToast({ message, error });
        window.setTimeout(() => setToast(null), 5000);
      }}
    >
      {children}
      {toast && (
        <div role="status" className={"toast " + (toast.error ? "error" : "")}>
          {toast.error ? <AlertCircle size={20} /> : <Check size={20} />}
          <span>{toast.message}</span>
          <button
            aria-label="Cerrar notificación"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export function Dolphin({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 86"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 61C8 64 17 61 22 52C31 35 42 23 58 20C56 13 60 6 67 2C66 12 71 17 76 21C86 23 96 30 101 34L117 37C120 38 120 40 117 41L104 42C95 53 82 57 68 55C68 63 63 71 54 74C58 66 55 60 50 56C38 54 30 57 22 63C19 73 10 82 0 78L7 69Z" />
      <circle cx="97" cy="35" r="1.5" fill="var(--navy,#102d54)" />
    </svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Dolphin />
      </span>
      <div>
        <strong>
          Campus<span>Fix</span>
        </strong>
        {!compact && <small>UNACAR · MANTENIMIENTO</small>}
      </div>
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={"badge status-" + status.toLowerCase().replaceAll(" ", "-")}
    >
      <i />
      {status}
    </span>
  );
}
export function Priority({ value }: { value: string }) {
  return (
    <span className={"priority priority-" + value.toLowerCase()}>
      <span className="priority-bars">
        <i />
        <i />
        <i />
      </span>
      {value}
    </span>
  );
}
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onEscape: () => void,
) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const selector =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
    const items = () =>
      Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.closest("[hidden]"),
      );
    items()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        escapeRef.current();
      }
      if (event.key === "Tab") {
        const focusable = items();
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !root.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !root.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [enabled, ref]);
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useFocusTrap(ref, true, onClose);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <header>
          <h2>{title}</h2>
          <button
            aria-label="Cerrar ventana"
            className="icon-button"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" size={28} />
      <p>Cargando información…</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="empty">
      <AlertCircle size={28} />
      <h3>No pudimos cargar la información</h3>
      <p>
        {error instanceof Error
          ? error.message
          : "Revisa tu conexión e intenta de nuevo."}
      </p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Volver a intentar
        </button>
      )}
    </div>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
}) {
  return (
    <label className="select-wrap">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o === options[0] ? "" : o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}
export const dateFormat = (value: string) =>
  new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
