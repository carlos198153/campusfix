export class EnrollmentValidationError extends Error {}

/** HMAC verification delegates the fixed-length tag comparison to WebCrypto. */
export async function constantTimePinMatches(candidate: string, expected: string, cryptoApi: Crypto = crypto): Promise<boolean> {
  const bytes = new TextEncoder();
  const key = await cryptoApi.subtle.importKey('raw', cryptoApi.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const signature = await cryptoApi.subtle.sign('HMAC', key, bytes.encode(expected));
  return cryptoApi.subtle.verify('HMAC', key, signature, bytes.encode(candidate));
}

export async function enrollmentRequestKey(req: Request, pepper: string, cryptoApi: Crypto = crypto): Promise<string> {
  // Only the last forwarded hop is considered. The global database limit still
  // applies when ingress headers are absent, shared or forged by a caller.
  const forwarded = req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const address = (forwarded || req.headers.get('x-real-ip') || 'unknown').slice(0, 512);
  const encoder = new TextEncoder();
  const key = await cryptoApi.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await cryptoApi.subtle.sign('HMAC', key, encoder.encode(address)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateAdminEnrollment(body: Record<string, unknown>) {
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (fullName.length < 2 || fullName.length > 120) throw new EnrollmentValidationError('Nombre: utiliza entre 2 y 120 caracteres.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new EnrollmentValidationError('Correo electrónico inválido.');
  if (typeof body.password !== 'string' || body.password.length < 5 || body.password.length > 128) {
    throw new EnrollmentValidationError('La contraseña debe tener entre 5 y 128 caracteres.');
  }
  return { fullName, email, password: body.password };
}

/** Translate supported Auth failures without forwarding raw provider messages. */
export function adminEnrollmentAuthFailure(error: unknown): { status: number; message: string } {
  const candidate = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const providerMessage = typeof candidate.message === 'string' ? candidate.message : '';
  const reasons = Array.isArray(candidate.reasons) ? candidate.reasons.filter(value => typeof value === 'string') : [];
  const passwordPolicyError = code === 'weak_password' || candidate.name === 'AuthWeakPasswordError'
    || (/password/i.test(providerMessage) && /at least|too short|length is less|longer than|minimum/i.test(providerMessage));
  if (passwordPolicyError) {
    const minimumMatch = providerMessage.match(/at least\s+(\d+)\s+characters|length is less than\s+(\d+)/i);
    const maximumMatch = providerMessage.match(/longer than\s+(\d+)\s+characters/i);
    const minimum = minimumMatch ? Number(minimumMatch[1] ?? minimumMatch[2]) : null;
    const maximum = maximumMatch ? Number(maximumMatch[1]) : null;
    let message = 'Supabase Auth rechazó la contraseña por la política del proyecto.';
    if (minimum !== null && minimum >= 6 && minimum <= 1024) {
      message = `Supabase Auth requiere al menos ${minimum} caracteres. CampusFix admite administradores desde 5, pero el proveedor exige cumplir su propia política.`;
    } else if (maximum !== null && maximum >= 1 && maximum <= 1024) {
      message = `Supabase Auth permite como máximo ${maximum} caracteres para esta contraseña.`;
    } else if (reasons.includes('length')) {
      message = 'Supabase Auth exige al menos 6 caracteres y puede exigir más según la configuración del proyecto. Revisa su política de contraseñas.';
    }
    if (reasons.includes('characters')) message += ' Incluye los tipos de caracteres requeridos por el proyecto.';
    if (reasons.includes('pwned')) message += ' Elige una contraseña que no aparezca en filtraciones conocidas.';
    return { status: 422, message };
  }
  if (code === 'email_exists' || code === 'user_already_exists') return { status: 409, message: 'Ya existe una cuenta con este correo electrónico.' };
  if (candidate.status === 429) return { status: 429, message: 'El servicio de autenticación recibió demasiadas solicitudes. Espera un momento antes de reintentar.' };
  if (typeof candidate.status === 'number' && candidate.status >= 500) return { status: 503, message: 'El servicio de autenticación no está disponible. Intenta de nuevo más tarde.' };
  return { status: 400, message: 'No se pudo crear la cuenta con los datos proporcionados. Revisa el correo y los requisitos de contraseña del proyecto.' };
}
