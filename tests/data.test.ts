import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dataService, filterIncidents, getDashboardStats, getWeekRange, STUDENT_INCIDENT_DEFAULTS } from '../src/lib/data'
import { createDemoData, migrateDemoData, DEMO_STORAGE_KEY } from '../src/lib/demo'
import { incidentSchema, createUserSchema, readableError } from '../src/lib/validation'
import { STATUSES, type Incident, type IncidentInput } from '../src/types'

const password = 'Clave-de-prueba-segura-2026'
const studentInput: IncidentInput = { ...STUDENT_INCIDENT_DEFAULTS, title: 'Fuga en sanitario del campus', description: 'Se observa una fuga continua en la conexión del lavabo de planta baja.' }
beforeEach(async () => { vi.stubGlobal('crypto', webcrypto); await dataService.enterDemo('admin'); await dataService.resetDemo() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Acceso y cuentas de demostración', () => {
  it('exige sesión para consultar y registrar reportes', async () => {
    await dataService.signOut()
    await expect(dataService.listIncidents()).rejects.toThrow('Inicia sesión')
    await expect(dataService.createIncident(studentInput)).rejects.toThrow('Inicia sesión')
    expect(await dataService.getSession()).toBeNull()
  })
  it('rechaza contraseñas inventadas y mantiene el acceso explícito a ejemplos', async () => {
    await expect(dataService.signIn('carlos@unacar.mx', 'incorrecta')).rejects.toThrow('incorrectos')
    expect((await dataService.enterDemo('user')).user.role).toBe('user')
  })
  it('verifica NIP y registra administradores sin iniciar sesión automáticamente', async () => {
    await dataService.signOut()
    await expect(dataService.verifyAdminPin('0000')).rejects.toThrow('NIP incorrecto')
    await dataService.verifyAdminPin('1324')
    await expect(dataService.registerAdmin({ pin: '0000', full_name: 'Nueva Administradora', email: 'administradora@unacar.mx', password })).rejects.toThrow('NIP incorrecto')
    const admin = await dataService.registerAdmin({ pin: '1324', full_name: 'Nueva Administradora', email: 'administradora@unacar.mx', password })
    expect(admin.role).toBe('admin')
    expect(await dataService.getSession()).toBeNull()
    expect((await dataService.signIn(admin.email, password)).user.id).toBe(admin.id)
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).not.toContain(password)
    await expect(dataService.signIn(admin.email, 'incorrecta')).rejects.toThrow('incorrectos')
  })
  it('rechaza cuatro caracteres y permite cinco sólo en altas de administrador', async () => {
    const input = { pin: '1324', full_name: 'Administradora con Clave Corta', email: 'admin.corta@unacar.mx', password: 'Ab1!' }
    await expect(dataService.registerAdmin(input)).rejects.toThrow('al menos 5 caracteres')
    const admin = await dataService.registerAdmin({ ...input, password: 'Ab1!c' })
    expect((await dataService.signIn(admin.email, 'Ab1!c')).user.role).toBe('admin')
    await expect(dataService.createUser({ full_name: 'Alumno con Clave Corta', email: 'alumno.corta@unacar.mx', password: '12345678901', role: 'user' })).rejects.toThrow('al menos 12 caracteres')
    const student = await dataService.createUser({ full_name: 'Alumno con Clave Válida', email: 'alumno.valida@unacar.mx', password: '123456789012', role: 'user' })
    expect((await dataService.signIn(student.email, '123456789012')).user.role).toBe('user')
  })
  it('crea alumnos con verificadores salados y permite iniciar sesión con ellos', async () => {
    const first = await dataService.createUser({ full_name: 'Lucía Márquez', email: 'lucia@unacar.mx', password, role: 'user' })
    const second = await dataService.createUser({ full_name: 'Pedro García', email: 'pedro@unacar.mx', password, role: 'user' })
    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!)
    expect(stored.credentials[first.id].salt).toMatch(/^[0-9a-f]{32}$/)
    expect(stored.credentials[first.id].hash).toMatch(/^[0-9a-f]{64}$/)
    expect(stored.credentials[first.id].hash).not.toBe(stored.credentials[second.id].hash)
    expect(JSON.stringify(stored)).not.toContain(password)
    await dataService.signOut()
    expect((await dataService.signIn('LUCIA@unacar.mx', password)).user.id).toBe(first.id)
    expect(await dataService.listIncidents()).toHaveLength(0)
  })
  it('recupera credenciales tras recargar y revoca una sesión abierta al eliminar al alumno', async () => {
    const student = await dataService.createUser({ full_name: 'Alumno con Sesión', email: 'sesion@unacar.mx', password, role: 'user' })
    vi.resetModules()
    const fresh = (await import('../src/lib/data')).dataService
    expect((await fresh.signIn(student.email, password)).user.id).toBe(student.id)
    const callback = vi.fn()
    const unsubscribe = fresh.subscribeAuth(callback)
    try {
      await dataService.deleteStudent(student.id)
      window.dispatchEvent(new Event('focus'))
      await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(null))
      expect(await fresh.getSession()).toBeNull()
      await expect(fresh.signIn(student.email, password)).rejects.toThrow('incorrectos')
    } finally { unsubscribe() }
  })
  it('impide crear administradores por la gestión de alumnos o promoverlos', async () => {
    await expect(dataService.createUser({ full_name: 'Otra Persona', email: 'otro@unacar.mx', password, role: 'admin' })).rejects.toThrow('NIP')
    await expect(dataService.updateUser('demo-user', { role: 'admin' })).rejects.toThrow('NIP')
    await expect(dataService.updateUser('demo-admin', { active: false })).rejects.toThrow('desactivar')
  })
  it('elimina alumnos, conserva sus reportes y revoca credenciales y acceso de ejemplo', async () => {
    const student = await dataService.createUser({ full_name: 'Alumna Temporal', email: 'temporal@unacar.mx', password, role: 'user' })
    await dataService.signIn(student.email, password)
    const report = await dataService.createIncident(studentInput)
    await dataService.enterDemo('admin')
    await dataService.deleteStudent(student.id)
    expect((await dataService.listProfiles()).some(item => item.id === student.id)).toBe(false)
    expect((await dataService.getIncident(report.id)).reporter_id).toBe(student.id)
    await expect(dataService.signIn(student.email, password)).rejects.toThrow('incorrectos')
    await dataService.deleteStudent('demo-user')
    await expect(dataService.enterDemo('user')).rejects.toThrow('eliminada')
    await expect(dataService.deleteStudent('demo-admin')).rejects.toThrow('estudiante')
  })
  it('bloquea directorio, cuentas, edición, baja y PDF semanal para estudiantes', async () => {
    await dataService.enterDemo('user')
    await expect(dataService.listProfiles()).rejects.toThrow('administradora')
    await expect(dataService.createUser({ full_name: 'Otra Persona', email: 'otra@unacar.mx', password, role: 'user' })).rejects.toThrow('administradora')
    await expect(dataService.deleteStudent('demo-reporter-1')).rejects.toThrow('administradora')
    await expect(dataService.updateIncident('demo-incident-36', { status: 'Urgente' })).rejects.toThrow('administradora')
    await expect(dataService.deleteIncident('demo-incident-36')).rejects.toThrow('administradora')
    await expect(dataService.getWeeklyIncidents('2026-11-02')).rejects.toThrow('administradora')
  })
})

describe('Reportes del estudiante y gestión administrativa', () => {
  it('limita consulta y seguimiento a los reportes del propio estudiante', async () => {
    await dataService.enterDemo('user')
    const own = await dataService.listIncidents()
    expect(own.length).toBeGreaterThan(0)
    expect(own.every(item => item.reporter_id === 'demo-user')).toBe(true)
    await expect(dataService.getIncident('demo-incident-35')).rejects.toThrow('no existe')
    await expect(dataService.getHistory('demo-incident-35')).rejects.toThrow('no existe')
    expect((await dataService.getHistory(own[0].id)).length).toBeGreaterThan(0)
  })
  it('registra sólo título, descripción y fotografía opcional con estado inicial Pendiente', async () => {
    await dataService.enterDemo('user')
    const created = await dataService.createIncident({ ...studentInput, reporter_id: 'demo-admin' } as never)
    expect(created).toMatchObject({ ...STUDENT_INCIDENT_DEFAULTS, reporter_id: 'demo-user', photo_url: null, folio: 'INC-000037' })
    expect((await dataService.getHistory(created.id))[0]).toMatchObject({ action: 'created', actor_id: 'demo-user' })
  })
  it('rechaza intentos del alumno de imponer estado o metadatos administrativos', async () => {
    await dataService.enterDemo('user')
    for (const patch of [{ status: 'Urgente' }, { priority: 'Alta' }, { category: 'Electricidad' }, { building: 'Rectoría' }, { assignee_id: 'demo-admin' }, { observations: 'Atender de inmediato' }]) {
      await expect(dataService.createIncident({ ...studentInput, ...patch } as IncidentInput)).rejects.toThrow('estudiantes sólo')
    }
  })
  it('permite al administrador crear Urgente, solucionar y reabrir con historial', async () => {
    const created = await dataService.createIncident({ ...studentInput, status: 'Urgente' })
    expect(created.status).toBe('Urgente')
    const solved = await dataService.updateIncident(created.id, { status: 'Solucionado' })
    expect(solved.resolved_at).toBeTruthy()
    expect((await dataService.getHistory(created.id)).some(item => item.action === 'status_changed' && (item.changes.status as { to: string }).to === 'Solucionado')).toBe(true)
    expect((await dataService.updateIncident(created.id, { status: 'Pendiente' })).resolved_at).toBeNull()
  })
  it('mantiene baja lógica e historial exclusivamente para administración', async () => {
    const created = await dataService.createIncident(studentInput)
    const before = (await dataService.listIncidents()).length
    await dataService.deleteIncident(created.id)
    expect((await dataService.listIncidents()).length).toBe(before - 1)
    await expect(dataService.getIncident(created.id)).rejects.toThrow('dada de baja')
    expect((await dataService.getHistory(created.id)).some(item => item.action === 'deleted')).toBe(true)
  })
  it('migra estados persistidos sin perder reportes, perfiles ni historial', () => {
    const old = createDemoData()
    old.incidents[0].status = 'En proceso' as never
    old.incidents[1].status = 'Resuelta' as never
    old.incidents[2].status = 'Cancelada' as never
    const migrated = migrateDemoData(old)
    expect(migrated.incidents.slice(0, 3).map(item => item.status)).toEqual(['Urgente', 'Solucionado', 'Pendiente'])
    expect(migrated.incidents).toHaveLength(36)
    expect(migrated.profiles).toHaveLength(old.profiles.length)
    expect(migrated.history).toHaveLength(old.history.length)
    expect(migrated.incidents.every(item => STATUSES.includes(item.status))).toBe(true)
    expect(old.incidents[0].status).toBe('En proceso')
  })
})

describe('Semana y estadísticas con fechas del campus', () => {
  it('incluye lunes y domingo CDMX y excluye las horas vecinas de otras semanas', async () => {
    vi.useFakeTimers()
    const times = ['2026-11-02T05:59:59.999Z', '2026-11-02T06:00:00.000Z', '2026-11-09T05:59:59.999Z', '2026-11-09T06:00:00.000Z']
    const created: Incident[] = []
    for (let index = 0; index < times.length; index++) {
      vi.setSystemTime(new Date(times[index]))
      created.push(await dataService.createIncident({ ...studentInput, title: `Límite semanal de prueba ${index}` }))
    }
    const weekly = await dataService.getWeeklyIncidents('2026-11-02')
    expect(weekly.some(item => item.id === created[0].id)).toBe(false)
    expect(weekly.some(item => item.id === created[1].id)).toBe(true)
    expect(weekly.some(item => item.id === created[2].id)).toBe(true)
    expect(weekly.some(item => item.id === created[3].id)).toBe(false)
    expect(getWeekRange('2026-11-02')).toEqual({ dateFrom: '2026-11-02', dateTo: '2026-11-08' })
  })
  it('rechaza semanas que no comienzan en lunes y fechas inexistentes', () => {
    expect(() => getWeekRange('2026-11-04')).toThrow('lunes')
    expect(() => getWeekRange('2026-02-30')).toThrow('válida')
    expect(() => getWeekRange('04/11/2026')).toThrow('válida')
  })
  it('calcula los tres estados a partir de registros y respeta filtros', () => {
    const { incidents } = createDemoData()
    const stats = getDashboardStats(incidents)
    expect(stats.pending + stats.urgent + stats.solved).toBe(stats.total)
    expect(stats.byStatus.map(item => item.name)).toEqual(['Pendiente', 'Urgente', 'Solucionado'])
    expect(filterIncidents(incidents, { search: 'computo' }).length).toBeGreaterThan(0)
    expect(filterIncidents(incidents, { search: 'INC-000036' })).toHaveLength(1)
    expect(getDashboardStats([]).resolutionRate).toBe(0)
  })
})

describe('Validación y fotografías', () => {
  it('valida título, descripción, estados y contraseñas sin filtrar datos secretos', () => {
    expect(incidentSchema.safeParse({ ...studentInput, title: ' ' }).success).toBe(false)
    expect(incidentSchema.safeParse({ ...studentInput, description: 'corta' }).success).toBe(false)
    expect(incidentSchema.safeParse({ ...studentInput, status: 'Resuelta' }).success).toBe(false)
    expect(createUserSchema.safeParse({ full_name: 'Nombre Usuario', email: 'persona@unacar.mx', password: '123', role: 'user' }).success).toBe(false)
    expect(readableError(new Error('Invalid login credentials'))).toBe('El correo o la contraseña son incorrectos.')
  })
  it('rechaza formatos incompatibles y fotografías mayores a 5 MB', async () => {
    await expect(dataService.uploadPhoto(new File(['pdf'], 'prueba.pdf', { type: 'application/pdf' }))).rejects.toThrow('JPG, PNG o WebP')
    await expect(dataService.uploadPhoto(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' }))).rejects.toThrow('5 MB')
    await expect(dataService.forgotPassword('persona@unacar.mx')).rejects.toThrow('no envía correos')
  })
})
