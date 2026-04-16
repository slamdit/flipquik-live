import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const ensureProfile = async (userId) => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      if (!data) {
        await supabase
          .from('profiles')
          .insert({ id: userId, is_pro: false, subscription_status: 'free' });
      }
    };

    // Get current session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      if (currentUser) await ensureProfile(currentUser.id);
      setUser(currentUser);
      setIsLoadingAuth(false);
    });

    // Keep user in sync with auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (currentUser) await ensureProfile(currentUser.id);
      setUser(currentUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoadingAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
