"use client";

import Link from "next/link";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import type { Product } from "@/types/product";

export interface ProductsTableProps {
  products: Product[];
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => Promise<void>;
}

function DeleteButton({
  productId,
  onDelete,
}: {
  productId: string;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(productId);
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Eliminar</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este producto?</DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Volver
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Eliminando…" : "Sí, eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsTable({ products, onToggleActive, onDelete }: ProductsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border">
                  <ProductImage src={product.image_url} alt={product.title} />
                </div>
                <span className="font-medium">{product.title}</span>
              </div>
            </TableCell>
            <TableCell>
              <Price value={product.price} size="sm" />
            </TableCell>
            <TableCell>{product.stock}</TableCell>
            <TableCell>
              <Badge variant={product.is_active ? "default" : "secondary"}>
                {product.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/vendedor/productos/${product.id}/editar`}>Editar</Link>}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleActive(product.id, !product.is_active)}
                >
                  {product.is_active ? "Desactivar" : "Activar"}
                </Button>
                <DeleteButton productId={product.id} onDelete={onDelete} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
