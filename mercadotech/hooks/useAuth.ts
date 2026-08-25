"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import * as authService from "@/services/auth.service";
import type { RegisterInput } from "@/services/auth.service";
import type { Profile } from "@/types/user";

export interface UseAuthState {
  user: User | null;
  profile: Profile | null;
  initializing: boolean;
  loading: boolean;
  error: string | null;
}

// Estado global de sesión: cualquier página que conecte esto pasa user/
// profile por props a componentes puros (UserMenu, guards de rol). Escucha
// onAuthStateChange para reaccionar a login/logout hechos en otra pestaña o
// por el propio hook.
export function useAuth() {
  const [state, setState] = useState<UseAuthState>({
    user: null,
    profile: null,
    initializing: true,
    loading: false,
    error: null,
  });

  const loadProfile = useCallback(async () => {
    const session = await authService.getSession();

    if (!session) {
      setState((s) => ({ ...s, user: null, profile: null, initializing: false }));
      return;
    }

    setState((s) => ({
      ...s,
      user: session.user,
      profile: session.profile,
      initializing: false,
    }));
  }, []);

  useEffect(() => {
    loadProfile();
    return authService.onAuthStateChange(() => loadProfile());
  }, [loadProfile]);

  const register = useCallback(async (input: RegisterInput) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await authService.register(input);
      setState((s) => ({ ...s, loading: false }));
      return data;
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await authService.login(email, password);
      setState((s) => ({ ...s, loading: false }));
      return data;
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
  }, []);

  return { ...state, register, login, logout };
}
