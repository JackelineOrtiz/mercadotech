import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Price } from "@/components/shared/Price";
import type { OrderItem } from "@/types/order";

export interface OrderItemsTableProps {
  items: OrderItem[];
}

// Muestra title_snapshot/price_snapshot — el histórico del pedido, no el
// estado actual del producto (que puede haber cambiado de precio o de
// título desde entonces).
export function OrderItemsTable({ items }: OrderItemsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Cantidad</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.title_snapshot}</TableCell>
            <TableCell>
              <Price value={item.price_snapshot} size="sm" />
            </TableCell>
            <TableCell>{item.quantity}</TableCell>
            <TableCell className="text-right">
              <Price value={item.price_snapshot * item.quantity} size="sm" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
