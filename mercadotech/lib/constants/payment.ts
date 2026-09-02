// Métodos de pago que la FAQ de soporte ya prometía (ver seed.sql,
// artículos "¿Qué métodos de pago aceptan?" / "¿Puedo pagar contra
// entrega?") pero que el checkout nunca mostraba — hallazgo real de un
// usuario probando la app (Fase 7.5): el asistente los mencionaba, pero
// /carrito no ofrecía elegir ninguno. Decisión explícita del usuario:
// agregar el paso solo como selección VISUAL, sin gateway real detrás —
// CartSummary lo usa únicamente para mostrar/recordar la elección durante
// el flujo, nunca se envía al service ni a la RPC de checkout (mismo
// comportamiento de creación de pedido de siempre, sin cambios).
export type PaymentMethod = "tarjeta" | "cuotas" | "contra_entrega";

export const PAYMENT_METHOD_DEFAULT: PaymentMethod = "tarjeta";

export const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "tarjeta",
    label: "Tarjeta de crédito o débito",
    description: "Visa, Mastercard — procesado mediante una pasarela cifrada.",
  },
  {
    value: "cuotas",
    label: "Pago en cuotas",
    description: "Con tarjetas de crédito participantes, sujeto a tu banco emisor.",
  },
  {
    value: "contra_entrega",
    label: "Pago contra entrega",
    description: "Sujeto a confirmación del vendedor — disponible solo en algunas zonas.",
  },
];
