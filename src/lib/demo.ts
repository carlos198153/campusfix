import type { Incident, IncidentHistory, Profile } from "../types";

export const DEMO_STORAGE_KEY = "campusfix.demo.v1";
export const DEMO_SESSION_KEY = "campusfix.demo.session.v1";

export interface DemoCredential {
  salt: string;
  hash: string;
}

export const demoProfiles: Profile[] = [
  {
    id: "demo-admin",
    full_name: "María Fernanda López",
    email: "mantenimiento@unacar.mx",
    role: "admin",
    active: true,
    department: "Coordinación de Mantenimiento",
    created_at: "2026-08-10T15:00:00Z",
  },
  {
    id: "demo-user",
    full_name: "Carlos Hernández",
    email: "carlos.hernandez@unacar.mx",
    role: "user",
    active: true,
    department: "Facultad de Ciencias de la Información",
    created_at: "2026-08-15T15:00:00Z",
  },
  {
    id: "demo-tech-1",
    full_name: "Roberto Méndez",
    email: "roberto.mendez@unacar.mx",
    role: "user",
    active: true,
    department: "Mantenimiento Eléctrico",
    created_at: "2026-08-12T15:00:00Z",
  },
  {
    id: "demo-tech-2",
    full_name: "Ana Sofía Castillo",
    email: "ana.castillo@unacar.mx",
    role: "user",
    active: true,
    department: "Soporte de Tecnologías",
    created_at: "2026-08-12T15:00:00Z",
  },
  {
    id: "demo-tech-3",
    full_name: "Luis Alberto García",
    email: "luis.garcia@unacar.mx",
    role: "user",
    active: true,
    department: "Servicios Generales",
    created_at: "2026-08-14T15:00:00Z",
  },
  {
    id: "demo-reporter-1",
    full_name: "Daniela Pérez",
    email: "daniela.perez@unacar.mx",
    role: "user",
    active: true,
    department: "Biblioteca Universitaria",
    created_at: "2026-08-19T15:00:00Z",
  },
  {
    id: "demo-reporter-2",
    full_name: "Miguel Ángel Torres",
    email: "miguel.torres@unacar.mx",
    role: "user",
    active: true,
    department: "Facultad de Ingeniería",
    created_at: "2026-08-22T15:00:00Z",
  },
  {
    id: "demo-inactive",
    full_name: "Valeria Romero",
    email: "valeria.romero@unacar.mx",
    role: "user",
    active: false,
    department: "Servicios Escolares",
    created_at: "2026-08-26T15:00:00Z",
  },
];

const detailed: Pick<
  Incident,
  | "title"
  | "description"
  | "category"
  | "building"
  | "location"
  | "priority"
  | "status"
  | "observations"
>[] = [
  {
    title: "Aire acondicionado sin funcionar",
    description:
      "El equipo de aire acondicionado del laboratorio 3 no enciende desde la primera clase. El salón tiene 28 equipos y la temperatura dificulta las actividades académicas. Se revisó el control remoto sin obtener respuesta.",
    category: "Climatización",
    building: "Facultad de Ciencias de la Información",
    location: "Edificio B · Laboratorio 3",
    priority: "Alta",
    status: "Pendiente",
    observations:
      "Laboratorio disponible para revisión de 13:00 a 15:00 h. Contactar en coordinación.",
  },
  {
    title: "Fuga de agua en sanitarios",
    description:
      "Se detectó una fuga continua en la alimentación del lavabo del sanitario de planta baja. El agua se extiende al pasillo de acceso; se colocó señalización preventiva.",
    category: "Plomería",
    building: "Edificio de Rectoría",
    location: "Planta baja · Sanitarios",
    priority: "Alta",
    status: "Urgente",
    observations:
      "Personal de Servicios Generales revisa la válvula y la conexión flexible.",
  },
  {
    title: "Luminarias del pasillo principal",
    description:
      "Tres luminarias LED parpadean en el pasillo que conecta la biblioteca con las aulas. Se requiere revisión del circuito y sustitución de los equipos que presenten falla.",
    category: "Electricidad",
    building: "Biblioteca Universitaria",
    location: "Pasillo de acceso · Planta alta",
    priority: "Media",
    status: "Pendiente",
    observations: "La falla es más evidente al inicio del turno vespertino.",
  },
  {
    title: "Sin conexión a internet en aula",
    description:
      "Los puntos de red y la conexión inalámbrica del aula 204 no proporcionan acceso a internet. La incidencia afecta a docentes y estudiantes durante las prácticas.",
    category: "Internet y redes",
    building: "Facultad de Ingeniería",
    location: "Edificio A · Aula 204",
    priority: "Alta",
    status: "Urgente",
    observations:
      "Se revisa el enlace del switch de distribución de la segunda planta.",
  },
  {
    title: "Proyector del auditorio reparado",
    description:
      "El proyector del auditorio mostraba una imagen amarillenta y se apagaba después de diez minutos. Se realizó limpieza preventiva y reemplazo del filtro.",
    category: "Equipos de cómputo",
    building: "Centro de Vinculación Universitaria",
    location: "Auditorio · Cabina de control",
    priority: "Media",
    status: "Solucionado",
    observations:
      "Prueba de proyección de 60 minutos completada. Equipo entregado al responsable del auditorio.",
  },
  {
    title: "Contacto eléctrico con chispas",
    description:
      "Un contacto cercano al escritorio del docente presenta chispas al conectar equipo. Se suspendió su uso y se notificó a la coordinación para aislar el área.",
    category: "Electricidad",
    building: "Facultad de Ciencias de la Salud",
    location: "Edificio C · Aula 102",
    priority: "Crítica",
    status: "Pendiente",
    observations:
      "No utilizar el contacto. Solicitar revisión de personal autorizado antes de habilitarlo.",
  },
  {
    title: "Mobiliario de sala de lectura",
    description:
      "Dos sillas de la sala de lectura tienen tornillos sueltos y una mesa presenta desnivel. Se retiraron las sillas de servicio hasta completar la reparación.",
    category: "Mobiliario",
    building: "Biblioteca Universitaria",
    location: "Sala de lectura · Área norte",
    priority: "Baja",
    status: "Solucionado",
    observations:
      "Se ajustaron anclajes y se reemplazó una niveladora. Mobiliario disponible.",
  },
  {
    title: "Filtración en techo de laboratorio",
    description:
      "Después de la lluvia se observó filtración en la unión del techo del laboratorio de química. Hay humedad sobre una mesa sin equipo eléctrico conectado.",
    category: "Infraestructura",
    building: "Facultad de Química",
    location: "Laboratorio 2 · Área de preparación",
    priority: "Alta",
    status: "Urgente",
    observations:
      "Se programó inspección de la impermeabilización y protección temporal de la mesa.",
  },
];

const older: [string, Incident["category"], string, string][] = [
  [
    "Mantenimiento de ventiladores",
    "Climatización",
    "Facultad de Ingeniería",
    "Aula 101",
  ],
  [
    "Revisión de computadoras del laboratorio",
    "Equipos de cómputo",
    "Facultad de Ciencias de la Información",
    "Laboratorio 1",
  ],
  [
    "Limpieza de áreas verdes",
    "Limpieza",
    "Campus Principal",
    "Jardín central",
  ],
  [
    "Cambio de lámparas LED",
    "Electricidad",
    "Edificio de Rectoría",
    "Pasillo 2",
  ],
  [
    "Reparación de llave de agua",
    "Plomería",
    "Facultad de Ciencias de la Salud",
    "Sanitarios planta alta",
  ],
  [
    "Ajuste de puerta de acceso",
    "Infraestructura",
    "Biblioteca Universitaria",
    "Entrada principal",
  ],
  [
    "Conexión de red intermitente",
    "Internet y redes",
    "Facultad de Química",
    "Sala de profesores",
  ],
  [
    "Reparación de escritorio",
    "Mobiliario",
    "Servicios Escolares",
    "Ventanilla 3",
  ],
  [
    "Recolección de residuos",
    "Limpieza",
    "Campus Principal",
    "Estacionamiento norte",
  ],
  [
    "Señalización de ruta accesible",
    "Otros",
    "Centro de Vinculación Universitaria",
    "Acceso lateral",
  ],
  [
    "Revisión de tablero eléctrico",
    "Electricidad",
    "Facultad de Ingeniería",
    "Cuarto de servicio",
  ],
  ["Desazolve de drenaje", "Plomería", "Campus Principal", "Patio central"],
  [
    "Limpieza de filtros de aire",
    "Climatización",
    "Biblioteca Universitaria",
    "Sala de consulta",
  ],
  [
    "Sustitución de teclado",
    "Equipos de cómputo",
    "Facultad de Ciencias de la Información",
    "Laboratorio 2",
  ],
  [
    "Revisión de punto inalámbrico",
    "Internet y redes",
    "Edificio de Rectoría",
    "Sala de juntas",
  ],
  [
    "Reposición de cristales",
    "Infraestructura",
    "Facultad de Química",
    "Aula 103",
  ],
  [
    "Bancas con pintura deteriorada",
    "Mobiliario",
    "Campus Principal",
    "Jardín de delfines",
  ],
  [
    "Limpieza de cisterna",
    "Limpieza",
    "Facultad de Ciencias de la Salud",
    "Área de servicios",
  ],
  [
    "Solicitud duplicada de señalética",
    "Otros",
    "Servicios Escolares",
    "Vestíbulo",
  ],
  [
    "Luminaria exterior averiada",
    "Electricidad",
    "Campus Principal",
    "Acceso sur",
  ],
  [
    "Dispensador de agua con fuga",
    "Plomería",
    "Biblioteca Universitaria",
    "Planta baja",
  ],
  [
    "Aire acondicionado con ruido",
    "Climatización",
    "Facultad de Ingeniería",
    "Aula 302",
  ],
  [
    "Actualización de equipo de aula",
    "Equipos de cómputo",
    "Centro de Vinculación Universitaria",
    "Aula multimedia",
  ],
  [
    "Canaleta de red desprendida",
    "Internet y redes",
    "Facultad de Ciencias de la Información",
    "Pasillo B",
  ],
  [
    "Cerradura de oficina atascada",
    "Infraestructura",
    "Edificio de Rectoría",
    "Oficina 12",
  ],
  ["Reposición de pupitres", "Mobiliario", "Facultad de Química", "Aula 201"],
  [
    "Limpieza de canaletas pluviales",
    "Limpieza",
    "Campus Principal",
    "Edificio de aulas",
  ],
  [
    "Mantenimiento de señalética",
    "Otros",
    "Campus Principal",
    "Acceso principal",
  ],
];

export function createDemoData() {
  const profiles = demoProfiles.map((profile) => ({ ...profile }));
  const incidents: Incident[] = [];
  for (let index = 0; index < 36; index++) {
    const number = 36 - index;
    const source =
      index < 8
        ? detailed[index]
        : {
            title: older[index - 8][0],
            category: older[index - 8][1],
            building: older[index - 8][2],
            location: older[index - 8][3],
            description: `Se solicita ${older[index - 8][0].toLowerCase()} en ${older[index - 8][3]}. La coordinación registró el caso para revisión del personal correspondiente y seguimiento de la atención.`,
            priority: (index % 5 === 0
              ? "Alta"
              : index % 3 === 0
                ? "Baja"
                : "Media") as Incident["priority"],
            status: (index < 18
              ? "Solucionado"
              : index < 22
                ? "Urgente"
                : index === 26
                  ? "Pendiente"
                  : "Pendiente") as Incident["status"],
            observations:
              index < 18
                ? "Trabajo concluido y validado con la coordinación del área."
                : "",
          };
    const reporter = profiles[index % 2 === 0 ? 1 : 5];
    const assigned =
      source.status === "Pendiente" ? null : profiles[2 + (index % 3)];
    const created = new Date(
      Date.UTC(2026, 10, 4 - Math.floor(index / 2), 18 - (index % 8), 25),
    ).toISOString();
    const updated = new Date(
      new Date(created).getTime() +
        (source.status === "Pendiente" ? 0 : 3 * 3600000),
    ).toISOString();
    incidents.push({
      id: `demo-incident-${number}`,
      folio: `INC-${String(number).padStart(6, "0")}`,
      ...source,
      reporter_id: reporter.id,
      reporter_name: reporter.full_name,
      assignee_id: assigned?.id ?? null,
      assignee_name: assigned?.full_name,
      created_at: created,
      updated_at: updated,
      resolved_at: source.status === "Solucionado" ? updated : null,
      photo_url: null,
      deleted_at: null,
    });
  }
  const history: IncidentHistory[] = incidents.flatMap((incident) => [
    {
      id: `${incident.id}-created`,
      incident_id: incident.id,
      actor_id: incident.reporter_id,
      actor_name: incident.reporter_name ?? "Comunidad UNACAR",
      action: "created",
      changes: { status: { from: null, to: "Pendiente" } },
      created_at: incident.created_at,
    },
    ...(incident.status === "Pendiente"
      ? []
      : [
          {
            id: `${incident.id}-updated`,
            incident_id: incident.id,
            actor_id: incident.assignee_id,
            actor_name: incident.assignee_name ?? profiles[0].full_name,
            action: "status_changed",
            changes: {
              status: { from: "Pendiente", to: incident.status },
              observations: { from: "", to: incident.observations },
            },
            created_at: incident.updated_at,
          },
        ]),
  ]);
  return {
    profiles,
    incidents,
    history,
    credentials: {} as Record<string, DemoCredential>,
  };
}

export type DemoDatabase = ReturnType<typeof createDemoData>;

export function migrateDemoData(database: DemoDatabase): DemoDatabase {
  const migrateStatus = (value: string) =>
    (({
      "En proceso": "Urgente",
      Resuelta: "Solucionado",
      Cancelada: "Pendiente",
    })[value] ?? value) as Incident["status"];
  return {
    ...database,
    credentials: database.credentials ?? {},
    profiles: database.profiles.map((profile) => ({
      ...profile,
      deleted_at: profile.deleted_at ?? null,
    })),
    incidents: database.incidents.map((incident) => ({
      ...incident,
      status: migrateStatus(incident.status),
      resolved_at:
        migrateStatus(incident.status) === "Solucionado"
          ? incident.resolved_at
          : null,
    })),
    history: database.history.map((event) => ({
      ...event,
      changes: Object.fromEntries(
        Object.entries(event.changes).map(([field, value]) => {
          if (field !== "status") return [field, value];
          if (typeof value === "string") return [field, migrateStatus(value)];
          if (value && typeof value === "object")
            return [
              field,
              Object.fromEntries(
                Object.entries(value).map(([key, status]) => [
                  key,
                  typeof status === "string" ? migrateStatus(status) : status,
                ]),
              ),
            ];
          return [field, value];
        }),
      ),
    })),
  };
}
