export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  // null si el producto está inactivo — RLS oculta la fila embebida
  // (products_select_active_or_own no deja pasar inactivos ajenos) y
  // PostgREST responde con products=null en vez de excluir la fila del
  // carrito. La UI lo muestra como "ya no disponible".
  product: {
    id: string;
    title: string;
    price: number;
    stock: number;
    imageUrl: string | null;
  } | null;
}
