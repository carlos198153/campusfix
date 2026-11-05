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
export const STATUSES = ["Pendiente", "Urgente", "Solucionado"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type IncidentStatus = (typeof STATUSES)[number];
export type Role = "admin" | "user";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  department: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface AuthSession {
  user: Profile;
  access_token?: string;
}

export interface Incident {
  id: string;
  folio: string;
  title: string;
  description: string;
  category: Category;
  building: string;
  location: string;
  priority: Priority;
  status: IncidentStatus;
  reporter_id: string;
  assignee_id: string | null;
  reporter_name?: string;
  assignee_name?: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  photo_url: string | null;
  observations: string;
  deleted_at: string | null;
}

export interface IncidentInput {
  title: string;
  description: string;
  category: Category;
  building: string;
  location: string;
  priority: Priority;
  status: IncidentStatus;
  assignee_id?: string | null;
  photo_url?: string | null;
  observations?: string;
}

export interface IncidentFilters {
  search?: string;
  category?: string;
  priority?: string;
  status?: string;
  building?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "created_at" | "updated_at" | "folio" | "priority" | "title";
  sortDirection?: "asc" | "desc";
}

export interface IncidentHistory {
  id: string;
  incident_id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface ClassificationSuggestion {
  category: Category;
  priority: Priority;
  responsible_area: string;
  recommendation: string;
  source: "openai" | "rules";
  notice: string;
}

export interface CreateUserInput {
  full_name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
  active?: boolean;
}

export interface RegisterAdminInput {
  pin: string;
  full_name: string;
  email: string;
  password: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  urgent: number;
  solved: number;
  inProgress: number;
  resolved: number;
  cancelled: number;
  highPriority: number;
  critical: number;
  resolutionRate: number;
  byStatus: { name: IncidentStatus; value: number }[];
  byCategory: { name: Category; value: number }[];
  monthly: { name: string; total: number; resolved: number }[];
  recent: Incident[];
}

export interface ReportOptions {
  title?: string;
  observations?: string;
  subtitle?: string;
  maxRecords?: number;
  generatedBy?: string;
}
