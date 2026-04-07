import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────
// AUTH HELPERS (replaces legacy auth)
// ─────────────────────────────────────────────
export const auth = {
  // Get current user (replaces legacy auth.me())
  me: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    return user;
  },

  signUp: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    return data;
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// ─────────────────────────────────────────────
// DATABASE HELPERS (replaces legacy entities)
// Each mirrors the legacy API pattern
// ─────────────────────────────────────────────

// Generic query builder
const db = {
  // replaces .filter({ user_id: id }, '-updated_at', 500)
  query: (table) => ({
    getAll: async ({ filters = {}, orderBy = 'created_at', ascending = false, limit = 500 } = {}) => {
      let q = supabase.from(table).select('*');
      Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v); });
      q = q.order(orderBy.replace('-', ''), { ascending: orderBy.startsWith('-') ? false : ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    getOne: async (id) => {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    create: async (payload) => {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    update: async (id, payload) => {
      const { data, error } = await supabase.from(table).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  })
};

// ─────────────────────────────────────────────
// ENTITY SHORTCUTS (drop-in for legacy pattern)
// Usage: import { items } from '@/lib/supabase'
//        const myItems = await items.getAll({ filters: { user_id } })
// ─────────────────────────────────────────────
export const items                  = db.query('items');
export const itemPhotos             = db.query('item_photos');
export const sales                  = db.query('sales');
export const marketplaceActions     = db.query('marketplace_actions');
export const marketplaceListings    = db.query('marketplace_listings');
export const marketplaceAccounts    = db.query('marketplace_accounts');
export const platformTemplates      = db.query('platform_templates');
export const inventoryLocations     = db.query('inventory_locations');
export const itemStorageAssignments = db.query('item_storage_assignments');
export const mileageTrips           = db.query('mileage_trips');
export const expenses               = db.query('expenses');
export const profiles               = db.query('profiles');

// ─────────────────────────────────────────────
// STORAGE HELPERS (replaces legacy UploadFile)
// ─────────────────────────────────────────────
export const storage = {
  uploadPhoto: async (file, userId) => {
    const ext = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('item-photos')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('item-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  deletePhoto: async (url) => {
    // Extract path from full URL
    const path = url.split('/item-photos/')[1];
    if (!path) return;
    const { error } = await supabase.storage.from('item-photos').remove([path]);
    if (error) console.error('Delete photo error:', error);
  }
};

// ─────────────────────────────────────────────
// AI HELPER (replaces legacy InvokeLLM)
// Calls Anthropic API via your Supabase Edge Function
// ─────────────────────────────────────────────
export const ai = {
  invoke: async (prompt, options = {}) => {
    const { data, error } = await supabase.functions.invoke('quikeval', {
      body: { prompt, ...options }
    });
    if (error) throw error;
    return data;
  }
};

export default supabase;
