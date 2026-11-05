import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../src/types";

const sdk = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => sdk.client),
}));

const profile: Profile = {
  id: "authenticated-user",
  full_name: "Usuaria UNACAR",
  email: "usuario@unacar.mx",
  role: "user",
  active: true,
  department: "Ingeniería",
  created_at: "2026-10-01T12:00:00Z",
};

function query(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "is", "order", "insert", "update"])
    chain[method] = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.range = vi.fn(async () => result);
  chain.then = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
  );
  return chain;
}

function setupClient(
  overrides: {
    user?: Profile;
    profileError?: string;
    rows?: unknown[];
    queryError?: string;
  } = {},
) {
  const user = overrides.user ?? { ...profile };
  const profileQuery = query({
    data: user,
    error: overrides.profileError ? { message: overrides.profileError } : null,
  });
  const incidentQuery = query({
    data: overrides.rows ?? [],
    error: overrides.queryError ? { message: overrides.queryError } : null,
    count: 1,
  });
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            user: { id: user.id },
            access_token: "test-session-token",
          },
        },
        error: null,
      })),
      signInWithPassword: vi.fn(async () => ({
        data: {},
        error: null as { message: string } | null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async (_email: string, _options: { redirectTo: string }) => ({ data: {}, error: null as { message: string } | null })),
      onAuthStateChange: vi.fn(
        (_callback: (event: string, session: unknown) => void) => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      ),
    },
    from: vi.fn((table: string) =>
      table === "profiles" ? profileQuery : incidentQuery,
    ),
    rpc: vi.fn(async () => ({ data: true, error: null })),
    functions: {
      invoke: vi.fn(async () => ({
        data: {
          source: "rules",
          category: "Otros",
          priority: "Media",
          responsible_area: "Mantenimiento",
          recommendation: "Revisión técnica.",
          notice: "Sin IA configurada.",
        },
        error: null as { message: string } | null,
      })),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://storage.example.test/photo?token=test" },
          error: null,
        })),
      })),
    },
  };
  sdk.client = client;
  return { client, profileQuery, incidentQuery };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Contrato del adaptador Supabase (proveedor simulado, sin credenciales reales)", () => {
  it("recupera sesión activa con perfil y conserva los errores de acceso", async () => {
    const { client } = setupClient();
    const { dataService, isSupabaseConfigured } =
      await import("../src/lib/data");
    expect(isSupabaseConfigured).toBe(true);
    expect(
      (await dataService.signIn(profile.email, "password-during-test")).user,
    ).toEqual(profile);
    client.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: "Invalid login credentials" },
    });
    await expect(
      dataService.signIn(profile.email, "incorrect"),
    ).rejects.toMatchObject({ message: "Invalid login credentials" });
    await expect(dataService.enterDemo("admin")).rejects.toThrow(
      "deshabilitada",
    );
  });
  it("rechaza una cuenta desactivada aunque tenga un token de autenticación", async () => {
    setupClient({ user: { ...profile, active: false } });
    const { dataService } = await import("../src/lib/data");
    await expect(dataService.getSession()).rejects.toThrow("activación");
  });
  it("no sustituye una falla de conexión por registros de demostración", async () => {
    setupClient({ queryError: "Failed to fetch" });
    const { dataService } = await import("../src/lib/data");
    await expect(dataService.listIncidents()).rejects.toThrow(
      "Failed to fetch",
    );
  });
  it("consulta páginas adicionales para no truncar los totales en mil filas", async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      id: `${index}`,
      folio: `INC-${index}`,
      title: "Revisión de equipo",
      description: "Descripción",
      category: "Otros",
      building: "Campus",
      location: "Aula",
      priority: "Media",
      status: "Pendiente",
      created_at: "2026-10-01T12:00:00Z",
      deleted_at: null,
    }));
    const { incidentQuery } = setupClient({ user: { ...profile, role: 'admin' } });
    incidentQuery.range
      .mockResolvedValueOnce({ data: rows, error: null })
      .mockResolvedValueOnce({
        data: [{ ...rows[0], id: "1001" }],
        error: null,
      });
    const { dataService } = await import("../src/lib/data");
    expect(await dataService.listIncidents()).toHaveLength(1001);
    expect(incidentQuery.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(incidentQuery.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
  it("impide llamar a la función privilegiada cuando el perfil tiene rol común", async () => {
    const { client } = setupClient();
    const { dataService } = await import("../src/lib/data");
    await expect(
      dataService.createUser({
        full_name: "Otra Persona",
        email: "otra@unacar.mx",
        password: "contraseña-larga-2026",
        role: "admin",
      }),
    ).rejects.toThrow("administradora");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it("obtiene una URL firmada para fotografías privadas e invoca el clasificador seguro", async () => {
    const { client } = setupClient({ user: { ...profile, role: 'admin' } });
    const { dataService } = await import("../src/lib/data");
    expect(
      await dataService.resolvePhotoUrl("authenticated-user/photo.jpg"),
    ).toContain("?token=");
    expect(client.storage.from).toHaveBeenCalledWith("incident-photos");
    expect(
      (
        await dataService.classifyIncident(
          "Revisión del aula",
          "Se requiere una revisión general del aula.",
        )
      ).source,
    ).toBe("rules");
    expect(client.functions.invoke).toHaveBeenCalledWith("classify-incident", {
      body: {
        title: "Revisión del aula",
        description: "Se requiere una revisión general del aula.",
      },
    });
    client.functions.invoke.mockResolvedValueOnce({
      data: null as never,
      error: { message: "server unavailable" },
    });
    await expect(
      dataService.classifyIncident("Falla de equipo", "Descripción de falla"),
    ).rejects.toThrow("clasificador del servidor");
  });
  it("da de baja con confirmación atómica sin pedir la fila que RLS oculta", async () => {
    const { client, incidentQuery } = setupClient({ user: { ...profile, role: 'admin' } });
    const { dataService } = await import("../src/lib/data");
    await dataService.deleteIncident("incident-id");
    expect(client.rpc).toHaveBeenCalledWith("soft_delete_incident", {
      p_incident_id: "incident-id",
    });
    expect(incidentQuery.update).not.toHaveBeenCalled();
    expect(incidentQuery.select).not.toHaveBeenCalled();
    client.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(dataService.deleteIncident("incident-id")).rejects.toThrow(
      "dada de baja",
    );
  });
  it("no recupera una sesión antigua si el perfil termina de cargar después del cierre", async () => {
    const { client, profileQuery } = setupClient();
    let finishProfile!: (result: unknown) => void;
    profileQuery.single.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishProfile = resolve;
        }),
    );
    const { dataService } = await import("../src/lib/data");
    const pending = dataService.getSession();
    await vi.waitFor(() => expect(profileQuery.single).toHaveBeenCalled());
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);
    finishProfile({ data: profile, error: null });
    expect(await pending).toBeNull();
  });
  it("cancela callbacks pendientes al desmontarse y actualiza permisos al recuperar foco", async () => {
    const { client, profileQuery } = setupClient();
    const { dataService } = await import("../src/lib/data");
    const callback = vi.fn();
    const unsubscribe = dataService.subscribeAuth(callback);
    const authCallback = client.auth.onAuthStateChange.mock.calls[0][0];
    authCallback("SIGNED_IN", { user: { id: profile.id } });
    unsubscribe();
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(callback).not.toHaveBeenCalled();
    const stop = dataService.subscribeAuth(callback);
    profileQuery.single.mockResolvedValueOnce({
      data: { ...profile, role: "admin" },
      error: null,
    });
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() =>
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ role: "admin" }),
        }),
      ),
    );
    stop();
  });
  it("refleja en sesión los cambios que el administrador guarda en su propio usuario", async () => {
    const admin = { ...profile, role: "admin" as const };
    const { client } = setupClient({ user: admin });
    const updated = { ...admin, full_name: "Nombre actualizado" };
    client.functions.invoke.mockResolvedValueOnce({
      data: { user: updated },
      error: null,
    } as never);
    const { dataService } = await import("../src/lib/data");
    const callback = vi.fn();
    const unsubscribe = dataService.subscribeAuth(callback);
    await dataService.updateUser(admin.id, { full_name: updated.full_name });
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ user: updated }),
    );
    unsubscribe();
  });
  it('delega verificación y registro por NIP al servidor sin comprobar un NIP conocido en el navegador', async () => {
    const { client } = setupClient();
    const { dataService } = await import('../src/lib/data');
    client.functions.invoke.mockResolvedValueOnce({ data: { valid: true }, error: null } as never);
    await dataService.verifyAdminPin('9999');
    expect(client.functions.invoke).toHaveBeenLastCalledWith('register-admin', { body: { action: 'verify', pin: '9999' } });
    const input = { pin: '9999', full_name: 'Nueva Administradora', email: 'admin@unacar.mx', password: 'Clave-larga-servidor-2026' };
    client.functions.invoke.mockResolvedValueOnce({ data: { user: { ...profile, role: 'admin' } }, error: null } as never);
    expect((await dataService.registerAdmin(input)).role).toBe('admin');
    expect(client.functions.invoke).toHaveBeenLastCalledWith('register-admin', { body: input });
    expect(client.auth.getSession).not.toHaveBeenCalled();
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('muestra el rechazo del NIP enviado por el servidor y no crea una sesión', async () => {
    const { client } = setupClient();
    client.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { clone: () => ({ json: async () => ({ error: 'NIP incorrecto o expirado.' }) }) } } } as never);
    const { dataService } = await import('../src/lib/data');
    await expect(dataService.verifyAdminPin('1324')).rejects.toThrow('NIP incorrecto o expirado');
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('valida la frontera de cuatro y cinco caracteres antes de invocar el alta administrativa', async () => {
    const { client } = setupClient();
    const { dataService } = await import('../src/lib/data');
    const input = { pin: '1324', full_name: 'Nueva Administradora', email: 'admin.corta@unacar.mx', password: 'Ab1!' };
    await expect(dataService.registerAdmin(input)).rejects.toThrow('al menos 5 caracteres');
    expect(client.functions.invoke).not.toHaveBeenCalled();
    client.functions.invoke.mockResolvedValueOnce({ data: { user: { ...profile, role: 'admin' } }, error: null } as never);
    await dataService.registerAdmin({ ...input, password: 'Ab1!c' });
    expect(client.functions.invoke).toHaveBeenCalledWith('register-admin', { body: { ...input, password: 'Ab1!c' } });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('conserva el mínimo de doce para estudiantes en el adaptador conectado', async () => {
    const { client } = setupClient({ user: { ...profile, role: 'admin' } });
    const { dataService } = await import('../src/lib/data');
    const input = { full_name: 'Nuevo Estudiante', email: 'alumno@unacar.mx', password: '12345678901', role: 'user' as const };
    await expect(dataService.createUser(input)).rejects.toThrow('al menos 12 caracteres');
    expect(client.functions.invoke).not.toHaveBeenCalled();
    client.functions.invoke.mockResolvedValueOnce({ data: { user: profile }, error: null } as never);
    await dataService.createUser({ ...input, password: '123456789012' });
    expect(client.functions.invoke).toHaveBeenCalledWith('admin-users', { body: expect.objectContaining({ action: 'create', password: '123456789012' }) });
  });
  it('propaga el rechazo de política de Supabase recibido del servidor sin anunciar un alta exitosa', async () => {
    const { client } = setupClient();
    const policyMessage = 'La política de Supabase Auth exige una contraseña de al menos 6 caracteres. Actualiza la configuración antes de reintentar.';
    client.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { clone: () => ({ json: async () => ({ error: policyMessage }) }) } } } as never);
    const { dataService } = await import('../src/lib/data');
    await expect(dataService.registerAdmin({ pin: '1324', full_name: 'Nueva Administradora', email: 'admin@unacar.mx', password: 'Ab1!c' })).rejects.toThrow(policyMessage);
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(client.auth.getSession).not.toHaveBeenCalled();
  });
  it('filtra por el usuario autenticado incluso si el proveedor devuelve una fila ajena', async () => {
    const row = { id: 'own-report', folio: 'INC-000001', title: 'Falla del aula', description: 'Descripción de prueba', category: 'Otros', building: 'Campus UNACAR', location: 'Ver descripción', priority: 'Media', status: 'Pendiente', created_at: '2026-11-04T12:00:00Z', deleted_at: null, reporter_id: profile.id };
    const { incidentQuery } = setupClient({ rows: [row, { ...row, id: 'foreign-report', reporter_id: 'another-user' }] });
    const { dataService } = await import('../src/lib/data');
    expect((await dataService.listIncidents()).map(report => report.id)).toEqual(['own-report']);
    expect(incidentQuery.eq).toHaveBeenCalledWith('reporter_id', profile.id);
    await expect(dataService.updateIncident(row.id, { status: 'Urgente' })).rejects.toThrow('administradora');
    await expect(dataService.deleteIncident(row.id)).rejects.toThrow('administradora');
    expect(incidentQuery.update).not.toHaveBeenCalled();
  });
  it('deniega una cuenta eliminada aunque el token y active sigan presentes', async () => {
    setupClient({ user: { ...profile, active: true, deleted_at: '2026-11-04T12:00:00Z' } });
    const { dataService } = await import('../src/lib/data');
    await expect(dataService.getSession()).rejects.toThrow('desactivada');
  });
  it('elimina estudiantes mediante la función privilegiada con el contrato action delete', async () => {
    const { client } = setupClient({ user: { ...profile, role: 'admin' } });
    client.functions.invoke.mockResolvedValueOnce({ data: { user: { ...profile, active: false, deleted_at: '2026-11-04T12:00:00Z' } }, error: null } as never);
    const { dataService } = await import('../src/lib/data');
    await dataService.deleteStudent('student-id');
    expect(client.functions.invoke).toHaveBeenCalledWith('admin-users', { body: { action: 'delete', id: 'student-id' } });
  });
  it.each([
    { base: '/', hash: 'false', path: '/login', expected: '/?recovery=1' },
    { base: '/campusfix/', hash: 'true', path: '/campusfix/#/login', expected: '/campusfix/?recovery=1' },
    { base: '/campusfix/', hash: 'false', path: '/campusfix/login', expected: '/campusfix/?recovery=1' },
    { base: './', hash: 'true', path: '/campusfix/index.html#/login', expected: '/campusfix/?recovery=1' },
  ])('envía recuperación a la base $base sin fragmento con hash router $hash', async ({ base, hash, path, expected }) => {
    const originalUrl = location.href;
    const originalState = history.state;
    try {
      vi.stubEnv('BASE_URL', base);
      vi.stubEnv('VITE_USE_HASH_ROUTER', hash);
      history.replaceState(null, '', path);
      const { client } = setupClient();
      const { dataService } = await import('../src/lib/data');
      await dataService.forgotPassword(profile.email);
      expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(profile.email, { redirectTo: location.origin + expected });
      expect(new URL(client.auth.resetPasswordForEmail.mock.calls[0][1].redirectTo).hash).toBe('');
    } finally { history.replaceState(originalState, '', originalUrl); }
  });
  it('consume sólo el indicador externo de recuperación conservando query, hash de Auth y estado del router', async () => {
    const originalUrl = location.href;
    const originalState = history.state;
    try {
      const state = { idx: 2, usr: { previous: '/login' } };
      const authFragment = '#access_token=sample-access&refresh_token=sample-refresh&type=recovery';
      history.replaceState(state, '', '/campusfix/?language=es&recovery=1&source=email' + authFragment);
      const { isRecoveryRedirectRequested, clearRecoveryRedirectFlag } = await import('../src/lib/navigation');
      expect(isRecoveryRedirectRequested()).toBe(true);
      clearRecoveryRedirectFlag();
      expect(location.pathname).toBe('/campusfix/');
      expect(location.search).toBe('?language=es&source=email');
      expect(location.hash).toBe(authFragment);
      expect(history.state).toEqual(state);
      expect(isRecoveryRedirectRequested()).toBe(false);
      clearRecoveryRedirectFlag();
      expect(location.hash).toBe(authFragment);
      history.replaceState(state, '', '/campusfix/#/restablecer?recovery=1');
      expect(isRecoveryRedirectRequested()).toBe(false);
      clearRecoveryRedirectFlag();
      expect(location.hash).toBe('#/restablecer?recovery=1');
    } finally { history.replaceState(originalState, '', originalUrl); }
  });
});
