export const CATEGORIES = [
  "Electricidad",
  "Plomería",
  "Equipos de cómputo",
  "Internet y redes",
  "Mobiliario",
  "Limpieza",
  "Climatización",
  "Infraestructura",
  "Otros",
] as const;
export const PRIORITIES = ["Baja", "Media", "Alta", "Crítica"] as const;
export type Suggestion = {
  category: (typeof CATEGORIES)[number];
  priority: (typeof PRIORITIES)[number];
  responsible_area: string;
  recommendation: string;
  source: "openai" | "rules";
  notice: string;
};

export const ADVISORY =
  "La prioridad es orientativa. Confirma la evaluación con personal autorizado; ante peligro inmediato, aléjate del área y contacta a seguridad del campus.";
const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function classifyWithRules(description: string, title = ""): Suggestion {
  const text = normalized(`${title} ${description}`);
  const rules: Array<[RegExp, (typeof CATEGORIES)[number], string, string]> = [
    [
      /aire acondicionado|climatiza|minisplit|calor|ventilador/,
      "Climatización",
      "Mantenimiento",
      "Solicitar diagnóstico de climatización y revisar la alimentación eléctrica con personal técnico.",
    ],
    [
      /fuga|tuberia|inodoro|sanitario|lavabo|agua|drenaje/,
      "Plomería",
      "Mantenimiento",
      "Identificar el origen de la fuga o bloqueo y solicitar revisión de plomería.",
    ],
    [
      /internet|wifi|wi-fi|red de datos|conexion|router/,
      "Internet y redes",
      "Tecnologías de la información",
      "Comprobar el alcance de la falla y solicitar diagnóstico de la red.",
    ],
    [
      /computadora|computo|teclado|monitor|impresora|proyector|cpu/,
      "Equipos de cómputo",
      "Tecnologías de la información",
      "Registrar el equipo afectado y solicitar diagnóstico técnico.",
    ],
    [
      /electric|luz|lampara|foco|enchufe|contacto|cable|chispa|cortocircuito/,
      "Electricidad",
      "Mantenimiento",
      "Evitar manipular la instalación y solicitar revisión de personal electricista.",
    ],
    [
      /silla|mesa|escritorio|pupitre|mueble|estante/,
      "Mobiliario",
      "Servicios generales",
      "Señalizar el mobiliario dañado y evaluar su reparación o sustitución.",
    ],
    [
      /basura|limpieza|suciedad|sucio|derrame/,
      "Limpieza",
      "Servicios generales",
      "Señalizar el área y solicitar limpieza con los materiales adecuados.",
    ],
    [
      /grieta|techo|pared|ventana|puerta|piso|estructura|derrumbe/,
      "Infraestructura",
      "Mantenimiento",
      "Delimitar el área afectada y solicitar inspección de infraestructura.",
    ],
  ];
  const rule = rules.find(([pattern]) => pattern.test(text));
  const critical =
    /incendio|humo|explosion|electrocuc|cable expuesto|cables expuestos|fuga de gas|olor a gas|riesgo de derrumbe/.test(
      text,
    );
  const high =
    /inundacion|cortocircuito|chispa|riesgo|peligro|bloquea|sin agua|sin electricidad|sin luz/.test(
      text,
    );
  const low = /estetic|pintura|raspon|rayon/.test(text);
  return {
    category: rule?.[1] ?? "Otros",
    priority: critical ? "Crítica" : high ? "Alta" : low ? "Baja" : "Media",
    responsible_area: rule?.[2] ?? "Mantenimiento",
    recommendation: critical
      ? "Mantenerse fuera del área, avisar a seguridad y solicitar una evaluación inmediata por personal autorizado."
      : (rule?.[3] ??
        "Solicitar una evaluación de mantenimiento y documentar el problema con mayor detalle."),
    source: "rules",
    notice: `Clasificador básico basado en reglas; no utiliza inteligencia artificial. ${ADVISORY}`,
  };
}

export function validateAISuggestion(
  value: unknown,
): Omit<Suggestion, "source" | "notice"> | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    !CATEGORIES.includes(candidate.category as (typeof CATEGORIES)[number]) ||
    !PRIORITIES.includes(candidate.priority as (typeof PRIORITIES)[number])
  )
    return null;
  if (
    typeof candidate.responsible_area !== "string" ||
    candidate.responsible_area.length < 2 ||
    candidate.responsible_area.length > 160
  )
    return null;
  if (
    typeof candidate.recommendation !== "string" ||
    candidate.recommendation.length < 10 ||
    candidate.recommendation.length > 1200
  )
    return null;
  return {
    category: candidate.category as (typeof CATEGORIES)[number],
    priority: candidate.priority as (typeof PRIORITIES)[number],
    responsible_area: candidate.responsible_area,
    recommendation: candidate.recommendation,
  };
}
