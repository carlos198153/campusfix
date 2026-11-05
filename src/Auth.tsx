import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  LoaderCircle,
  ArrowLeft,
} from "lucide-react";
import { dataService, isSupabaseConfigured } from "./lib/data";
import { Brand, Dolphin, Modal, useToast } from "./ui";
import { readableError, passwordSchema } from "./lib/validation";
export default function Auth({
  recovery = false,
  initialError = "",
}: {
  recovery?: boolean;
  initialError?: string;
}) {
  const navigate = useNavigate(),
    toast = useToast();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [forgot, setForgot] = useState(false),
    [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false),
    [enroll, setEnroll] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (recovery) {
        passwordSchema.parse(password);
        await dataService.updatePassword(password);
        toast("Tu contraseña se actualizó.");
        navigate("/");
      } else if (forgot) {
        await dataService.forgotPassword(email);
        toast(
          "Si el correo tiene una cuenta, recibirá un enlace de recuperación.",
        );
        setForgot(false);
      } else {
        await dataService.signIn(email, password);
        navigate("/");
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Brand />
      </header>
      <div className="auth-layout">
        <section className="auth-intro">
          <Dolphin />
          <h1>
            Tu campus.
            <br />
            Tu voz.
            <br />
            <span>Un cambio.</span>
          </h1>
          <p>
            ¿Algo falta o no funciona en la UNACAR? Repórtalo y ayúdanos a
            cuidarlo.
          </p>
          <div className="auth-note">
            <ShieldCheck size={20} />
            <span>
              Un espacio para estudiantes
              <br />y administradores de la universidad.
            </span>
          </div>
        </section>
        <section className="auth-card">
          <h2>
            {recovery
              ? "Cambia tu contraseña"
              : forgot
                ? "Recupera tu acceso"
                : "Bienvenido a CampusFix"}
          </h2>
          <p>
            {recovery
              ? "Usa al menos 12 caracteres."
              : forgot
                ? "Te enviaremos las instrucciones a tu correo."
                : "Entra con la cuenta que te dio tu administrador."}
          </p>
          <form onSubmit={submit}>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {!recovery && (
              <label>
                Correo electrónico
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu.correo@unacar.mx"
                />
              </label>
            )}
            {!forgot && (
              <label>
                Contraseña
                <span className="password-field">
                  <input
                    type={show ? "text" : "password"}
                    required
                    autoComplete={
                      recovery ? "new-password" : "current-password"
                    }
                    minLength={recovery ? 12 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Escribe tu contraseña"
                  />
                  <button
                    type="button"
                    aria-label={
                      show ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
            )}
            {!recovery && !forgot && (
              <button
                type="button"
                className="forgot-link"
                onClick={() => setForgot(true)}
              >
                Olvidé mi contraseña
              </button>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <ArrowRight size={18} />
              )}{" "}
              {busy
                ? "Un momento…"
                : recovery
                  ? "Guardar contraseña"
                  : forgot
                    ? "Enviar enlace"
                    : "Entrar"}
            </button>
            {forgot && (
              <button
                type="button"
                className="text-link centered"
                onClick={() => setForgot(false)}
              >
                <ArrowLeft size={15} />
                Volver
              </button>
            )}
          </form>
          {!recovery && !forgot && (
            <>
              <p className="auth-help">
                ¿Eres estudiante y aún no tienes cuenta?
                <br />
                <strong>Pídela a la administración de tu campus.</strong>
              </p>
              <button
                className="admin-enrollment"
                onClick={() => setEnroll(true)}
              >
                <KeyRound size={17} />
                Crear cuenta de administrador
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {!isSupabaseConfigured && !recovery && (
            <div className="demo-login">
              <span>Demostración con datos de este navegador</span>
              <div>
                <button
                  className="button secondary"
                  onClick={async () => {
                    await dataService.enterDemo("user");
                    localStorage.setItem("campusfix.simple.onboarded", "1");
                    navigate("/");
                  }}
                >
                  Ver como estudiante
                </button>
                <button
                  className="button secondary"
                  onClick={async () => {
                    await dataService.enterDemo("admin");
                    localStorage.setItem("campusfix.simple.onboarded", "1");
                    navigate("/");
                  }}
                >
                  Ver como administrador
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <footer>CampusFix · Proyecto académico para la comunidad UNACAR</footer>
      {enroll && <AdminEnrollment onClose={() => setEnroll(false)} />}
    </div>
  );
}
function AdminEnrollment({ onClose }: { onClose: () => void }) {
  const minimumPasswordLength = isSupabaseConfigured ? 6 : 5;
  const [pin, setPin] = useState(""),
    [verified, setVerified] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate(),
    toast = useToast();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!verified) {
        await dataService.verifyAdminPin(pin);
        setVerified(true);
      } else {
        await dataService.registerAdmin({
          pin,
          full_name: name,
          email,
          password,
        });
        await dataService.signIn(email, password);
        localStorage.setItem("campusfix.simple.onboarded", "1");
        toast("Tu cuenta de administrador está lista.");
        onClose();
        navigate("/");
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        verified
          ? "Crea tu cuenta de administrador"
          : "Acceso para administradores"
      }
      onClose={onClose}
    >
      <form className="modal-body" onSubmit={submit}>
        <span className="modal-symbol">
          <KeyRound size={25} />
        </span>
        <p>
          {verified
            ? "NIP validado. Completa tus datos para administrar los reportes del campus."
            : "Ingresa el NIP de administración para crear una cuenta."}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {!verified ? (
          <label>
            NIP de administración
            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              minLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              autoComplete="off"
              required
            />
          </label>
        ) : (
          <>
            <label>
              Nombre completo
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={3}
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>
            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={minimumPasswordLength}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <small>Al menos {minimumPasswordLength} caracteres.</small>
            </label>
          </>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {busy ? "Validando…" : verified ? "Crear mi cuenta" : "Continuar"}
        </button>
        <p className="pin-notice">
          {isSupabaseConfigured
            ? "El NIP se verifica en el servidor."
            : "Demostración local: el NIP se comprueba únicamente en este navegador."}
        </p>
      </form>
    </Modal>
  );
}
