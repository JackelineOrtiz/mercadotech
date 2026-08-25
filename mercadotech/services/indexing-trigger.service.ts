// Único service que se llama y NO se espera (fire-and-forget): publicar o
// editar un producto nunca debe volverse más lento ni fallar porque
// Hugging Face esté caído o lento — el error se registra con console.warn
// y ahí muere, invisible para el vendedor. Sin cliente Supabase inyectado:
// esto solo hace un fetch al propio Route Handler, que es quien de verdad
// toca la base (con el cliente admin, del lado del servidor).
export function triggerReindex(sourceType: "producto" | "articulo_soporte", sourceId: string): void {
  fetch("/api/v1/reindex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType, sourceId }),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(`Reindexar ${sourceType}/${sourceId} respondió ${res.status}.`);
      }
    })
    .catch((err) => {
      console.warn(`No se pudo reindexar ${sourceType}/${sourceId}:`, err);
    });
}
