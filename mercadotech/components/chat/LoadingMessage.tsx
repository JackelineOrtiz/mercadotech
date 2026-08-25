export function LoadingMessage() {
  return (
    <div className="flex justify-start" aria-live="polite">
      <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Escribiendo…
      </div>
    </div>
  );
}
