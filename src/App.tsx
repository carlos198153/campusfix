import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { dataService, isSupabaseConfigured } from "./lib/data";
import {
  isRecoveryRedirectRequested,
  clearRecoveryRedirectFlag,
} from "./lib/navigation";
import type { AuthSession } from "./types";
import { ToastProvider, SessionContext, Loading } from "./ui";
import Shell from "./Shell";
import Incidents from "./Incidents";
import IncidentEditor from "./IncidentEditor";
import IncidentDetail from "./IncidentDetail";
import Reports from "./Reports";
import Users from "./Users";
import Auth from "./Auth";
export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null),
    [ready, setReady] = useState(false),
    [initialError, setInitialError] = useState("");
  const location = useLocation(),
    navigate = useNavigate(),
    client = useQueryClient();
  useEffect(() => {
    let mounted = true;
    const unsubscribe = dataService.subscribeAuth((next) => {
      if (mounted) {
        setSession(next);
        setInitialError("");
        client.clear();
      }
    });
    async function init() {
      try {
        let current = await dataService.getSession();
        const preview =
          !isSupabaseConfigured &&
          !["/login", "/restablecer"].includes(location.pathname);
        if (
          preview &&
          (!current ||
            localStorage.getItem("campusfix.simple.onboarded") !== "1")
        ) {
          current = await dataService.enterDemo("user");
          localStorage.setItem("campusfix.simple.onboarded", "1");
        }
        if (mounted) {
          setSession(current);
          if (isRecoveryRedirectRequested()) {
            clearRecoveryRedirectFlag();
            navigate("/restablecer", { replace: true });
          }
        }
      } catch (e) {
        if (mounted)
          setInitialError(
            e instanceof Error
              ? e.message
              : "No pudimos conectar. Intenta iniciar sesión de nuevo.",
          );
      } finally {
        if (mounted) setReady(true);
      }
    }
    init();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  if (!ready) return <Loading />;
  return (
    <ToastProvider>
      <SessionContext.Provider value={session}>
        <Routes>
          <Route
            path="/login"
            element={
              session ? (
                <Navigate to="/" replace />
              ) : (
                <Auth initialError={initialError} />
              )
            }
          />
          <Route path="/restablecer" element={<Auth recovery />} />
          <Route
            path="/*"
            element={
              session ? (
                <Shell>
                  <Routes>
                    <Route path="/" element={<Incidents key="active" />} />
                    <Route
                      path="/arreglados"
                      element={<Incidents key="resolved" resolved />}
                    />
                    <Route path="/nuevo" element={<IncidentEditor />} />
                    <Route path="/reporte/:id" element={<IncidentDetail />} />
                    <Route
                      path="/estudiantes"
                      element={
                        session.user.role === "admin" ? (
                          <Users />
                        ) : (
                          <Navigate to="/" replace />
                        )
                      }
                    />
                    <Route
                      path="/semanal"
                      element={
                        session.user.role === "admin" ? (
                          <Reports />
                        ) : (
                          <Navigate to="/" replace />
                        )
                      }
                    />
                    <Route
                      path="/incidencias/nueva"
                      element={<Navigate to="/nuevo" replace />}
                    />
                    <Route
                      path="/usuarios"
                      element={<Navigate to="/estudiantes" replace />}
                    />
                    <Route
                      path="/reportes"
                      element={<Navigate to="/semanal" replace />}
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </SessionContext.Provider>
    </ToastProvider>
  );
}
