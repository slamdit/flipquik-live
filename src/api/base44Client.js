// Stub — Base44 SDK removed. Use src/lib/supabase.js instead.
export const base44 = {
  auth: { me: async () => { throw new Error('base44 removed — use supabase auth'); } },
  entities: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => { throw new Error('base44 removed'); } }) }),
  integrations: { Core: { UploadFile: async () => { throw new Error('base44 removed'); }, InvokeLLM: async () => { throw new Error('base44 removed'); } } },
  functions: { invoke: async () => { throw new Error('base44 removed'); } },
};
