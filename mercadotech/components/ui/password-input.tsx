"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Pedido explícito del usuario (Fase 7.5): "el ojito para ver las
// contraseñas mientras se presiona" — literal, mantener presionado
// muestra el texto, soltar lo vuelve a ocultar (no es un toggle que
// queda abierto con un solo click). Mouse Y touch, para que funcione
// igual en mobile — soltar afuera del botón (mouseleave) también oculta,
// para no dejar la contraseña visible si el dedo/mouse se desliza fuera
// mientras sigue "presionado".
export type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? "Ocultar contraseña" : "Mantené presionado para ver la contraseña"}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
        onMouseDown={show}
        onMouseUp={hide}
        onMouseLeave={hide}
        onTouchStart={show}
        onTouchEnd={hide}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
