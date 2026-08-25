import type { Database } from "@/types/database";
import type { TicketStatus } from "@/lib/constants/roles";

export type Ticket = Database["public"]["Tables"]["support_tickets"]["Row"] & {
  status: TicketStatus;
};
