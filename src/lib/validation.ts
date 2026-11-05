import { z } from "zod";
import { CATEGORIES, PRIORITIES, STATUSES } from "../types";

export const incidentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Escribe un título de al menos 5 caracteres.")
    .max(150, "El título admite hasta 150 caracteres."),
  description: z
    .string()
    .trim()
    .min(10, "Describe el problema con al menos 10 caracteres.")
    .max(5000),
  category: z.enum(CATEGORIES),
  building: z.string().trim().min(2, "Indica el edificio o área.").max(120),
  location: z
    .string()
    .trim()
    .min(2, "Indica la ubicación específica.")
    .max(180),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
  assignee_id: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  observations: z.string().max(5000).optional().default(""),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Escribe un correo electrónico válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

export const createUserSchema = z.object({
  full_name: z.string().trim().min(3, "Escribe el nombre completo.").max(100),
  email: z.string().trim().email("Escribe un correo electrónico válido."),
  password: z
    .string()
    .min(12, "Utiliza al menos 12 caracteres para la contraseña.")
    .max(128),
  role: z.enum(["admin", "user"]),
  department: z.string().max(120).optional().default(""),
  active: z.boolean().optional().default(true),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(3, "Escribe el nombre completo.").max(100),
  department: z.string().trim().max(120),
});

export const passwordSchema = z
  .string()
  .min(12, "Utiliza al menos 12 caracteres para la contraseña.")
  .max(128);

export const adminPasswordSchema = z
  .string()
  .min(5, "Utiliza al menos 5 caracteres para la contraseña de administrador.")
  .max(128);

export const registerAdminSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "Escribe el NIP de 4 dígitos."),
  full_name: profileSchema.shape.full_name,
  email: loginSchema.shape.email,
  password: adminPasswordSchema,
});

export function readableError(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message ?? "Revisa los campos del formulario.";
  if (error instanceof Error) {
    const message = error.message;
    if (/invalid login credentials/i.test(message))
      return "El correo o la contraseña son incorrectos.";
    if (/email not confirmed/i.test(message))
      return "Confirma tu correo antes de iniciar sesión.";
    if (/failed to fetch|network|fetch failed/i.test(message))
      return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo otra vez.";
    if (/row-level security|permission denied/i.test(message))
      return "Tu cuenta no tiene permiso para realizar esta acción.";
    if (/user already registered|already been registered/i.test(message))
      return "Este correo ya tiene una cuenta.";
    return message;
  }
  if (error && typeof error === "object" && "message" in error)
    return readableError(new Error(String(error.message)));
  return "Ocurrió un error. Inténtalo de nuevo.";
}
