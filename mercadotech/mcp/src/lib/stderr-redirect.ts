// Se importa como el PRIMER import de index.ts, y este archivo mismo no
// importa nada. Motivo: en ESM, los `import` de un módulo se ejecutan en
// el orden en que aparecen, ANTES que cualquier statement propio de ese
// módulo — así que poner esta reasignación como la primera LÍNEA DE CÓDIGO
// de index.ts no alcanza si arriba hay imports (esos módulos se evalúan
// primero, sin importar el orden textual de statements que no son import).
// Un módulo sin dependencias propias garantiza que la redirección corre
// antes que el código de la SDK, de zod, o de cualquier service/lib/ai/
// que index.ts importe después.
//
// stdout transporta JSON-RPC (transporte stdio, lección 3 de la Guía de
// MercadoTech_sesion5.md): un solo console.log/info/warn en cualquier
// punto del proceso corrompe la sesión. Se redirigen a stderr —
// console.error no toca stdout.
console.log = console.info = console.warn = (...args: unknown[]) => {
  console.error(...args);
};
