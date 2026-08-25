import { InferenceClient } from "@huggingface/inference";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_DEFAULT,
  MAX_EMBEDDING_INPUT_CHARS,
} from "@/lib/constants/ai";

function getToken(): string {
  const token = process.env.HUGGINGFACEHUB_API_TOKEN;
  if (!token) {
    throw new Error("HUGGINGFACEHUB_API_TOKEN no está configurada.");
  }
  return token;
}

// featureExtraction puede devolver un vector plano (un texto) o una matriz
// por token (varios textos, u otro modelo) — se acepta SOLO lo primero y se
// rechaza cualquier otra forma con un error claro, en vez de aplanar/
// promediar en silencio y guardar una ficha corrupta (Guía HF, lección 5).
function isFlatNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === "number");
}

// generateEmbedding: única función del proyecto que llama a
// InferenceClient.featureExtraction — feature-extraction no está disponible
// en el router OpenAI-compatible que usa completion.ts, así que aquí sí se
// justifica el SDK oficial en vez de fetch (Guía HF, lección 1).
export async function generateEmbedding(text: string): Promise<number[]> {
  const token = getToken();
  const model = process.env.HUGGINGFACE_EMBEDDING_MODEL || EMBEDDING_MODEL_DEFAULT;
  const client = new InferenceClient(token);

  let result: unknown;
  try {
    result = await client.featureExtraction({ model, inputs: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/401|unauthorized/i.test(message)) {
      throw new Error(
        "Token de Hugging Face inválido o expirado (401). Revisa HUGGINGFACEHUB_API_TOKEN en .env.local.",
      );
    }
    if (/not supported|no provider/i.test(message)) {
      throw new Error(
        `El modelo de embeddings "${model}" no está disponible en el nivel gratuito de Hugging Face. Prueba otro candidato y actualiza HUGGINGFACE_EMBEDDING_MODEL.`,
      );
    }
    throw new Error(`Hugging Face (embeddings) falló: ${message}`);
  }

  if (!isFlatNumberArray(result)) {
    throw new Error(
      "El modelo de embeddings devolvió una forma inesperada (no es un vector plano de números) — probablemente no es compatible con el formato de MiniLM. Revisa HUGGINGFACE_EMBEDDING_MODEL.",
    );
  }

  if (result.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding con dimensión inesperada: se esperaban ${EMBEDDING_DIMENSIONS}, llegaron ${result.length}.`,
    );
  }

  return result;
}

export interface ProductForEmbedding {
  title: string;
  brand: string | null;
  condition: string;
  description: string | null;
}

export interface CategoryForEmbedding {
  name: string;
}

// Secciones etiquetadas en orden de mayor a menor densidad semántica
// (título/marca/categoría primero, descripción larga al final) y truncado
// a MAX_EMBEDDING_INPUT_CHARS: si el texto excede el límite que MiniLM
// trunca en silencio, lo que se pierde es la cola menos informativa, nunca
// el título (Guía HF, lección 4).
export function buildProductEmbeddingText(
  product: ProductForEmbedding,
  category: CategoryForEmbedding,
): string {
  const sections = [
    `Título: ${product.title}`,
    product.brand ? `Marca: ${product.brand}` : null,
    `Categoría: ${category.name}`,
    `Condición: ${product.condition}`,
    product.description ? `Descripción: ${product.description}` : null,
  ].filter((s): s is string => s !== null);

  return sections.join("\n").slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

export interface SupportArticleForEmbedding {
  title: string;
  category: string | null;
  content: string;
}

export function buildSupportArticleEmbeddingText(article: SupportArticleForEmbedding): string {
  const sections = [
    `Título: ${article.title}`,
    article.category ? `Categoría: ${article.category}` : null,
    `Contenido: ${article.content}`,
  ].filter((s): s is string => s !== null);

  return sections.join("\n").slice(0, MAX_EMBEDDING_INPUT_CHARS);
}
