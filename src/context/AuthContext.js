// ============================================================
// AuthContext — App-wide authentication state
//
// Wraps the app to provide { user, session, loading, isAuthenticated }
// to any screen. Social features check isAuthenticated before
// allowing access. Core workout features work without an account.
//
// Usage:
//   <AuthProvider> ... </AuthProvider>
//
// In screens:
//   const { user, isAuthenticated, signOut } = useContext(AuthContext);
// ============================================================

import React, { createContext, useState, useEffect, useCallback } from 'react';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  signInWithApple as authSignInWithApple,
  signInWithGoogle as authSignInWithGoogle,
  getSession,
  onAuthStateChange,
  syncLocalDataToSupabase,
} from '../services/auth';

export const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  signInWithApple: async () => {},
  signInWithGoogle: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    // Check for existing session on mount
    const init = async () => {
      try {
        const existingSession = await getSession();
        if (existingSession) {
          setSession(existingSession);
          setUser(existingSession.user);
        }
      } catch (e) {
        // No session — that's fine, auth is optional
      }
      setLoading(false);
    };
    init();

    // Listen for auth changes (sign in, sign out, token refresh)
    const unsubscribe = onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Sync local data on first sign-in
      if (event === 'SIGNED_IN' && newSession?.user && !hasSynced) {
        setHasSynced(true);
        syncLocalDataToSupabase(newSession.user.id);
      }
    });

    return unsubscribe;
  }, [hasSynced]);

  const handleSignIn = useCallback(async (email, password) => {
    const data = await authSignIn(email, password);
    return data;
  }, []);

  const handleSignUp = useCallback(async (email, password, username) => {
    const data = await authSignUp(email, password, username);
    return data;
  }, []);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
  }, []);

  const handleSignInWithApple = useCallback(async () => {
    const data = await authSignInWithApple();
    return data;
  }, []);

  const handleSignInWithGoogle = useCallback(async () => {
    const data = await authSignInWithGoogle();
    return data;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: !!session,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        signInWithApple: handleSignInWithApple,
        signInWithGoogle: handleSignInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
