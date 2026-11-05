import {
  authorize,
  corsHeaders,
  handleError,
  HttpError,
  json,
  readBody,
  textField,
  uuidField,
} from "../_shared/http.ts";

function roleField(value: unknown): "admin" | "user" {
  if (value !== "admin" && value !== "user")
    throw new HttpError(400, "Rol inválido.");
  return value;
}
function emailField(value: unknown): string {
  const email = textField(value, "Correo", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "Correo electrónico inválido.");
  return email;
}
function passwordField(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    throw new HttpError(
      400,
      "La contraseña debe tener entre 12 y 128 caracteres.",
    );
  }
  return value;
}

Deno.serve(async (req: Request) => {
  let headers: Record<string, string> = {};
  try {
    headers = corsHeaders(req);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (!["GET", "POST"].includes(req.method))
      throw new HttpError(405, "Método no permitido.");
    const { user: actor, admin } = await authorize(req, true);
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      const page = Number(params.get("page") ?? 1);
      const perPage = Number(params.get("per_page") ?? 1000);
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > 100000 ||
        !Number.isInteger(perPage) ||
        perPage < 1 ||
        perPage > 1000
      ) {
        throw new HttpError(400, "Paginación inválida.");
      }
      const { data, error, count } = await admin
        .from("profiles")
        .select("*", { count: "exact" })
        .eq("role", "user")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range((page - 1) * perPage, page * perPage - 1);
      if (error)
        throw new HttpError(503, "No se pudo consultar el directorio.");
      return json(
        { users: data, total: count, page, per_page: perPage },
        200,
        headers,
      );
    }
    const body = await readBody(req);
    if (body.action === 'delete') {
      const id = uuidField(body.id);
      if (id === actor.id) throw new HttpError(403, 'No puedes eliminar tu propia cuenta.');
      const { data: removedData, error: removeError } = await admin.rpc('admin_remove_student', {
        p_actor_id: actor.id, p_user_id: id,
      });
      const removed = Array.isArray(removedData) ? removedData[0] : removedData;
      if (removeError || !removed) throw new HttpError(409, 'No se pudo eliminar la cuenta. Solo se pueden retirar estudiantes.');
      // Soft removal blocks every existing JWT immediately. Auth's ban also
      // prevents future sign-ins; no report, photograph or history is deleted.
      const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      if (banError) return json({
        error: 'El estudiante fue retirado y su acceso a los datos está bloqueado, pero no se pudo confirmar el bloqueo de Auth. Reintenta la eliminación o solicita revisión al responsable.',
        partial: true, user: removed,
      }, 503, headers);
      return json({ user: removed }, 200, headers);
    }
    if (body.action === "create") {
      const email = emailField(body.email);
      const password = passwordField(body.password);
      const fullName = textField(body.full_name, "Nombre", 2, 120);
      const role = roleField(body.role ?? "user");
      if (role !== 'user') throw new HttpError(403, 'Las cuentas administradoras se registran mediante el NIP.');
      const department = textField(body.department ?? "", "Área", 0, 120);
      if (body.active !== undefined && typeof body.active !== "boolean") {
        throw new HttpError(400, "Estado de cuenta inválido.");
      }
      const active = body.active ?? true;
      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
      if (createError || !created.user) {
        throw new HttpError(
          400,
          "No se pudo crear la cuenta. Revisa el correo y los requisitos de contraseña.",
        );
      }
      const { data: profileData, error: profileError } = await admin.rpc(
        "admin_update_profile",
        {
          p_actor_id: actor.id,
          p_user_id: created.user.id,
          p_full_name: fullName,
          p_role: role,
          p_active: active,
          p_department: department,
        },
      );
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      if (profileError || !profile) {
        // The auth trigger created an inactive account. Clean it up on setup failure.
        const { error: rollbackError } = await admin.auth.admin.deleteUser(
          created.user.id,
        );
        if (rollbackError) {
          // A lost response may conceal a committed profile update. Keep such
          // an account blocked even when Auth cannot complete the cleanup.
          const fallbackResults = await Promise.allSettled([
            admin.from('profiles').update({ active: false }).eq('id', created.user.id),
            admin.auth.admin.updateUserById(created.user.id, { ban_duration: '876000h' }),
          ]);
          console.error(
            "CampusFix: inactive account cleanup required",
            created.user.id,
            { failClosedConfirmed: fallbackResults.every(result => result.status === 'fulfilled' && !result.value.error) },
          );
        }
        throw new HttpError(
          409,
          "No se pudo activar la cuenta. Revisa el perfil desde Supabase antes de reintentar.",
        );
      }
      return json({ user: profile }, 201, headers);
    }
    if (body.action === "update") {
      const id = uuidField(body.id);
      if (body.active !== undefined && typeof body.active !== "boolean")
        throw new HttpError(400, "Estado de cuenta inválido.");
      const fullName =
        body.full_name === undefined
          ? null
          : textField(body.full_name, "Nombre", 2, 120);
      const department =
        body.department === undefined
          ? null
          : textField(body.department, "Área", 0, 120);
      const role = body.role === undefined ? null : roleField(body.role);
      if (role !== null && role !== 'user') throw new HttpError(403, 'Las cuentas administradoras se registran mediante el NIP.');
      const email =
        body.email === undefined ? undefined : emailField(body.email);
      const password =
        body.password === undefined ? undefined : passwordField(body.password);
      const { data: profileData, error: profileError } = await admin.rpc(
        "admin_update_profile",
        {
          p_actor_id: actor.id,
          p_user_id: id,
          p_full_name: fullName,
          p_role: role,
          p_active: body.active ?? null,
          p_department: department,
        },
      );
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      if (profileError || !profile) {
        throw new HttpError(
          409,
          "No se pudo actualizar el perfil. No puedes cambiar tu propio rol ni desactivar tu cuenta; debe permanecer un administrador activo.",
        );
      }
      if ((email && email !== profile.email) || password) {
        const { error: authError } = await admin.auth.admin.updateUserById(id, {
          ...(email ? { email, email_confirm: true } : {}),
          ...(password ? { password } : {}),
        });
        if (authError) {
          // Auth and PostgREST are separate transactions. Report partial success explicitly.
          return json(
            {
              error:
                "El perfil se guardó, pero no se pudo actualizar el correo o la contraseña. Revisa los datos de acceso y reintenta.",
              partial: true,
              user: profile,
            },
            409,
            headers,
          );
        }
      }
      const { data: finalProfile, error: finalError } = await admin
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (finalError)
        throw new HttpError(
          503,
          "Los cambios se guardaron. Recarga el directorio para consultarlos.",
        );
      return json({ user: finalProfile }, 200, headers);
    }
    throw new HttpError(400, "Acción inválida.");
  } catch (error) {
    return handleError(error, headers);
  }
});
