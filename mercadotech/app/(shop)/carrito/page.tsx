"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/hooks/useCart";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";

export default function CarritoPage() {
  const router = useRouter();
  // useCart() lee el CartProvider montado en (shop)/layout.tsx (Fase 6.5) —
  // misma instancia que el Navbar y /producto/[id], ver hooks/useCart.tsx.
  const { items, subtotal, loading, error, update, remove, checkout, retry } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const orderId = await checkout();
      toast.success("Pedido creado.");
      router.push(`/pedidos/${orderId}`);
    } catch (err) {
      // El mensaje ya viene de Postgres nombrando el producto exacto — no
      // se reescribe.
      toast.error((err as Error).message);
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState onRetry={retry} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description="Agrega productos para verlos aquí."
        action={<Button onClick={() => router.push("/")}>Explorar productos</Button>}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="mb-4 text-2xl font-bold">Tu carrito</h1>
        {items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            onQuantityChange={(quantity) => update(item.id, quantity)}
            onRemove={() => remove(item.id)}
          />
        ))}
      </div>
      <div>
        <CartSummary subtotal={subtotal} loading={checkingOut} onCheckout={handleCheckout} />
      </div>
    </div>
  );
}
