// Stub — legacy SDK removed. Use src/lib/supabase.js instead.
export const base44 = {
  auth: { me: async () => { throw new Error('Legacy SDK removed — use Supabase auth'); } },
  entities: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => { throw new Error('Legacy SDK removed — use src/lib/supabase.js'); } }) }),
  integrations: { Core: { UploadFile: async () => { throw new Error('Legacy SDK removed'); }, InvokeLLM: async () => { throw new Error('Legacy SDK removed'); } } },
  functions: { invoke: async () => { throw new Error('Legacy SDK removed'); } },
};
