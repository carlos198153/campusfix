import { type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut, ArrowRightLeft } from "lucide-react";
import { Brand, initials, useSession, useToast } from "./ui";
import { dataService, isSupabaseConfigured } from "./lib/data";
export default function Shell({ children }: { children: ReactNode }) {
  const session = useSession(),
    navigate = useNavigate(),
    toast = useToast();
  const admin = session.user.role === "admin";
  async function logout() {
    try {
      await dataService.signOut();
      navigate("/login");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "No se pudo cerrar la sesión.",
        true,
      );
    }
  }
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Ir al contenido
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand-link" aria-label="CampusFix, inicio">
            <Brand />
          </Link>
          <nav className="main-nav" aria-label="Navegación principal">
            <NavLink to="/" end>
              {admin ? "Reportes del campus" : "Mis reportes"}
            </NavLink>
            <NavLink to="/arreglados">Arreglados</NavLink>
            {admin && (
              <>
                <NavLink to="/estudiantes">Estudiantes</NavLink>
                <NavLink to="/semanal">PDF semanal</NavLink>
              </>
            )}
          </nav>
          <div className="account-area">
            <span className="avatar">{initials(session.user.full_name)}</span>
            <span className="account-name">
              <strong>
                {session.user.full_name.split(" ").slice(0, 2).join(" ")}
              </strong>
              <small>{admin ? "Administrador" : "Estudiante"}</small>
            </span>
            <button
              className="icon-button"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              onClick={logout}
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>
      {!isSupabaseConfigured && (
        <div className="demo-strip">
          <div>
            <span>
              <i />
              Demostración local · {admin ? "Administrador" : "Estudiante"}
            </span>
            <button
              onClick={async () => {
                try {
                  await dataService.enterDemo(admin ? "user" : "admin");
                  navigate("/");
                } catch (e) {
                  toast(
                    e instanceof Error
                      ? e.message
                      : "No se pudo cambiar de perfil.",
                    true,
                  );
                }
              }}
            >
              <ArrowRightLeft size={13} />
              {admin ? "Probar como estudiante" : "Probar administración"}
            </button>
          </div>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <span>CampusFix · Comunidad UNACAR</span>
        <span>Un reporte puede hacer la diferencia.</span>
      </footer>
    </div>
  );
}
