-- TICKET_MESSAGES: sender_role distingue si el mensaje lo mandó el usuario,
-- el agente de IA ('agente') o un humano de soporte que tomó el caso
-- ('humano') — esta última opción anticipa escalamiento, no se usa hasta
-- que exista panel de soporte humano.
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_role text not null check (sender_role in ('usuario', 'agente', 'humano')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;

create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);
