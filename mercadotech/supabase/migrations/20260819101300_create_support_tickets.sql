-- SUPPORT_TICKETS: usados por el agente de voz de la sesión 8 (channel
-- distingue si el ticket se originó por chat o por voz).
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  subject text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  channel text not null default 'chat' check (channel in ('chat', 'voz')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index support_tickets_user_id_idx on public.support_tickets (user_id);
