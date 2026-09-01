import { describe, it, expect, vi } from "vitest";
import {
  register,
  login,
  logout,
  getSession,
  onAuthStateChange,
  updateProfile,
  updateAvatarPath,
  changePassword,
} from "@/services/auth.service";
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

  it("con usuario y profile: devuelve ambos, avatar_url null si no hay avatar_path", async () => {
    const supabase = mockSupabase(
      { profiles: { single: { id: "u1", display_name: "Ana", role: "buyer" } } },
      { auth: { getUser: { data: { user: { id: "u1" } } } } },
    );
    const session = await getSession(supabase);
    expect(session?.user).toEqual({ id: "u1" });
    expect(session?.profile).toEqual({
      id: "u1",
      display_name: "Ana",
      role: "buyer",
      avatar_url: null,
    });
  });

  it("con avatar_path: resuelve avatar_url vía storage.getPublicUrl (bucket avatars)", async () => {
    const supabase = mockSupabase(
      {
        profiles: {
          single: { id: "u1", display_name: "Ana", role: "buyer", avatar_path: "u1/avatar.jpg" },
        },
      },
      { auth: { getUser: { data: { user: { id: "u1" } } } } },
    );
    const session = await getSession(supabase);
    expect(session?.profile?.avatar_url).toBe(
      "https://fake.supabase.local/storage/v1/object/public/avatars/u1/avatar.jpg",
    );
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

describe("auth.service.updateProfile", () => {
  it("hace update de display_name/phone (trim aplicado) filtrando por id", async () => {
    const supabase = mockSupabase({ profiles: {} });

    await updateProfile("u1", { displayName: "  Ana  ", phone: "  987654321  " }, supabase);

    expect(supabase.updates("profiles")).toContainEqual({
      display_name: "Ana",
      phone: "987654321",
    });
    const call = supabase.calls.find((c) => c.table === "profiles" && c.op === "update");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["id", "u1"] });
  });

  it("teléfono vacío (tras trim) se guarda como null, no como string vacío", async () => {
    const supabase = mockSupabase({ profiles: {} });
    await updateProfile("u1", { displayName: "Ana", phone: "   " }, supabase);
    expect(supabase.updates("profiles")).toContainEqual({ display_name: "Ana", phone: null });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ profiles: { error: { message: "permission denied" } } });
    await expect(
      updateProfile("u1", { displayName: "Ana", phone: "" }, supabase),
    ).rejects.toMatchObject({ message: "permission denied" });
  });
});

describe("auth.service.updateAvatarPath", () => {
  it("hace update de avatar_path filtrando por id", async () => {
    const supabase = mockSupabase({ profiles: {} });
    await updateAvatarPath("u1", "u1/avatar.jpg", supabase);
    expect(supabase.updates("profiles")).toContainEqual({ avatar_path: "u1/avatar.jpg" });
    const call = supabase.calls.find((c) => c.table === "profiles" && c.op === "update");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["id", "u1"] });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ profiles: { error: { message: "permission denied" } } });
    await expect(updateAvatarPath("u1", "u1/avatar.jpg", supabase)).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});

describe("auth.service.changePassword", () => {
  it("reautentica con signInWithPassword antes de updateUser, en ese orden", async () => {
    const supabase = mockSupabase(
      {},
      {
        auth: {
          signInWithPassword: { data: { user: { id: "u1" }, session: {} }, error: null },
          updateUser: { error: null },
        },
      },
    );

    await changePassword("a@a.com", "actual123", "nueva12345", supabase);

    expect(supabase.authCalls).toEqual([
      { method: "signInWithPassword", params: { email: "a@a.com", password: "actual123" } },
      { method: "updateUser", params: { password: "nueva12345" } },
    ]);
  });

  it("si la reautenticación falla (contraseña actual incorrecta), NUNCA llega a llamar updateUser", async () => {
    const supabase = mockSupabase(
      {},
      {
        auth: {
          signInWithPassword: { error: { message: "Invalid login credentials" } },
        },
      },
    );

    await expect(
      changePassword("a@a.com", "mala-clave", "nueva12345", supabase),
    ).rejects.toMatchObject({ message: "Invalid login credentials" });

    expect(supabase.authCalls.some((c) => c.method === "updateUser")).toBe(false);
  });

  it("propaga el error de updateUser tal cual (reautenticación ya pasó)", async () => {
    const supabase = mockSupabase(
      {},
      {
        auth: {
          signInWithPassword: { data: { user: { id: "u1" }, session: {} }, error: null },
          updateUser: { error: { message: "New password should be different from the old password." } },
        },
      },
    );

    await expect(
      changePassword("a@a.com", "actual123", "actual123", supabase),
    ).rejects.toMatchObject({ message: "New password should be different from the old password." });
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
