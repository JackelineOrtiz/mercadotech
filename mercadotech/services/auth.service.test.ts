import { describe, it, expect, vi } from "vitest";
import { register, login, logout, getSession, onAuthStateChange } from "@/services/auth.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("auth.service.register", () => {
  it("manda display_name y role dentro de options.data (los lee el trigger handle_new_user)", async () => {
    const supabase = mockSupabase(
      {},
      { auth: { signUp: { data: { user: { id: "u1" }, session: null }, error: null } } },
    );

    await register(
      { email: "a@a.com", password: "12345678", displayName: "Ana", role: "buyer" },
      supabase,
    );

    expect(supabase.authCalls).toContainEqual({
      method: "signUp",
      params: {
        email: "a@a.com",
        password: "12345678",
        options: { data: { display_name: "Ana", role: "buyer" } },
      },
    });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase(
      {},
      { auth: { signUp: { error: { message: "User already registered" } } } },
    );
    await expect(
      register({ email: "a@a.com", password: "12345678", displayName: "Ana", role: "buyer" }, supabase),
    ).rejects.toMatchObject({ message: "User already registered" });
  });
});

describe("auth.service.login", () => {
  it("devuelve data en éxito", async () => {
    const supabase = mockSupabase(
      {},
      { auth: { signInWithPassword: { data: { user: { id: "u1" }, session: {} }, error: null } } },
    );
    const data = await login("a@a.com", "12345678", supabase);
    expect((data as { user: { id: string } }).user.id).toBe("u1");
  });

  it("propaga el error tal cual (credenciales inválidas)", async () => {
    const supabase = mockSupabase(
      {},
      { auth: { signInWithPassword: { error: { message: "Invalid login credentials" } } } },
    );
    await expect(login("a@a.com", "mala-clave", supabase)).rejects.toMatchObject({
      message: "Invalid login credentials",
    });
  });
});

describe("auth.service.logout", () => {
  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({}, { auth: { signOut: { error: { message: "network error" } } } });
    await expect(logout(supabase)).rejects.toMatchObject({ message: "network error" });
  });

  it("no lanza si signOut resuelve sin error", async () => {
    const supabase = mockSupabase({}, { auth: { signOut: { error: null } } });
    await expect(logout(supabase)).resolves.toBeUndefined();
  });
});

describe("auth.service.getSession", () => {
  it("sin usuario logueado: null, sin siquiera consultar profiles", async () => {
    const supabase = mockSupabase(
      { profiles: { single: { id: "u1" } } },
      { auth: { getUser: { data: { user: null } } } },
    );
    const session = await getSession(supabase);
    expect(session).toBeNull();
    expect(supabase.calls.some((c) => c.table === "profiles")).toBe(false);
  });

  it("con usuario y profile: devuelve ambos", async () => {
    const supabase = mockSupabase(
      { profiles: { single: { id: "u1", display_name: "Ana", role: "buyer" } } },
      { auth: { getUser: { data: { user: { id: "u1" } } } } },
    );
    const session = await getSession(supabase);
    expect(session?.user).toEqual({ id: "u1" });
    expect(session?.profile).toEqual({ id: "u1", display_name: "Ana", role: "buyer" });
  });

  it("comportamiento actual, revisar: si falla el fetch del profile, el error se silencia (profile queda null, user se mantiene) — documentado explícitamente en el comentario de auth.service.ts", async () => {
    const supabase = mockSupabase(
      { profiles: { error: { message: "permission denied" } } },
      { auth: { getUser: { data: { user: { id: "u1" } } } } },
    );
    const session = await getSession(supabase);
    expect(session?.user).toEqual({ id: "u1" });
    expect(session?.profile).toBeNull();
  });
});

describe("auth.service.onAuthStateChange", () => {
  it("devuelve una función de limpieza que llama a unsubscribe", () => {
    const unsubscribe = vi.fn();
    const supabase = mockSupabase({}, { auth: { onAuthStateChange: { unsubscribe } } });

    const cleanup = onAuthStateChange(() => {}, supabase);
    cleanup();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
