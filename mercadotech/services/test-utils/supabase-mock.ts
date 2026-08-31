// Fábrica del mock encadenable de Supabase — único helper compartido de la
// Fase 6.3. El cliente se INYECTA siempre (decisión 7 de la spec): esto es
// un doble construido en el test, nunca un vi.mock de lib/supabase/*.
//
// Uso (ver el ejemplo de la spec):
//   const supabase = mockSupabase({
//     cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
//     products: { single: { stock: 4 } },
//   });
//   await addItem("u1", "p1", 5, supabase);
//   expect(supabase.updates("cart_items")).toContainEqual({ quantity: 4 });
//
// El objeto devuelto ES el cliente (duck-typed: from/rpc/auth/storage) Y
// trae la introspección (inserts/updates/deletes/calls) en el mismo
// objeto, tal como lo usa el ejemplo de la spec.
//
// mockSupabase() devuelve MockSupabaseClient & SupabaseClient<Database>: el
// tipo real de Supabase es una CLASE con propiedades internas (supabaseUrl,
// realtime, functions...) que este doble deliberadamente no implementa —
// structural typing lo rechaza si se lo pasa tal cual a un service
// (`Client = SupabaseClient<Database>`). Un único cast controlado, acá y
// solo acá (nunca uno por archivo de test), documenta esa brecha.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ResolveKind = "select" | "single" | "maybeSingle" | "insert" | "update" | "delete" | "upsert";

export interface TableResponse {
  // Valor de "data" para un await directo del builder (sin .single()/
  // .maybeSingle() explícito) o tras .returns<T[]>() — normalmente un array.
  select?: unknown;
  single?: unknown;
  maybeSingle?: unknown;
  insert?: unknown;
  update?: unknown;
  upsert?: unknown;
  delete?: unknown;
  // Si está seteado, CUALQUIER operación contra esta tabla resuelve con
  // este error (data: null) — así se simula "esta tabla falla" sin tener
  // que replicar el resto de su configuración.
  error?: unknown;
  count?: number;
}

export interface RpcResponse {
  data?: unknown;
  error?: unknown;
}

export interface AuthResponses {
  signUp?: { data?: unknown; error?: unknown };
  signInWithPassword?: { data?: unknown; error?: unknown };
  signOut?: { error?: unknown };
  getUser?: { data?: { user: unknown } };
  onAuthStateChange?: { unsubscribe?: () => void };
}

export interface StorageBucketResponse {
  upload?: { error?: unknown };
  remove?: { error?: unknown };
}

export interface MockSupabaseOptions {
  rpc?: Record<string, RpcResponse>;
  auth?: AuthResponses;
  storage?: Record<string, StorageBucketResponse>;
}

export interface StorageCallRecord {
  bucket: string;
  op: "upload" | "remove";
  args: unknown[];
}

export interface AuthCallRecord {
  method: "signUp" | "signInWithPassword" | "signOut" | "getUser";
  params: unknown;
}

export interface CallRecord {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  // Argumento posicional del propio insert/update/upsert (el objeto que se
  // intenta escribir) — es lo que exponen inserts()/updates().
  payload: unknown;
  // Cada método encadenado después (eq, in, or, gte, lte, order, range...),
  // en el orden real en que el service los llamó.
  chain: Array<{ method: string; args: unknown[] }>;
}

export interface MockSupabaseClient {
  from(table: string): unknown;
  rpc(name: string, args?: unknown): Promise<RpcResponse>;
  auth: {
    signUp: (params: unknown) => Promise<{ data: unknown; error: unknown }>;
    signInWithPassword: (params: unknown) => Promise<{ data: unknown; error: unknown }>;
    signOut: () => Promise<{ error: unknown }>;
    getUser: () => Promise<{ data: { user: unknown } }>;
    onAuthStateChange: (cb: () => void) => { data: { subscription: { unsubscribe: () => void } } };
  };
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
      upload(path: string, file: unknown, options?: unknown): Promise<{ error: unknown }>;
      remove(paths: string[]): Promise<{ error: unknown }>;
    };
  };
  calls: CallRecord[];
  rpcCalls: Array<{ name: string; args: unknown }>;
  storageCalls: StorageCallRecord[];
  authCalls: AuthCallRecord[];
  inserts(table: string): unknown[];
  updates(table: string): unknown[];
  upserts(table: string): unknown[];
  deletes(table: string): CallRecord[];
}

function resolveFor(tableConfig: TableResponse, kind: ResolveKind): { data: unknown; error: unknown; count?: number } {
  // Limitación conocida (code review de la Fase 6.3): `error` se aplica a
  // TODA la tabla, no a una operación puntual — un test no puede expresar
  // "el SELECT de esta tabla funciona pero el UPDATE falla" sin que el
  // SELECT también falle. Para los services de este proyecto el resultado
  // observable es el mismo (la función nunca llega a resolver con éxito de
  // todos modos), así que no hizo falta granularidad por operación — si un
  // caso futuro sí la necesita, TableResponse tendría que aceptar `error`
  // por kind (ej. `{ update: { error: ... } }`) en vez de a nivel de tabla.
  if (tableConfig.error !== undefined) {
    return { data: null, error: tableConfig.error };
  }
  const value = tableConfig[kind];
  if (kind === "select") {
    const data = value ?? [];
    return { data, error: null, count: tableConfig.count ?? (Array.isArray(data) ? data.length : undefined) };
  }
  // insert/update/upsert/delete sin .select() encadenado: el caller real
  // solo mira `error`, así que `data: null` por defecto es un valor válido.
  return { data: value ?? null, error: null };
}

function makeBuilder(
  table: string,
  op: CallRecord["op"],
  payload: unknown,
  tableConfig: TableResponse,
  calls: CallRecord[],
): unknown {
  const record: CallRecord = { table, op, payload, chain: [] };
  calls.push(record);

  // Un Proxy en vez de enumerar eq/in/or/gte/lte/ilike/order/range/...: el
  // service real puede encadenar cualquier método de PostgREST y todos se
  // comportan igual acá — registrar y devolver el mismo builder. Solo
  // single()/maybeSingle()/then() son especiales (disparan la resolución).
  const builder = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
            Promise.resolve(resolveFor(tableConfig, op === "select" ? "select" : op)).then(
              onFulfilled,
              onRejected,
            );
        }
        if (prop === "single" || prop === "maybeSingle") {
          const kind = prop as ResolveKind;
          return () => {
            // El objeto real de PostgREST sigue permitiendo encadenar
            // .returns<T>() DESPUÉS de .single()/.maybeSingle() (es un
            // no-op a nivel de tipos, no de runtime) — order.service.ts lo
            // usa así. Un Proxy propio autorreferenciado, no una Promise
            // plana, para que cualquier método encadenado extra (incluido
            // .returns()) devuelva el mismo thenable en vez de romper.
            const resolved = new Proxy(
              {},
              {
                get(_t, p: string | symbol) {
                  if (p === "then") {
                    const result = resolveFor(tableConfig, kind);
                    return (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
                      Promise.resolve(result).then(onFulfilled, onRejected);
                  }
                  if (typeof p !== "string") return undefined;
                  // ej. .returns<T>(): no-op encadenable, ignora cualquier argumento.
                  return () => resolved;
                },
              },
            );
            return resolved;
          };
        }
        if (typeof prop !== "string") return undefined;
        return (...args: unknown[]) => {
          record.chain.push({ method: prop, args });
          return builder;
        };
      },
    },
  );
  return builder;
}

export function mockSupabase(
  tables: Record<string, TableResponse> = {},
  options: MockSupabaseOptions = {},
): MockSupabaseClient & SupabaseClient<Database> {
  const calls: CallRecord[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const storageCalls: StorageCallRecord[] = [];
  const authCalls: AuthCallRecord[] = [];

  const client: MockSupabaseClient = {
    from(table: string) {
      const tableConfig = tables[table] ?? {};
      return {
        select: (...args: unknown[]) => {
          const b = makeBuilder(table, "select", undefined, tableConfig, calls);
          // El primer arg de .select() (columnas) no importa para el mock;
          // se registra igual en el chain para poder inspeccionarlo si hace falta.
          (calls[calls.length - 1] as CallRecord).chain.push({ method: "select", args });
          return b;
        },
        insert: (payload: unknown) => makeBuilder(table, "insert", payload, tableConfig, calls),
        update: (payload: unknown) => makeBuilder(table, "update", payload, tableConfig, calls),
        delete: () => makeBuilder(table, "delete", undefined, tableConfig, calls),
        upsert: (payload: unknown, ...rest: unknown[]) => {
          const b = makeBuilder(table, "upsert", payload, tableConfig, calls);
          if (rest.length > 0) {
            (calls[calls.length - 1] as CallRecord).chain.push({ method: "upsert-options", args: rest });
          }
          return b;
        },
      };
    },
    rpc(name: string, args?: unknown) {
      rpcCalls.push({ name, args });
      const cfg = options.rpc?.[name] ?? { data: null, error: null };
      return Promise.resolve(cfg);
    },
    auth: {
      // Cada método normaliza su respuesta rellenando data/error con
      // defaults ANTES de devolver (no un `?? {...}` sobre el objeto
      // entero): así una config parcial en options.auth (ej. solo `error`,
      // sin `data`) sigue satisfaciendo el tipo requerido, y el caller real
      // (auth.service.ts) siempre recibe la forma completa que espera.
      signUp: async (params: unknown) => {
        authCalls.push({ method: "signUp", params });
        const cfg = options.auth?.signUp;
        return { data: cfg?.data ?? { user: null, session: null }, error: cfg?.error ?? null };
      },
      signInWithPassword: async (params: unknown) => {
        authCalls.push({ method: "signInWithPassword", params });
        const cfg = options.auth?.signInWithPassword;
        return { data: cfg?.data ?? { user: null, session: null }, error: cfg?.error ?? null };
      },
      signOut: async () => {
        authCalls.push({ method: "signOut", params: undefined });
        return { error: options.auth?.signOut?.error ?? null };
      },
      getUser: async () => {
        authCalls.push({ method: "getUser", params: undefined });
        return { data: options.auth?.getUser?.data ?? { user: null } };
      },
      onAuthStateChange: (_cb: () => void) => {
        void _cb;
        const unsubscribe = options.auth?.onAuthStateChange?.unsubscribe ?? (() => {});
        return { data: { subscription: { unsubscribe } } };
      },
    },
    storage: {
      from(bucket: string) {
        const bucketConfig = options.storage?.[bucket] ?? {};
        return {
          getPublicUrl(path: string) {
            return { data: { publicUrl: `https://fake.supabase.local/storage/v1/object/public/${bucket}/${path}` } };
          },
          async upload(path: string, file: unknown, uploadOptions?: unknown) {
            storageCalls.push({ bucket, op: "upload", args: [path, file, uploadOptions] });
            return { error: bucketConfig.upload?.error ?? null };
          },
          async remove(paths: string[]) {
            storageCalls.push({ bucket, op: "remove", args: [paths] });
            return { error: bucketConfig.remove?.error ?? null };
          },
        };
      },
    },
    calls,
    rpcCalls,
    storageCalls,
    authCalls,
    inserts: (table: string) => calls.filter((c) => c.table === table && c.op === "insert").map((c) => c.payload),
    updates: (table: string) => calls.filter((c) => c.table === table && c.op === "update").map((c) => c.payload),
    upserts: (table: string) => calls.filter((c) => c.table === table && c.op === "upsert").map((c) => c.payload),
    deletes: (table: string) => calls.filter((c) => c.table === table && c.op === "delete"),
  };

  // Único cast del archivo (ver el comentario de cabecera): el doble es
  // duck-typed a propósito, nunca implementa la clase real completa, así
  // que ni siquiera se solapa estructuralmente lo suficiente para un
  // `as` directo — de ahí el `as unknown as`.
  return client as unknown as MockSupabaseClient & SupabaseClient<Database>;
}
