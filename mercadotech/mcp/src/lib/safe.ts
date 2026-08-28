import { toErrorMessage } from "./errors.js";

// Wrapper try/catch uniforme (lección 7 de la Guía: ninguna tool/resource
// debe tumbar el servidor ni dejar pasar un stack trace crudo). `onError`
// recibe el mensaje ya traducido con toErrorMessage y arma el resultado
// con la forma que le corresponde a quien llama — para tools, eso es
// `toolError` de tool-result.ts (CallToolResult con isError: true); cada
// resource de la Fase 5.4 arma la suya, porque `resources/list` nunca
// puede caerse completo por un resource individual (lección 7 aplicada a
// resources, distinta forma de retorno que una tool).
export function safe<Args extends unknown[], R>(
  handler: (...args: Args) => Promise<R>,
  onError: (message: string) => R,
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return onError(toErrorMessage(err));
    }
  };
}
