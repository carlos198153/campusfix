import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildRecoveryRedirectUrl } from './navigation';
import {
  CATEGORIES,
  STATUSES,
  type AuthSession,
  type ClassificationSuggestion,
  type CreateUserInput,
  type DashboardStats,
  type Incident,
  type IncidentFilters,
  type IncidentHistory,
  type IncidentInput,
  type Profile,
  type Role,
  type RegisterAdminInput,
} from "../types";
import {
  createDemoData,
  DEMO_SESSION_KEY,
  DEMO_STORAGE_KEY,
  type DemoDatabase,
  migrateDemoData,
} from "./demo";
import {
  createUserSchema,
  incidentSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  registerAdminSchema,
} from "./validation";

const environment = import.meta.env as Record<string, string | undefined>;
const supabaseUrl = environment.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const demoMode = !isSupabaseConfigured;
export const dataMode = isSupabaseConfigured ? "supabase" : "demo";
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const listeners = new Set<(session: AuthSession | null) => void>();
let authRevision = 0;
let memoryDatabase: DemoDatabase | null = null;
let memorySession: AuthSession | null = null;

function uuid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
function storageRead(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function storageWrite(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    throw new Error(
      "No hay espacio para guardar la demostración. Elimina fotografías grandes o libera almacenamiento del navegador.",
    );
  }
}
function readDemo(): DemoDatabase {
  if (memoryDatabase) return memoryDatabase;
  const stored = storageRead(DEMO_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DemoDatabase;
      if (
        Array.isArray(parsed.profiles) &&
        Array.isArray(parsed.incidents) &&
        Array.isArray(parsed.history)
      )
        return (memoryDatabase = migrateDemoData(parsed));
    } catch {
      /* A damaged local demo can safely be replaced with the original seed. */
    }
  }
  return (memoryDatabase = createDemoData());
}
function saveDemo(database: DemoDatabase) {
  storageWrite(DEMO_STORAGE_KEY, JSON.stringify(database));
  memoryDatabase = database;
}
function notify(session: AuthSession | null) {
  authRevision++;
  for (const callback of listeners) callback(session);
}
function saveDemoSession(session: AuthSession | null) {
  memorySession = session;
  if (session) storageWrite(DEMO_SESSION_KEY, session.user.id);
  else {
    try {
      globalThis.localStorage?.removeItem(DEMO_SESSION_KEY);
    } catch {
      /* Memory session still clears. */
    }
  }
  notify(session);
}
function unwrap<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null)
    throw new Error("El servidor no devolvió la información solicitada.");
  return result.data;
}
async function cloudSession(): Promise<AuthSession | null> {
  if (!supabase) return null;
  const result = await supabase.auth.getSession();
  if (result.error) throw result.error;
  if (!result.data.session) return null;
  const profile = unwrap(
    await supabase
      .from("profiles")
      .select("*")
      .eq("id", result.data.session.user.id)
      .single(),
  ) as Profile;
  // A profile request may finish after a logout or a switch to a different account.
  const current = await supabase.auth.getSession();
  if (current.error) throw current.error;
  if (!current.data.session) return null;
  if (current.data.session.user.id !== profile.id) return cloudSession();
  if (!profile.active || profile.deleted_at)
    throw new Error(
      "Tu cuenta está pendiente de activación o fue desactivada. Contacta a la administración de CampusFix.",
    );
  return { user: profile, access_token: current.data.session.access_token };
}
async function getSession(): Promise<AuthSession | null> {
  if (supabase) return cloudSession();
  const id = memorySession?.user.id ?? storageRead(DEMO_SESSION_KEY);
  const profile = id
    ? readDemo().profiles.find(
        (item) => item.id === id && item.active && !item.deleted_at,
      )
    : null;
  memorySession = profile ? { user: { ...profile } } : null;
  return memorySession;
}
async function requireSession(admin = false): Promise<AuthSession> {
  const session = await getSession();
  if (!session) throw new Error("Inicia sesión para continuar.");
  if (admin && session.user.role !== "admin")
    throw new Error("Esta acción requiere una cuenta administradora.");
  return session;
}

async function credentialHash(password: string, salt: string): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "La autenticación de demostración requiere un navegador con conexión segura (HTTPS o localhost).",
    );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${password}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function storeDemoCredential(
  database: DemoDatabase,
  id: string,
  password: string,
) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  database.credentials[id] = {
    salt,
    hash: await credentialHash(password, salt),
  };
}
function equalHashes(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function edgeResponse(result: {
  data: any;
  error: unknown;
}): Promise<any> {
  if (result.error) {
    const error = result.error as {
      message?: string;
      context?: { clone?: () => { json: () => Promise<unknown> } };
    };
    let message =
      error.message || "No se pudo completar la solicitud al servidor.";
    if (error.context?.clone) {
      try {
        const body = (await error.context.clone().json()) as { error?: string };
        if (typeof body.error === "string") message = body.error;
      } catch {
        /* Preserve the original connection error. */
      }
    }
    throw new Error(message);
  }
  if (result.data?.error) throw new Error(String(result.data.error));
  return result.data;
}

export const STUDENT_INCIDENT_DEFAULTS = {
  category: "Otros",
  building: "Campus UNACAR",
  location: "Ver descripción",
  priority: "Media",
  status: "Pendiente",
} as const;

export function getWeekRange(weekStart: string): {
  dateFrom: string;
  dateTo: string;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart))
    throw new Error("Elige una fecha de inicio válida.");
  const start = new Date(`${weekStart}T12:00:00Z`);
  if (
    !Number.isFinite(start.getTime()) ||
    start.toISOString().slice(0, 10) !== weekStart
  )
    throw new Error("Elige una fecha de inicio válida.");
  if (start.getUTCDay() !== 1)
    throw new Error("La semana debe comenzar en lunes.");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { dateFrom: weekStart, dateTo: end.toISOString().slice(0, 10) };
}
function demoHistory(
  database: DemoDatabase,
  incident: Incident,
  session: AuthSession,
  action: string,
  changes: Record<string, unknown>,
) {
  database.history.push({
    id: uuid(),
    incident_id: incident.id,
    actor_id: session.user.id,
    actor_name: session.user.full_name,
    action,
    changes,
    created_at: new Date().toISOString(),
  });
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function campusDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function filterIncidents(
  incidents: Incident[],
  filters: IncidentFilters = {},
): Incident[] {
  const search = normalized(filters.search?.trim() ?? "");
  const result = incidents.filter((item) => {
    if (item.deleted_at) return false;
    if (
      search &&
      !normalized(
        `${item.folio} ${item.title} ${item.description} ${item.category} ${item.building} ${item.location}`,
      ).includes(search)
    )
      return false;
    if (
      filters.category &&
      filters.category !== "Todas" &&
      filters.category !== "Todas las categorías" &&
      item.category !== filters.category
    )
      return false;
    if (
      filters.status &&
      filters.status !== "Todos" &&
      filters.status !== "Todos los estados" &&
      item.status !== filters.status
    )
      return false;
    if (
      filters.priority &&
      filters.priority !== "Todas" &&
      filters.priority !== "Todas las prioridades" &&
      item.priority !== filters.priority
    )
      return false;
    if (filters.building && item.building !== filters.building) return false;
    const localDate = campusDate(item.created_at);
    if (filters.dateFrom && localDate < filters.dateFrom) return false;
    if (filters.dateTo && localDate > filters.dateTo) return false;
    return true;
  });
  const sortBy = filters.sortBy ?? "created_at";
  const direction = filters.sortDirection === "asc" ? 1 : -1;
  const priorityOrder = { Baja: 0, Media: 1, Alta: 2, Crítica: 3 };
  return [...result].sort((left, right) =>
    sortBy === "priority"
      ? (priorityOrder[left.priority] - priorityOrder[right.priority]) *
        direction
      : String(left[sortBy]).localeCompare(String(right[sortBy]), "es", {
          numeric: true,
        }) * direction,
  );
}

export function getDashboardStats(incidents: Incident[]): DashboardStats {
  const active = incidents.filter((item) => !item.deleted_at);
  const count = (status: Incident["status"]) =>
    active.filter((item) => item.status === status).length;
  const latest = active.reduce(
    (date, item) => Math.max(date, new Date(item.created_at).getTime()),
    Date.now(),
  );
  const base = new Date(`${campusDate(new Date(latest))}T12:00:00Z`);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 5 + index, 1, 12),
    );
    const monthKey = campusDate(month).slice(0, 7);
    const inMonth = active.filter(
      (item) => campusDate(item.created_at).slice(0, 7) === monthKey,
    );
    return {
      name: month
        .toLocaleDateString("es-MX", {
          month: "short",
          timeZone: "America/Mexico_City",
        })
        .replace(".", ""),
      total: inMonth.length,
      resolved: inMonth.filter((item) => item.status === "Solucionado").length,
    };
  });
  return {
    total: active.length,
    pending: count("Pendiente"),
    urgent: count("Urgente"),
    solved: count("Solucionado"),
    inProgress: count("Urgente"),
    resolved: count("Solucionado"),
    cancelled: 0,
    highPriority: active.filter(
      (item) =>
        ["Alta", "Crítica"].includes(item.priority) &&
        item.status !== "Solucionado",
    ).length,
    critical: active.filter(
      (item) => item.priority === "Crítica" && item.status !== "Solucionado",
    ).length,
    resolutionRate: active.length
      ? Math.round((count("Solucionado") / active.length) * 100)
      : 0,
    byStatus: STATUSES.map((name) => ({ name, value: count(name) })),
    byCategory: CATEGORIES.map((name) => ({
      name,
      value: active.filter((item) => item.category === name).length,
    })),
    monthly,
    recent: filterIncidents(active).slice(0, 8),
  };
}

export function classifyByRules(
  title: string,
  description: string,
): ClassificationSuggestion {
  const text = normalized(`${title} ${description}`);
  const rules: {
    category: ClassificationSuggestion["category"];
    words: RegExp;
    area: string;
    advice: string;
  }[] = [
    {
      category: "Climatización",
      words:
        /aire acondicionado|minisplit|climatiz|ventilador|calor|temperatura/,
      area: "Mantenimiento de climatización",
      advice:
        "Solicitar revisión de alimentación, filtros y diagnóstico del equipo por personal autorizado.",
    },
    {
      category: "Electricidad",
      words:
        /chispa|corto circuito|cortocircuito|electri|contacto|enchufe|luminaria|lampara|apagador|cable|luz/,
      area: "Mantenimiento eléctrico",
      advice:
        "Evitar manipular instalaciones y solicitar revisión de un técnico electricista. Aislar el área si existe riesgo.",
    },
    {
      category: "Plomería",
      words: /agua|fuga|lavabo|sanitario|drenaje|tuberia|llave|inodoro/,
      area: "Servicios Generales",
      advice:
        "Señalizar el área húmeda y solicitar revisión de válvulas, conexiones y drenajes.",
    },
    {
      category: "Internet y redes",
      words: /internet|red|wifi|wi-fi|conexion|router|switch/,
      area: "Tecnologías de la Información",
      advice:
        "Registrar el aula y equipos afectados para que el área de redes revise el punto de acceso y el enlace.",
    },
    {
      category: "Equipos de cómputo",
      words: /comput|proyector|teclado|monitor|impresora|pantalla|software/,
      area: "Soporte de Tecnologías",
      advice:
        "Registrar el identificador del equipo y solicitar diagnóstico de soporte técnico antes de intervenirlo.",
    },
    {
      category: "Mobiliario",
      words: /silla|mesa|escritorio|pupitre|mueble|banca/,
      area: "Servicios Generales",
      advice:
        "Retirar de servicio el mobiliario inestable y coordinar su reparación o sustitución.",
    },
    {
      category: "Limpieza",
      words: /limpieza|basura|residuo|sucio|higiene/,
      area: "Servicios Generales",
      advice:
        "Precisar el tipo de residuos y coordinar la limpieza con el personal del área.",
    },
    {
      category: "Infraestructura",
      words:
        /techo|pared|puerta|ventana|cristal|piso|grieta|filtracion|impermeabiliz/,
      area: "Mantenimiento de infraestructura",
      advice:
        "Señalizar la zona afectada y solicitar inspección de la infraestructura por personal especializado.",
    },
  ];
  const matched = rules.find((rule) => rule.words.test(text));
  const danger =
    /chispa|humo|incendio|fuego|electrocut|corto circuito|cortocircuito|derrumbe|fuga de gas|cable expuesto/.test(
      text,
    );
  const urgent =
    /sin funcionar|no enciende|inundacion|sin internet|fuga|filtracion|clases suspendidas/.test(
      text,
    );
  return {
    category: matched?.category ?? "Otros",
    priority: danger ? "Crítica" : urgent ? "Alta" : "Media",
    responsible_area: matched?.area ?? "Coordinación de Mantenimiento",
    recommendation: danger
      ? "Mantenerse fuera del área y avisar inmediatamente a Protección Civil y mantenimiento. No intervenir el equipo."
      : (matched?.advice ??
        "Solicitar una evaluación de mantenimiento y complementar la descripción con la ubicación exacta."),
    source: "rules",
    notice:
      "Clasificación básica por palabras clave; no utiliza IA. La prioridad es orientativa y requiere evaluación humana.",
  };
}

export const dataService = {
  getSession,
  async verifyAdminPin(pin: string): Promise<void> {
    const parsed = registerAdminSchema.shape.pin.parse(pin);
    if (supabase) {
      const data = await edgeResponse(
        await supabase.functions.invoke("register-admin", {
          body: { action: "verify", pin: parsed },
        }),
      );
      if (data?.valid !== true)
        throw new Error("No fue posible validar el NIP.");
      return;
    }
    if (parsed !== "1324") throw new Error("NIP incorrecto.");
  },
  async registerAdmin(input: RegisterAdminInput): Promise<Profile> {
    const parsed = registerAdminSchema.parse(input);
    if (supabase) {
      const data = await edgeResponse(
        await supabase.functions.invoke("register-admin", { body: parsed }),
      );
      return data.user as Profile;
    }
    await this.verifyAdminPin(parsed.pin);
    const database = structuredClone(readDemo());
    if (
      database.profiles.some(
        (item) => item.email.toLowerCase() === parsed.email.toLowerCase(),
      )
    )
      throw new Error("Este correo ya tiene una cuenta.");
    const profile: Profile = {
      id: uuid(),
      full_name: parsed.full_name,
      email: parsed.email.toLowerCase(),
      role: "admin",
      active: true,
      department: "Administración",
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    await storeDemoCredential(database, profile.id, parsed.password);
    database.profiles.push(profile);
    saveDemo(database);
    return { ...profile };
  },
  subscribeAuth(callback: (session: AuthSession | null) => void): () => void {
    listeners.add(callback);
    let subscribed = true;
    let sequence = 0;
    function refreshProfile() {
      const request = ++sequence;
      const revision = authRevision;
      cloudSession()
        .then((session) => {
          if (subscribed && sequence === request && revision === authRevision)
            callback(session);
        })
        .catch((error) => {
          // A temporary connection failure must not replace the current session with a false logout.
          if (
            subscribed &&
            sequence === request &&
            revision === authRevision &&
            /activación|desactivada/.test(String(error?.message))
          )
            callback(null);
        });
    }
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      // Supabase warns against calling auth methods synchronously inside this callback.
      const request = ++sequence;
      const revision = authRevision;
      setTimeout(() => {
        if (!subscribed || sequence !== request || revision !== authRevision)
          return;
        if (!session) callback(null);
        else refreshProfile();
      }, 0);
    });
    const focus = () => {
      if (supabase) refreshProfile();
      else {
        memoryDatabase = null;
        getSession().then((session) => {
          if (subscribed) callback(session);
        });
      }
    };
    if (typeof window !== "undefined") window.addEventListener("focus", focus);
    return () => {
      subscribed = false;
      sequence++;
      listeners.delete(callback);
      subscription?.data.subscription.unsubscribe();
      if (typeof window !== "undefined")
        window.removeEventListener("focus", focus);
    };
  },
  async enterDemo(role: Role = "admin"): Promise<AuthSession> {
    if (supabase)
      throw new Error(
        "La demostración local está deshabilitada cuando hay una conexión Supabase configurada.",
      );
    const profile = readDemo().profiles.find(
      (item) => item.id === (role === "admin" ? "demo-admin" : "demo-user"),
    )!;
    if (!profile?.active || profile.deleted_at)
      throw new Error(
        "Esta cuenta de demostración fue eliminada o desactivada. Accede con otra cuenta registrada.",
      );
    const session = { user: { ...profile } };
    saveDemoSession(session);
    return session;
  },
  async signIn(email: string, password: string): Promise<AuthSession> {
    const credentials = loginSchema.parse({ email, password });
    if (!supabase) {
      const database = readDemo();
      const profile = database.profiles.find(
        (item) =>
          item.email.toLowerCase() === credentials.email.toLowerCase() &&
          item.active &&
          !item.deleted_at,
      );
      const verifier = profile ? database.credentials[profile.id] : null;
      if (
        !profile ||
        !verifier ||
        !equalHashes(
          await credentialHash(credentials.password, verifier.salt),
          verifier.hash,
        )
      )
        throw new Error(
          "El correo o la contraseña son incorrectos. Las cuentas de ejemplo usan el acceso de demostración.",
        );
      const session = { user: { ...profile } };
      saveDemoSession(session);
      return session;
    }
    const result = await supabase.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    try {
      const session = await requireSession();
      notify(session);
      return session;
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    }
  },
  async signOut(): Promise<void> {
    if (supabase) {
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      notify(null);
    } else saveDemoSession(null);
  },
  async forgotPassword(email: string): Promise<void> {
    const parsed = loginSchema.shape.email.parse(email);
    if (!supabase)
      throw new Error(
        "La recuperación de contraseñas requiere conectar Supabase; la demostración no envía correos.",
      );
    const result = await supabase.auth.resetPasswordForEmail(parsed, {
      redirectTo: buildRecoveryRedirectUrl(),
    });
    if (result.error) throw result.error;
  },
  async updatePassword(password: string): Promise<void> {
    const parsed = passwordSchema.parse(password);
    const session = await requireSession();
    if (!supabase) {
      const database = structuredClone(readDemo());
      await storeDemoCredential(database, session.user.id, parsed);
      saveDemo(database);
      return;
    }
    const result = await supabase.auth.updateUser({ password: parsed });
    if (result.error) throw result.error;
  },
  async listIncidents(filters: IncidentFilters = {}): Promise<Incident[]> {
    const session = await requireSession();
    let incidents: Incident[];
    if (supabase) {
      incidents = [];
      // PostgREST returns at most 1,000 rows by default. Fetch every page for accurate totals and reports.
      for (let from = 0; ; from += 1000) {
        let query = supabase
          .from("incidents")
          .select("*")
          .is("deleted_at", null);
        if (session.user.role === "user")
          query = query.eq("reporter_id", session.user.id);
        const page = unwrap(
          await query
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, from + 999),
        ) as Incident[];
        incidents.push(...page);
        if (page.length < 1000) break;
      }
    } else incidents = readDemo().incidents;
    return filterIncidents(
      incidents.filter(
        (item) =>
          session.user.role === "admin" || item.reporter_id === session.user.id,
      ),
      filters,
    ).map((item) => ({ ...item }));
  },
  async getWeeklyIncidents(weekStart: string): Promise<Incident[]> {
    await requireSession(true);
    return this.listIncidents(getWeekRange(weekStart));
  },
  async getIncident(id: string): Promise<Incident> {
    const session = await requireSession();
    if (supabase) {
      let query = supabase
        .from("incidents")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null);
      if (session.user.role === "user")
        query = query.eq("reporter_id", session.user.id);
      const incident = unwrap(await query.single()) as Incident;
      if (
        session.user.role !== "admin" &&
        incident.reporter_id !== session.user.id
      )
        throw new Error("No puedes consultar reportes de otra persona.");
      return incident;
    }
    const incident = readDemo().incidents.find(
      (item) =>
        item.id === id &&
        !item.deleted_at &&
        (session.user.role === "admin" || item.reporter_id === session.user.id),
    );
    if (!incident)
      throw new Error("La incidencia no existe o fue dada de baja.");
    return { ...incident };
  },
  async createIncident(input: IncidentInput): Promise<Incident> {
    const session = await requireSession();
    const parsed = incidentSchema.parse(input);
    if (
      session.user.role === "user" &&
      (Object.entries(STUDENT_INCIDENT_DEFAULTS).some(
        ([field, value]) => parsed[field as keyof IncidentInput] !== value,
      ) ||
        parsed.assignee_id ||
        parsed.observations)
    )
      throw new Error(
        "Los estudiantes sólo pueden enviar fotografía, título y descripción. El estado inicial es Pendiente.",
      );
    const assignee = parsed.assignee_id || null;
    if (supabase)
      return unwrap(
        await supabase
          .from("incidents")
          .insert({
            ...parsed,
            assignee_id: assignee,
            reporter_id: session.user.id,
          })
          .select()
          .single(),
      ) as Incident;
    const database = structuredClone(readDemo());
    if (
      assignee &&
      !database.profiles.some(
        (item) => item.id === assignee && item.active && !item.deleted_at,
      )
    )
      throw new Error("Selecciona un responsable activo.");
    const sequence =
      Math.max(
        0,
        ...database.incidents.map(
          (item) => Number(item.folio.replace("INC-", "")) || 0,
        ),
      ) + 1;
    const now = new Date().toISOString();
    const incident: Incident = {
      ...parsed,
      id: uuid(),
      folio: `INC-${String(sequence).padStart(6, "0")}`,
      reporter_id: session.user.id,
      reporter_name: session.user.full_name,
      assignee_id: assignee,
      assignee_name: database.profiles.find((item) => item.id === assignee)
        ?.full_name,
      created_at: now,
      updated_at: now,
      resolved_at: parsed.status === "Solucionado" ? now : null,
      photo_url: parsed.photo_url ?? null,
      deleted_at: null,
    };
    database.incidents.unshift(incident);
    demoHistory(database, incident, session, "created", {
      status: { from: null, to: incident.status },
    });
    saveDemo(database);
    return { ...incident };
  },
  async updateIncident(
    id: string,
    patch: Partial<IncidentInput>,
  ): Promise<Incident> {
    const session = await requireSession(true);
    const previous = await this.getIncident(id);
    const parsed = incidentSchema.parse({ ...previous, ...patch });
    const values = { ...parsed, assignee_id: parsed.assignee_id || null };
    if (supabase)
      return unwrap(
        await supabase
          .from("incidents")
          .update(values)
          .eq("id", id)
          .is("deleted_at", null)
          .select()
          .single(),
      ) as Incident;
    const database = structuredClone(readDemo());
    if (
      values.assignee_id &&
      !database.profiles.some(
        (item) =>
          item.id === values.assignee_id && item.active && !item.deleted_at,
      )
    )
      throw new Error("Selecciona un responsable activo.");
    const incident = database.incidents.find((item) => item.id === id)!;
    const changes = Object.fromEntries(
      Object.entries(values)
        .filter(([key, value]) => previous[key as keyof Incident] !== value)
        .map(([key, value]) => [
          key,
          { from: previous[key as keyof Incident], to: value },
        ]),
    );
    if (!Object.keys(changes).length) return previous;
    const now = new Date().toISOString();
    Object.assign(incident, values, {
      assignee_name: database.profiles.find(
        (item) => item.id === values.assignee_id,
      )?.full_name,
      updated_at: now,
      resolved_at:
        values.status === "Solucionado" ? (previous.resolved_at ?? now) : null,
    });
    demoHistory(
      database,
      incident,
      session,
      previous.status === incident.status ? "updated" : "status_changed",
      changes,
    );
    saveDemo(database);
    return { ...incident };
  },
  async deleteIncident(id: string): Promise<void> {
    const session = await requireSession(true);
    if (supabase) {
      // The RPC confirms the deletion atomically without returning a row hidden by SELECT RLS.
      const result = await supabase.rpc("soft_delete_incident", {
        p_incident_id: id,
      });
      if (result.error) throw result.error;
      if (result.data !== true)
        throw new Error("La incidencia no existe o ya fue dada de baja.");
      return;
    }
    const database = structuredClone(readDemo());
    const incident = database.incidents.find(
      (item) => item.id === id && !item.deleted_at,
    );
    if (!incident)
      throw new Error("La incidencia no existe o ya fue dada de baja.");
    incident.deleted_at = incident.updated_at = new Date().toISOString();
    demoHistory(database, incident, session, "deleted", {
      deleted_at: { from: null, to: incident.deleted_at },
    });
    saveDemo(database);
  },
  async getHistory(id: string): Promise<IncidentHistory[]> {
    const session = await requireSession();
    if (session.user.role === "user") await this.getIncident(id);
    if (supabase)
      return unwrap(
        await supabase
          .from("incident_history")
          .select("*")
          .eq("incident_id", id)
          .order("created_at", { ascending: false }),
      ) as IncidentHistory[];
    return readDemo()
      .history.filter((item) => item.incident_id === id)
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map((item) => ({ ...item }));
  },
  async listProfiles(): Promise<Profile[]> {
    await requireSession(true);
    if (supabase) {
      const profiles: Profile[] = [];
      for (let from = 0; ; from += 1000) {
        const page = unwrap(
          await supabase
            .from("profiles")
            .select("*")
            .eq("role", "user")
            .is("deleted_at", null)
            .order("full_name")
            .order("id")
            .range(from, from + 999),
        ) as Profile[];
        profiles.push(...page);
        if (page.length < 1000) return profiles;
      }
    }
    return readDemo()
      .profiles.filter((item) => item.role === "user" && !item.deleted_at)
      .map((item) => ({ ...item }));
  },
  async createUser(input: CreateUserInput): Promise<Profile> {
    await requireSession(true);
    const parsed = createUserSchema.parse(input);
    if (parsed.role !== "user")
      throw new Error(
        "Los administradores se registran mediante el NIP. Aquí sólo puedes crear estudiantes.",
      );
    if (supabase) {
      const data = await edgeResponse(
        await supabase.functions.invoke("admin-users", {
          body: { action: "create", ...parsed },
        }),
      );
      return data.user as Profile;
    }
    const database = structuredClone(readDemo());
    if (
      database.profiles.some(
        (item) => item.email.toLowerCase() === parsed.email.toLowerCase(),
      )
    )
      throw new Error("Este correo ya tiene una cuenta en la demostración.");
    const profile: Profile = {
      id: uuid(),
      full_name: parsed.full_name,
      email: parsed.email.toLowerCase(),
      role: parsed.role,
      department: parsed.department,
      active: true,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    await storeDemoCredential(database, profile.id, parsed.password);
    database.profiles.push(profile);
    saveDemo(database);
    return profile;
  },
  async deleteStudent(id: string): Promise<void> {
    await requireSession(true);
    if (supabase) {
      await edgeResponse(
        await supabase.functions.invoke("admin-users", {
          body: { action: "delete", id },
        }),
      );
      return;
    }
    const database = structuredClone(readDemo());
    const student = database.profiles.find(
      (item) => item.id === id && item.role === "user" && !item.deleted_at,
    );
    if (!student)
      throw new Error("El estudiante no existe o ya fue eliminado.");
    student.active = false;
    student.deleted_at = new Date().toISOString();
    delete database.credentials[id];
    saveDemo(database);
    if (memorySession?.user.id === id) saveDemoSession(null);
  },
  async updateUser(id: string, patch: Partial<Profile>): Promise<Profile> {
    const session = await requireSession(true);
    if (
      id === session.user.id &&
      ((patch.role && patch.role !== session.user.role) ||
        patch.active === false)
    )
      throw new Error(
        "No puedes cambiar tu propio rol ni desactivar tu cuenta.",
      );
    const values: Partial<Profile> = {};
    if (
      patch.role !== undefined &&
      !(id === session.user.id && patch.role === session.user.role)
    )
      throw new Error(
        "El cambio de roles no está disponible. Los administradores se registran mediante el NIP.",
      );
    if (patch.full_name !== undefined)
      values.full_name = profileSchema.shape.full_name.parse(patch.full_name);
    if (patch.department !== undefined)
      values.department = profileSchema.shape.department.parse(
        patch.department,
      );
    if (patch.email !== undefined)
      values.email = loginSchema.shape.email.parse(patch.email).toLowerCase();
    if (patch.role !== undefined)
      values.role = createUserSchema.shape.role.parse(patch.role);
    if (patch.active !== undefined) values.active = Boolean(patch.active);
    if (supabase) {
      const data = await edgeResponse(
        await supabase.functions.invoke("admin-users", {
          body: { action: "update", id, ...values },
        }),
      );
      const profile = data.user as Profile;
      if (id === session.user.id) notify({ ...session, user: profile });
      return profile;
    }
    const database = structuredClone(readDemo());
    const profile = database.profiles.find(
      (item) => item.id === id && !item.deleted_at,
    );
    if (!profile) throw new Error("El usuario no existe.");
    if (
      values.email &&
      database.profiles.some(
        (item) => item.id !== id && item.email.toLowerCase() === values.email,
      )
    )
      throw new Error("Este correo ya tiene una cuenta.");
    Object.assign(profile, values);
    saveDemo(database);
    if (id === session.user.id) saveDemoSession({ user: { ...profile } });
    return { ...profile };
  },
  async updateProfile(
    patch: Partial<Pick<Profile, "full_name" | "department">>,
  ): Promise<Profile> {
    const session = await requireSession();
    const values = profileSchema.parse({ ...session.user, ...patch });
    let profile: Profile;
    if (supabase)
      profile = unwrap(
        await supabase
          .from("profiles")
          .update(values)
          .eq("id", session.user.id)
          .select()
          .single(),
      ) as Profile;
    else {
      const database = structuredClone(readDemo());
      profile = database.profiles.find((item) => item.id === session.user.id)!;
      Object.assign(profile, values);
      saveDemo(database);
      saveDemoSession({ user: { ...profile } });
    }
    notify({ ...session, user: profile });
    return { ...profile };
  },
  async uploadPhoto(file: File): Promise<string> {
    const session = await requireSession();
    const allowed = new Map([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
    ]);
    const extension = allowed.get(file.type);
    if (!extension) throw new Error("Utiliza una fotografía JPG, PNG o WebP.");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("La fotografía no puede superar 5 MB.");
    if (supabase) {
      const path = `${session.user.id}/${uuid()}.${extension}`;
      const result = await supabase.storage
        .from("incident-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw result.error;
      return path;
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("No se pudo leer la fotografía."));
      reader.readAsDataURL(file);
    });
  },
  async resolvePhotoUrl(path: string): Promise<string> {
    await requireSession();
    if (!supabase)
      return /^(data:image\/(jpeg|png|webp);base64,|https:\/\/)/i.test(path)
        ? path
        : "";
    const result = await supabase.storage
      .from("incident-photos")
      .createSignedUrl(path, 3600);
    if (result.error) throw result.error;
    return result.data.signedUrl;
  },
  async classifyIncident(
    title: string,
    description: string,
  ): Promise<ClassificationSuggestion> {
    await requireSession(true);
    if (supabase) {
      const result = await supabase.functions.invoke("classify-incident", {
        body: { title, description },
      });
      if (result.error)
        throw new Error(
          "No fue posible consultar el clasificador del servidor. Revisa el despliegue de classify-incident y tu conexión.",
        );
      if (result.data?.error) throw new Error(result.data.error);
      return result.data as ClassificationSuggestion;
    }
    return classifyByRules(title, description);
  },
  async resetDemo(): Promise<void> {
    if (supabase)
      throw new Error(
        "La función de reinicio sólo está disponible en la demostración local.",
      );
    await requireSession(true);
    saveDemo(createDemoData());
    const session = { user: { ...readDemo().profiles[0] } };
    saveDemoSession(session);
  },
};
