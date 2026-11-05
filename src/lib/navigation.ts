/** Auth owns the fragment on its callback; the router takes over after session initialization. */
export function buildRecoveryRedirectUrl(): string {
  const page = new URL(globalThis.location.href);
  if (!['http:', 'https:'].includes(page.protocol)) {
    throw new Error('Abre CampusFix desde su dirección web para recuperar la contraseña.');
  }
  const callback = new URL(import.meta.env.BASE_URL || '/', page);
  if (!callback.pathname.endsWith('/')) callback.pathname += '/';
  callback.search = '';
  callback.hash = '';
  callback.searchParams.set('recovery', '1');
  return callback.toString();
}

export function isRecoveryRedirectRequested(): boolean {
  return new URLSearchParams(globalThis.location.search).get('recovery') === '1';
}

export function clearRecoveryRedirectFlag(): void {
  const url = new URL(globalThis.location.href);
  if (!url.searchParams.has('recovery')) return;
  url.searchParams.delete('recovery');
  globalThis.history.replaceState(globalThis.history.state, '', url.toString());
}
