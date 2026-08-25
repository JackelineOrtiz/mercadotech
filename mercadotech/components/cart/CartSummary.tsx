import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";

export interface CartSummaryProps {
  subtotal: number;
  loading?: boolean;
  onCheckout: () => void;
}

// Checkout simulado para el laboratorio: no se pide ni se guarda ningún
// dato de tarjeta, no hay pasarela de pago real detrás de este botón.
export function CartSummary({ subtotal, loading = false, onCheckout }: CartSummaryProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <Price value={subtotal} size="lg" />
      </div>
      <p className="text-xs text-muted-foreground">
        Pago simulado para el laboratorio — no se realiza ningún cobro.
      </p>
      <Button onClick={onCheckout} disabled={loading}>
        {loading ? "Procesando…" : "Finalizar compra"}
      </Button>
    </div>
  );
}
