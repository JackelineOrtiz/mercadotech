-- pgvector: agrega el tipo `vector` y los operadores de distancia/similitud
-- que usan la tabla y la función de esta sesión. En `extensions`, no en
-- `public` — mismo patrón que pgcrypto (Fase 2.1): mantiene el esquema
-- `public` libre de objetos de extensión. `extra_search_path` en
-- config.toml ya incluye "extensions", así que el tipo queda visible sin
-- calificar el esquema en el resto de las migraciones.
create extension if not exists "vector" with schema extensions;
