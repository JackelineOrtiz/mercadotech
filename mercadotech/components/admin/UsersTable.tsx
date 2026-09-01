import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { USER_ROLE_LABELS, USER_ROLE_BADGE_VARIANT } from "@/lib/constants/roles";
import type { Profile } from "@/types/user";

export interface UsersTableProps {
  users: Profile[];
}

// Sin email: profiles no la tiene (vive en auth.users, solo alcanzable
// con el cliente admin — fuera de alcance de este panel, ver el
// comentario de cabecera de admin.service.ts). display_name/phone/role/
// fecha de alta son las únicas columnas reales que profiles expone al
// admin vía RLS.
export function UsersTable({ users }: UsersTableProps) {
  return (
    <Table data-testid="admin-users-table">
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead className="text-right">Alta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id} data-testid={`admin-user-row-${user.id}`}>
            <TableCell>{user.display_name ?? "—"}</TableCell>
            <TableCell>{user.phone ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={USER_ROLE_BADGE_VARIANT[user.role]}>
                {USER_ROLE_LABELS[user.role]}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {new Date(user.created_at).toLocaleDateString("es-PE")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
