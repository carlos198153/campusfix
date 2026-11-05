import { corsHeaders, createAdminClient, handleError, HttpError, json, readBody } from '../_shared/http.ts';
import { adminEnrollmentAuthFailure, constantTimePinMatches, enrollmentRequestKey, EnrollmentValidationError, validateAdminEnrollment } from '../_shared/admin-enrollment.ts';

Deno.serve(async (req: Request) => {
  let headers: Record<string, string> = {};
  try {
    headers = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
    const expectedPin = Deno.env.get('ADMIN_SETUP_PIN');
    if (!expectedPin) throw new HttpError(503, 'El registro de administradores no está habilitado. Contacta al responsable de la plataforma.');
    const admin = createAdminClient();
    const requestKey = await enrollmentRequestKey(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Invalid JSON, wrong NIPs and successful verify/create steps all consume quota.
    // Do not move this check after body parsing or credential validation.
    const { data: allowed, error: quotaError } = await admin.rpc('consume_admin_enrollment_quota', { p_request_key: requestKey });
    if (quotaError) throw new HttpError(503, 'No se pudo verificar el límite de intentos.');
    if (allowed !== true) throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.');
    const body = await readBody(req);
    const candidate = typeof body.pin === 'string' && body.pin.length <= 128 ? body.pin : '';
    if (!(await constantTimePinMatches(candidate, expectedPin))) throw new HttpError(403, 'NIP incorrecto.');
    if (body.action === 'verify') return json({ valid: true }, 200, headers);
    if (body.action !== undefined && body.action !== 'create') throw new HttpError(400, 'Acción inválida.');
    const { fullName, email, password } = validateAdminEnrollment(body);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (createError) {
      const failure = adminEnrollmentAuthFailure(createError);
      throw new HttpError(failure.status, failure.message);
    }
    if (!created.user) throw new HttpError(503, 'El servicio de autenticación no confirmó la creación de la cuenta.');
    const id = created.user.id;
    let profileData: unknown;
    let setupFailed = false;
    try {
      const result = await admin.rpc('complete_admin_enrollment', { p_user_id: id, p_full_name: fullName });
      const profile = Array.isArray(result.data) ? result.data[0] : result.data;
      profileData = profile;
      setupFailed = !!result.error || !profile || profile.id !== id || profile.role !== 'admin'
        || profile.active !== true || profile.deleted_at != null;
    } catch { setupFailed = true; }
    if (setupFailed) {
      // Auth and PostgreSQL are separate services. Remove the newly minted Auth
      // account on failure; never return success for an inactive partial account.
      let cleaned = false;
      try { const result = await admin.auth.admin.deleteUser(id); cleaned = !result.error; } catch { /* fail closed below */ }
      if (!cleaned) {
        const fallbackResults = await Promise.allSettled([
          admin.from('profiles').update({ active: false }).eq('id', id),
          admin.auth.admin.updateUserById(id, { ban_duration: '876000h' }),
        ]);
        const failClosedConfirmed = fallbackResults.every(result => result.status === 'fulfilled' && !result.value.error);
        console.error('CampusFix enrollment cleanup needs operator review', id, { failClosedConfirmed });
      }
      throw new HttpError(503, cleaned
        ? 'No se pudo completar el registro. La cuenta pendiente fue retirada; puedes reintentar.'
        : 'No se pudo completar el registro. Contacta al responsable antes de reintentar con este correo.');
    }
    return json({ user: profileData }, 201, headers);
  } catch (error) {
    return handleError(error instanceof EnrollmentValidationError ? new HttpError(400, error.message) : error, headers);
  }
});
