// Tunables de la integración con Hugging Face (Sesión 4). Todos los valores
// y sus porqués vienen calibrados de ReadHub, el proyecto anterior del
// curso que ya se golpeó con estas mismas esquinas (ver "Guía Hugging
// Face" en MercadoTech_sesion4.md). Ningún archivo de lib/ai/, services/ ni
// app/api/v1/ debe hardcodear alguno de estos valores fuera de aquí.

// Dimensión del vector que devuelve sentence-transformers/all-MiniLM-L6-v2.
// Queda grabada en la columna `embedding vector(384)` de knowledge_embeddings
// (Fase 4.1) y en la firma de match_knowledge — cambiar de modelo de
// embeddings a uno con otra dimensión exige una migración nueva
// (ALTER COLUMN ... TYPE vector(N) + recrear índice y función), no alcanza
// con cambiar esta constante.
export const EMBEDDING_DIMENSIONS = 384;

export const EMBEDDING_MODEL_DEFAULT = "sentence-transformers/all-MiniLM-L6-v2";

// all-MiniLM-L6-v2 acepta máximo 256 tokens (~1000 caracteres) y trunca lo
// que sobra EN SILENCIO, sin avisar — degrada la búsqueda sin que se note.
// Por eso el texto a vectorizar se arma con las señales más valiosas
// primero (título, marca, categoría) y el contenido largo al final: si algo
// se corta, se corta lo menos importante.
export const MAX_EMBEDDING_INPUT_CHARS = 1000;

// Cuántos resultados trae la búsqueda semántica por defecto y el techo que
// un caller puede pedir — evita que un query mal formado (o abusivo) pida
// "todo" y castigue la cuota gratuita de Hugging Face de un tirón (la
// búsqueda solo gasta cuota en el embedding de la CONSULTA, no en esto,
// pero limita igual el trabajo de match_knowledge).
export const VECTOR_SEARCH_DEFAULT_TOP_K = 5;
export const VECTOR_SEARCH_MAX_TOP_K = 20;

// Similitud mínima para considerar un resultado relevante. PROVISIONAL: se
// calibra con datos reales en la Fase 4.8. Pares de texto NO relacionados
// ya rondan 0.1–0.2 (comparten idioma); los relacionados suelen superar 0.4
// — 0.3 arranca a medio camino entre ambos.
export const VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD = 0.3;

// Cuántas fuentes entran, como máximo, al contexto que arma la Fase 4.5 —
// más que esto satura al modelo de chat sin mejorar la respuesta.
export const CONTEXT_BUILDER_DEFAULT_MAX_SOURCES = 5;

// Umbral de similitud que usa el constructor de contexto para descartar
// fuentes marginales — mismo valor que VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD
// hoy, pero es una constante propia porque búsqueda y contexto son pasos
// distintos (Fase 4.4 vs 4.5) que podrían calibrarse por separado.
export const CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY = 0.3;

// Una ficha con menos de 20 caracteres de contenido no aporta nada al
// contexto (ej. un título suelto sin descripción) — se descarta aunque su
// similitud sea alta.
export const CONTEXT_BUILDER_MIN_CONTENT_LENGTH = 20;

// Presupuesto de caracteres del contexto que se le pasa al modelo de chat.
// HUGGINGFACE_CHAT_MAX_TOKENS limita la RESPUESTA; esto limita la ENTRADA —
// 8000 caracteres (~2000 tokens) deja espacio de sobra para 5 fuentes de
// hasta 1000 caracteres cada una sin acercarse al límite de contexto del
// modelo.
export const CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS = 8000;

// Si a la última fuente que cabría en el presupuesto le quedan menos de
// 200 caracteres disponibles, se descarta ENTERA en vez de incluirla a
// medias — media frase de un producto o artículo confunde al modelo más de
// lo que aporta.
export const CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS = 200;

// meta-llama/Llama-3.1-8B-Instruct: el modelo que SÍ tenía proveedor de
// inferencia gratuito cuando ReadHub probó con token real (zephyr-7b-beta,
// Qwen2.5-7B-Instruct y Mistral-7B-Instruct-v0.3 ya no lo tenían). Si
// también rota, se reemplaza SOLO vía HUGGINGFACE_CHAT_MODEL — cero cambios
// de código (Guía HF, lección 3).
export const HUGGINGFACE_CHAT_MODEL_DEFAULT = "meta-llama/Llama-3.1-8B-Instruct";

// Techo de tokens de la RESPUESTA del modelo de chat — 1024 alcanza para
// una respuesta conversacional completa con varias fuentes citadas, sin
// dejar que una alucinación se extienda indefinidamente.
export const HUGGINGFACE_CHAT_MAX_TOKENS = 1024;

// Límite de longitud de la pregunta que un usuario puede enviar al chat o a
// la búsqueda semántica — 4000 caracteres es mucho más de lo que alguien
// escribe a mano, y evita mandar un texto absurdamente largo (y costoso) a
// generar su embedding o a un system prompt.
export const CHAT_QUERY_MAX_CHARS = 4000;

// Fase 7.5, hallazgo real: el chat no tenía NINGUNA memoria de
// conversación — cada mensaje era una consulta independiente para el
// modelo, aunque la UI mostrara un historial continuo. Ahora el cliente
// reenvía los turnos previos y el servidor los recorta a los últimos N
// (nunca confía en que el cliente mande un historial razonable) — 6
// turnos (3 idas y vueltas) alcanza para resolver referencias típicas
// ("esa laptop", "el anterior") sin inflar el prompt ni el costo de cada
// llamada a Hugging Face con una conversación larga completa.
export const CHAT_HISTORY_MAX_TURNS = 6;
