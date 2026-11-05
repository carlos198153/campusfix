import { createClient } from "npm:@supabase/supabase-js@2.78.0";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (origin && allowed.length > 0 && !allowed.includes(origin)) {
    throw new HttpError(403, "Origen no autorizado.");
  }
  return {
    "Access-Control-Allow-Origin": allowed.length
      ? (origin ?? allowed[0])
      : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "Envía un cuerpo JSON.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > 16384)
    throw new HttpError(413, "Solicitud demasiado grande.");
  if (!req.body) throw new HttpError(400, "Objeto JSON requerido.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value: chunk, done } = await reader.read();
    if (done) break;
    length += chunk.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw new HttpError(413, "Solicitud demasiado grande.");
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Objeto JSON requerido.");
  return value as Record<string, unknown>;
}

export function textField(
  value: unknown,
  name: string,
  min: number,
  max: number,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw new HttpError(
      400,
      `${name}: utiliza entre ${min} y ${max} caracteres.`,
    );
  }
  return value.trim();
}

export function uuidField(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new HttpError(400, "Identificador de usuario inválido.");
  }
  return value;
}

export async function authorize(req: Request, requireAdmin = false) {
  const authorization = req.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Inicia sesión para continuar.");
  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publicKey || !serviceKey)
    throw new HttpError(503, "Backend sin configurar.");
  const authClient = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Always verify the token with Auth; decoding a JWT is not authentication.
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(match[1]);
  if (error || !user)
    throw new HttpError(401, "La sesión no es válida o ha expirado.");
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError) throw new HttpError(503, "No se pudo verificar el perfil.");
  if (!profile?.active || profile.deleted_at)
    throw new HttpError(
      403,
      "Tu cuenta está desactivada. Contacta a un administrador.",
    );
  if (requireAdmin && profile.role !== "admin")
    throw new HttpError(403, "Se requiere una cuenta administradora.");
  return { user, profile, admin };
}

export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new HttpError(503, 'Backend sin configurar.');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function handleError(
  error: unknown,
  headers: Record<string, string>,
): Response {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status, headers);
  // Avoid exposing upstream errors, database details or secrets in a response.
  console.error(
    "CampusFix function failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    { error: "No fue posible completar la solicitud. Intenta de nuevo." },
    500,
    headers,
  );
}
