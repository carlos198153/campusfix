// Minimal runtime declarations for local `tsc -p supabase/tsconfig.json`.
// Supabase executes the functions in Deno; these declarations add no runtime code.
declare namespace Deno {
  namespace env { function get(name: string): string | undefined; }
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}
declare module 'npm:@supabase/supabase-js@2.78.0' {
  export const createClient: typeof import('@supabase/supabase-js').createClient;
}
