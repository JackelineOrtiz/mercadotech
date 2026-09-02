import { useState } from "react";
import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHODS, PAYMENT_METHOD_DEFAULT } from "@/lib/constants/payment";
import { cn } from "@/lib/utils";

export interface CartSummaryProps {
  subtotal: number;
  loading?: boolean;
  onCheckout: () => void;
}

// Checkout simulado para el laboratorio: no se pide ni se guarda ningún
// dato de tarjeta, no hay pasarela de pago real detrás de este botón.
//
// Hallazgo real (Fase 7.5): la FAQ de soporte ya prometía tarjeta/cuotas/
// contra entrega, pero acá nunca se mostraba ninguna opción — un usuario
// probando la app le preguntó al asistente y, al ir a pagar de verdad, no
// vio nada de lo que el asistente había mencionado. Selección puramente
// visual (estado local, con "tarjeta" preseleccionado para no romper el
// flujo de un clic que ya existía) — nunca se envía a onCheckout ni al
// service, el pedido se sigue creando exactamente igual que siempre.
export function CartSummary({ subtotal, loading = false, onCheckout }: CartSummaryProps) {
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD_DEFAULT);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <Price value={subtotal} size="lg" testId="cart-subtotal" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Método de pago</legend>
        {PAYMENT_METHODS.map((method) => (
          <Label
            key={method.value}
            htmlFor={`payment-method-${method.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-sm font-normal",
              paymentMethod === method.value && "border-primary bg-primary/5",
            )}
          >
            <input
              type="radio"
              id={`payment-method-${method.value}`}
              data-testid={`payment-method-${method.value}`}
              name="payment-method"
              value={method.value}
              checked={paymentMethod === method.value}
              onChange={() => setPaymentMethod(method.value)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{method.label}</span>
              <span className="text-xs text-muted-foreground">{method.description}</span>
            </span>
          </Label>
        ))}
      </fieldset>

      <p className="text-xs text-muted-foreground">
        Pago simulado para el laboratorio — no se realiza ningún cobro.
      </p>
      <Button data-testid="cart-checkout" onClick={onCheckout} disabled={loading}>
        {loading ? "Procesando…" : "Finalizar compra"}
      </Button>
    </div>
  );
}
