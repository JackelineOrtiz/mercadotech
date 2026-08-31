import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CartItem } from "@/types/cart";
import { getPublicUrl } from "@/services/storage.service";

type Client = SupabaseClient<Database>;

type CartItemQueryRow = {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    id: string;
    title: string;
    price: number;
    stock: number;
    product_images: { image_path: string; position: number }[];
  } | null;
};

const CART_SELECT =
  "id, product_id, quantity, products(id, title, price, stock, product_images(image_path, position))";

// comportamiento actual, revisar (hallazgo de la Fase 6.3, ver
// cart.service.test.ts): a diferencia de mapProduct en product.service.ts,
// esta función NO recibe ni propaga el cliente Supabase inyectado a
// getPublicUrl — cada imageUrl se resuelve con un cliente de navegador
// nuevo por defecto (createClient() sin argumentos), nunca con el que
// recibió getItems. Funciona hoy porque getItems solo se llama desde el
// navegador (el hook del carrito); si algún día se llama desde un Route
// Handler o script con el cliente admin, revienta igual que el bug ya
// corregido en product.service.ts (Fase 4.7: "Node.js detected but native
// WebSocket not found") — confirmado empíricamente en el test.
function mapCartItem(row: CartItemQueryRow): CartItem {
  if (!row.products) {
    return { id: row.id, productId: row.product_id, quantity: row.quantity, product: null };
  }
  const cover = [...row.products.product_images].sort((a, b) => a.position - b.position)[0];
  return {
    id: row.id,
    productId: row.product_id,
    quantity: row.quantity,
    product: {
      id: row.products.id,
      title: row.products.title,
      price: Number(row.products.price),
      stock: row.products.stock,
      imageUrl: cover ? getPublicUrl("product-images", cover.image_path) : null,
    },
  };
}

// Precio y stock ACTUALES de products, no un snapshot — el snapshot recién
// se fija dentro del RPC de checkout, al momento de comprar.
export async function getItems(
  userId: string,
  supabase: Client = createClient(),
): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(CART_SELECT)
    .eq("user_id", userId)
    .order("created_at")
    .returns<CartItemQueryRow[]>();
  if (error) throw error;
  return data.map(mapCartItem);
}

// unique(user_id, product_id): si ya está en el carrito, SUMA cantidad (no
// reemplaza), limitada al stock actual. El checkout vuelve a validar el
// stock de todos modos (con FOR UPDATE) — este límite es solo para no
// mostrarle al comprador una cantidad que ya sabemos que es inválida.
export async function addItem(
  userId: string,
  productId: string,
  quantity: number,
  supabase: Client = createClient(),
): Promise<void> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();
  if (productError) throw productError;

  const { data: existing, error: existingError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const nextQuantity = Math.min(existing.quantity + quantity, product.stock);
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: nextQuantity })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("cart_items").insert({
    user_id: userId,
    product_id: productId,
    quantity: Math.min(quantity, product.stock),
  });
  if (error) throw error;
}

// Clampea al stock actual, mismo criterio que addItem (Fase 5.6: hallazgo
// del lab de gobernanza — antes de esto era la única de las dos funciones
// que no lo hacía). Hoy es defensa en profundidad, no un fix de un bug
// visible: CartItemRow ya solo ofrece 1..stock en su <select>, así que
// ningún caller real de la UI manda un valor fuera de rango.
export async function updateQuantity(
  cartItemId: string,
  quantity: number,
  supabase: Client = createClient(),
): Promise<void> {
  const { data: item, error: itemError } = await supabase
    .from("cart_items")
    .select("product_id")
    .eq("id", cartItemId)
    .single();
  if (itemError) throw itemError;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock")
    .eq("id", item.product_id)
    .single();
  if (productError) throw productError;

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: Math.min(quantity, product.stock) })
    .eq("id", cartItemId);
  if (error) throw error;
}

export async function removeItem(
  cartItemId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (error) throw error;
}

export async function clear(
  userId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (error) throw error;
}
