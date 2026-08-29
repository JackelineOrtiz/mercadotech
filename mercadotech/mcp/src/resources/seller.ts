import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext } from "../context.js";
import { resourceJson, resourceError, safeRead, safeList } from "../lib/resource-result.js";
import { getSellerProfile } from "../shared/sellers.js";

// Cliente: admin (decisión 5) — profiles no tiene SELECT público (RLS de
// la Fase 2.3); SOLO se expone display_name + productos activos, JAMÁS
// phone, email ni rol (ver shared/sellers.ts, que hace un select() plano
// a propósito).
export function registerSeller(server: McpServer): void {
  const template = new ResourceTemplate("mercadotech://sellers/{sellerId}", {
    // list: enumera los perfiles con rol 'seller' que tienen al menos un
    // producto activo — un vendedor sin catálogo visible no aporta nada
    // como instancia navegable.
    list: safeList(async () => {
      const { admin } = createContext();
      const { data, error } = await admin
        .from("profiles")
        .select("id, display_name")
        .eq("role", "seller");
      if (error) throw error;

      const withActiveProducts = await Promise.all(
        data.map(async (seller) => {
          const profile = await getSellerProfile(seller.id, admin);
          return profile && profile.products.length > 0
            ? { id: seller.id, displayName: profile.displayName }
            : null;
        }),
      );

      return {
        resources: withActiveProducts
          .filter((s): s is { id: string; displayName: string | null } => s !== null)
          .map((s) => ({
            uri: `mercadotech://sellers/${s.id}`,
            name: s.displayName ?? "Vendedor",
            mimeType: "application/json",
          })),
      };
    }),
  });

  server.registerResource(
    "seller",
    template,
    {
      title: "Perfil público de un vendedor",
      description: "Nombre público y productos activos de un vendedor — nunca datos de contacto.",
      mimeType: "application/json",
    },
    safeRead(async (uri, variables) => {
      const sellerId = String(variables.sellerId);
      const { admin } = createContext();
      const profile = await getSellerProfile(sellerId, admin);
      if (!profile) return resourceError(uri.href, `No se encontró: vendedor ${sellerId}`);
      return resourceJson(uri.href, profile);
    }),
  );
}
