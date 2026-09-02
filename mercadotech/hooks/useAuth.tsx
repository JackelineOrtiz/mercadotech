"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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

// Bug real encontrado en la re-auditoría ad-hoc (ver docs/BITACORA.md),
// verificando en vivo la subida de avatar: EXACTAMENTE la misma clase de
// bug que useCart documentó en la Fase 6.5 (ver hooks/useCart.tsx) — antes
// de este cambio, useAuth era un hook "de instancia": cada llamada
// (ShopLayout para el Navbar, /perfil para el formulario, cada layout de
// grupo de rutas para su guard) creaba su PROPIO useState independiente.
// El comentario original de este archivo decía que updateProfile/
// uploadAvatar hacían que "UserMenu y esta misma página reflejen el
// cambio" — FALSO, nunca verificado en vivo: subir un avatar real desde
// /perfil actualizaba esa instancia, pero el avatar del Navbar (una
// instancia de useAuth() DISTINTA, montada en (shop)/layout.tsx) seguía
// mostrando las iniciales viejas hasta un reload completo. A diferencia
// de useCart (solo (shop)/ lo necesita), useAuth se usa en las 4 rutas
// (shop/seller/admin/auth), así que el Provider va en la raíz
// (app/layout.tsx), no en un solo grupo de rutas.
function useAuthState() {
  const [state, setState] = useState<UseAuthState>({
    user: null,
    profile: null,
    initializing: true,
    loading: false,
    error: null,
  });

  // Devuelve el profile recién cargado (además de guardarlo en el estado):
  // lo necesita login() de acá abajo para poder redirigir según el rol
  // apenas resuelve, sin esperar un segundo render a que el Context se
  // actualice solo por el listener de onAuthStateChange.
  const loadProfile = useCallback(async () => {
    const session = await authService.getSession();

    if (!session) {
      setState((s) => ({ ...s, user: null, profile: null, initializing: false }));
      return null;
    }

    setState((s) => ({
      ...s,
      user: session.user,
      profile: session.profile,
      initializing: false,
    }));
    return session.profile;
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
      // profile del propio login, no del estado del Context (que recién
      // se actualiza async vía el listener de onAuthStateChange, un
      // render después) — LoginPage lo necesita YA para decidir a dónde
      // redirigir según el rol.
      const profile = await loadProfile();
      setState((s) => ({ ...s, loading: false }));
      return { ...data, profile };
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      throw err;
    }
  }, [loadProfile]);

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

  // updateProfile y uploadAvatar recargan el profile al terminar
  // (loadProfile) — ahora sí propaga a TODO consumidor real, porque todos
  // leen la misma instancia vía Context (ver AuthProvider más abajo).
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

type AuthContextValue = ReturnType<typeof useAuthState>;

const AuthContext = createContext<AuthContextValue | null>(null);

// Una sola instancia real por sesión de navegador — se monta en
// app/layout.tsx (la raíz, no un grupo de rutas: (shop)/(seller)/(admin)/
// (auth) son grupos HERMANOS bajo la raíz, ninguno anida a los otros, así
// que el Provider tiene que vivir arriba de los cuatro para que todos
// compartan la misma instancia).
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider> (ver app/layout.tsx).");
  }
  return context;
}
