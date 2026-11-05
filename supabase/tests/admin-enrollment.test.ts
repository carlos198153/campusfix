import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { adminEnrollmentAuthFailure, constantTimePinMatches, enrollmentRequestKey, validateAdminEnrollment } from '../functions/_shared/admin-enrollment';

const nativeCrypto = webcrypto as unknown as Crypto;
describe('registro de administradores protegido por NIP', () => {
  it('verifica el NIP mediante WebCrypto y rechaza prefijos y otros valores', async () => {
    expect(await constantTimePinMatches('1324', '1324', nativeCrypto)).toBe(true);
    for (const candidate of ['', '132', '13240', '0000', '1324 ']) {
      expect(await constantTimePinMatches(candidate, '1324', nativeCrypto)).toBe(false);
    }
  });
  it('normaliza credenciales y sólo selecciona campos permitidos', () => {
    expect(validateAdminEnrollment({ full_name: '  Ana Pérez ', email: ' ANA@UNACAR.MX ', password: 'contraseña-larga-123', role: 'user', active: false }))
      .toEqual({ fullName: 'Ana Pérez', email: 'ana@unacar.mx', password: 'contraseña-larga-123' });
    for (const invalid of [
      { full_name: 'A', email: 'ana@unacar.mx', password: 'contraseña-larga-123' },
      { full_name: 'Ana', email: 'sin-correo', password: 'contraseña-larga-123' },
      { full_name: 'Ana', email: 'ana@unacar.mx', password: '1234' },
    ]) expect(() => validateAdminEnrollment(invalid)).toThrow();
  });
  it('rechaza cuatro caracteres y permite cinco sólo en la validación de alta de administradores', () => {
    const details = { full_name: 'Ana Pérez', email: 'ana@unacar.mx' };
    expect(() => validateAdminEnrollment({ ...details, password: 'Ab1!' })).toThrow('entre 5 y 128');
    expect(validateAdminEnrollment({ ...details, password: 'Ab1!x' }).password).toBe('Ab1!x');
    expect(validateAdminEnrollment({ ...details, password: 'a'.repeat(128) }).password).toHaveLength(128);
    expect(() => validateAdminEnrollment({ ...details, password: 'a'.repeat(129) })).toThrow('entre 5 y 128');
  });
  it('explica el mínimo real de Supabase sin confundir su política con un correo duplicado', () => {
    const six = adminEnrollmentAuthFailure({ code: 'weak_password', message: 'Password should be at least 6 characters.', reasons: ['length'] });
    expect(six).toMatchObject({ status: 422 });
    expect(six.message).toContain('al menos 6 caracteres');
    const configuredTwelve = adminEnrollmentAuthFailure({ code: 'weak_password', message: 'Password should be at least 12 characters.', reasons: ['length'] });
    expect(configuredTwelve.message).toContain('al menos 12 caracteres');
    expect(adminEnrollmentAuthFailure({ code: 'email_exists' })).toEqual({ status: 409, message: 'Ya existe una cuenta con este correo electrónico.' });
    expect(adminEnrollmentAuthFailure({ code: 'weak_password', message: 'SECRET_SERVICE_KEY', reasons: ['characters'] }).message).not.toContain('SECRET_SERVICE_KEY');
  });
  it('guarda claves opacas, ignora prefijos reenviados y conserva un grupo sin IP', async () => {
    const request = (ip?: string) => new Request('https://example.invalid', { headers: ip ? { 'x-forwarded-for': ip } : {} });
    const key = await enrollmentRequestKey(request('cliente, 203.0.113.12'), 'server-secret', nativeCrypto);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).toBe(await enrollmentRequestKey(request('falsificado, 203.0.113.12'), 'server-secret', nativeCrypto));
    expect(key).not.toBe(await enrollmentRequestKey(request('203.0.113.13'), 'server-secret', nativeCrypto));
    expect(await enrollmentRequestKey(request(), 'server-secret', nativeCrypto)).toBe(await enrollmentRequestKey(request(), 'server-secret', nativeCrypto));
  });
});
