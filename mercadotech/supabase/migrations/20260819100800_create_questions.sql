-- QUESTIONS: preguntas y respuestas estilo Mercado Libre. answer/answered_at
-- nullable hasta que el vendedor responde.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create index questions_product_id_idx on public.questions (product_id);
