import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Trash2,
  UsersRound,
  LoaderCircle,
} from "lucide-react";
import { dataService } from "./lib/data";
import { readableError } from "./lib/validation";
import { useRefresh } from "./hooks";
import { Modal, initials, useToast, Loading, ErrorState } from "./ui";
import type { Profile } from "./types";
export default function Users() {
  const {
    data: profiles = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => dataService.listProfiles(),
  });
  const [search, setSearch] = useState(""),
    [creating, setCreating] = useState(false),
    [removing, setRemoving] = useState<Profile | null>(null),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const toast = useToast(),
    refresh = useRefresh();
  const students = profiles.filter((p) => p.role === "user" && !p.deleted_at),
    filtered = students.filter((p) =>
      (p.full_name + " " + p.email)
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setFailure("");
    try {
      await dataService.deleteStudent(removing.id);
      refresh();
      setRemoving(null);
      toast("El estudiante ya no tiene acceso a CampusFix.");
    } catch (err) {
      setFailure(readableError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="admin-heading">
        <div>
          <h1>Estudiantes</h1>
          <p>Crea sus cuentas o retira el acceso cuando sea necesario.</p>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          <UserPlus size={19} />
          Crear estudiante
        </button>
      </section>
      <section className="students-panel">
        <div className="students-toolbar">
          <h2>{students.length} estudiantes</h2>
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar estudiantes"
              placeholder="Buscar por nombre o correo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {isPending ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} retry={() => refetch()} />
        ) : filtered.length ? (
          <ul className="student-list">
            {filtered.map((student) => (
              <li key={student.id}>
                <span className="avatar">{initials(student.full_name)}</span>
                <span className="student-info">
                  <strong>{student.full_name}</strong>
                  <small>{student.email}</small>
                </span>
                <span
                  className={
                    "student-active " + (!student.active ? "inactive" : "")
                  }
                >
                  <i />
                  {student.active ? "Con acceso" : "Sin acceso"}
                </span>
                <button
                  className="button danger-quiet"
                  onClick={() => {
                    setFailure("");
                    setRemoving(student);
                  }}
                  aria-label={"Eliminar a " + student.full_name}
                >
                  <Trash2 size={17} />
                  <span>Eliminar</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <UsersRound size={34} />
            <h3>
              {search
                ? "No encontramos a ese estudiante"
                : "Crea la primera cuenta"}
            </h3>
            <p>
              {search
                ? "Prueba con otro nombre o correo."
                : "Los estudiantes podrán entrar y enviar sus reportes con la cuenta que les entregues."}
            </p>
            {!search && (
              <button
                className="button primary"
                onClick={() => setCreating(true)}
              >
                Crear estudiante
              </button>
            )}
          </div>
        )}
      </section>
      {creating && <CreateStudent onClose={() => setCreating(false)} />}{" "}
      {removing && (
        <Modal
          title="Eliminar estudiante"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <div className="modal-body">
            <span className="modal-symbol danger">
              <Trash2 size={25} />
            </span>
            <p>
              <strong>{removing.full_name}</strong> perderá el acceso y se
              eliminará de esta lista. Sus reportes se conservarán para
              seguimiento.
            </p>
            {failure && (
              <div className="form-error" role="alert">
                {failure}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setRemoving(null)}
              >
                Cancelar
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={remove}
              >
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Trash2 size={17} />
                )}{" "}
                {busy ? "Eliminando…" : "Eliminar acceso"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function CreateStudent({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toast = useToast(),
    refresh = useRefresh();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await dataService.createUser({
        full_name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
        role: "user",
        department: "Estudiante",
        active: true,
      });
      refresh();
      toast(
        "Cuenta creada. Comparte el correo y la contraseña con el estudiante.",
      );
      onClose();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Crear estudiante"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="modal-body" onSubmit={submit}>
        <p>El estudiante usará estos datos para entrar y hacer sus reportes.</p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <label>
          Nombre completo
          <input
            name="name"
            autoComplete="name"
            minLength={3}
            maxLength={100}
            required
          />
        </label>
        <label>
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña inicial
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
          <small>
            Al menos 12 caracteres. Compártela directamente con el estudiante.
          </small>
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <UserPlus size={17} />
            )}{" "}
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
