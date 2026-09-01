"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import * as authService from "@/services/auth.service";
import type { RegisterInput, UpdateProfileInput } from "@/services/auth.service";
import * as storageService from "@/services/storage.service";
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

  const requestPasswordReset = useCallback(async (email: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await authService.requestPasswordReset(email);
      setState((s) => ({ ...s, loading: false }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await authService.updatePassword(password);
      setState((s) => ({ ...s, loading: false }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, []);

  // Distinto de updatePassword: se usa desde /perfil (sesión normal, no de
  // recuperación) y por eso reautentica con la contraseña actual primero —
  // ver el hallazgo real documentado en auth.service.changePassword.
  const changePassword = useCallback(
    async (email: string, currentPassword: string, newPassword: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        await authService.changePassword(email, currentPassword, newPassword);
        setState((s) => ({ ...s, loading: false }));
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
        throw err;
      }
    },
    [],
  );

  // updateProfile y uploadAvatar recargan el profile al terminar (loadProfile)
  // para que UserMenu y esta misma página reflejen el cambio sin esperar a
  // un evento de onAuthStateChange, que no dispara con un UPDATE a profiles
  // (solo con cambios de sesión de auth).
  const updateProfile = useCallback(
    async (userId: string, input: UpdateProfileInput) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        await authService.updateProfile(userId, input);
        await loadProfile();
        setState((s) => ({ ...s, loading: false }));
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
        throw err;
      }
    },
    [loadProfile],
  );

  const uploadAvatar = useCallback(
    async (userId: string, file: File) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const path = await storageService.uploadAvatar(file, userId);
        await authService.updateAvatarPath(userId, path);
        await loadProfile();
        setState((s) => ({ ...s, loading: false }));
      } catch (err) {
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
        throw err;
      }
    },
    [loadProfile],
  );

  return {
    ...state,
    register,
    login,
    logout,
    requestPasswordReset,
    updatePassword,
    changePassword,
    updateProfile,
    uploadAvatar,
    refreshProfile: loadProfile,
  };
}
