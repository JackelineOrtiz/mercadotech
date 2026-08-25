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

export async function updateQuantity(
  cartItemId: string,
  quantity: number,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
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
