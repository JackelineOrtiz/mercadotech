"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as cartService from "@/services/cart.service";
import * as orderService from "@/services/order.service";
import type { CartItem } from "@/types/cart";

// Bug real encontrado en la Fase 6.5 (E2E del comprador): antes de este
// cambio, useCart era un hook "de instancia" — cada llamada (ShopLayout
// para el contador del Navbar, /producto/[id] para addToCart, /carrito
// para la lista) creaba su PROPIO useState independiente. A diferencia de
// useAuth (que "parece" compartir estado entre instancias porque
// @supabase/ssr memoiza un único cliente y todas las instancias escuchan
// el mismo onAuthStateChange global), cart_items no tiene ningún stream de
// eventos equivalente — nada avisaba a la instancia del Navbar que otra
// instancia acababa de agregar un ítem. Resultado observable: el contador
// del carrito nunca se actualizaba al agregar desde la ficha de producto
// (confirmado por e2e/tests/buyer-flow.spec.ts, paso 4). Fix: una única
// instancia real vive en <CartProvider>, y useCart() ahora LEE ese
// contexto en vez de crear una nueva — mismo objeto para todo (shop)/.

function useCartState(userId?: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    cartService
      .getItems(userId)
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const add = useCallback(
    async (productId: string, quantity: number) => {
      if (!userId) return;
      await cartService.addItem(userId, productId, quantity);
      await fetchItems();
    },
    [userId, fetchItems],
  );

  const update = useCallback(
    async (cartItemId: string, quantity: number) => {
      await cartService.updateQuantity(cartItemId, quantity);
      await fetchItems();
    },
    [fetchItems],
  );

  const remove = useCallback(
    async (cartItemId: string) => {
      await cartService.removeItem(cartItemId);
      await fetchItems();
    },
    [fetchItems],
  );

  // Éxito: el RPC ya vació el carrito, fetchItems solo refresca el estado
  // local. Error: el stock pudo cambiar (por eso falló, o por una compra
  // concurrente) — se recarga igual para que la UI muestre los datos reales,
  // no lo que el comprador tenía antes de intentar.
  const checkout = useCallback(async () => {
    if (!userId) throw new Error("Debes iniciar sesión.");
    try {
      const orderId = await orderService.checkout(userId);
      await fetchItems();
      return orderId;
    } catch (err) {
      await fetchItems();
      throw err;
    }
  }, [userId, fetchItems]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.product ? item.product.price * item.quantity : 0),
        0,
      ),
    [items],
  );

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return {
    items,
    subtotal,
    count,
    loading,
    error,
    add,
    update,
    remove,
    checkout,
    retry: fetchItems,
  };
}

type CartContextValue = ReturnType<typeof useCartState>;

const CartContext = createContext<CartContextValue | null>(null);

// Una sola instancia real por sesión de (shop) — se monta en ShopLayout,
// envolviendo tanto el Navbar (contador) como {children} (páginas que
// agregan/editan/pagan). userId cambia en login/logout (useAuth ya lo
// resuelve); useCartState reacciona igual que antes.
export function CartProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const cart = useCartState(userId);
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe usarse dentro de <CartProvider> (ver app/(shop)/layout.tsx).");
  }
  return context;
}
