import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_ROLE_BADGE_VARIANT,
  type UserRole,
} from "@/lib/constants/roles";
import type { Profile } from "@/types/user";

export interface UsersTableProps {
  users: Profile[];
  // Ambos opcionales: sin onChangeRole, la tabla queda de solo lectura
  // (mismo componente sirve para un futuro uso sin ese permiso, sin
  // necesitar una prop booleana aparte).
  currentUserId?: string;
  onChangeRole?: (userId: string, role: UserRole) => void;
}

// Sin email: profiles no la tiene (vive en auth.users, solo alcanzable
// con el cliente admin — fuera de alcance de este panel, ver el
// comentario de cabecera de admin.service.ts). display_name/phone/role/
// fecha de alta son las únicas columnas reales que profiles expone al
// admin vía RLS.
export function UsersTable({ users, currentUserId, onChangeRole }: UsersTableProps) {
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
              {onChangeRole && user.id !== currentUserId ? (
                <Select
                  value={user.role}
                  onValueChange={(next) => onChangeRole(user.id, next as UserRole)}
                >
                  <SelectTrigger
                    className="w-36"
                    data-testid={`admin-user-role-select-${user.id}`}
                  >
                    {/* Base UI Select.Value no auto-resuelve el label de un
                        SelectItem como Radix — mismo patrón que
                        FiltersPanel (children como función). */}
                    <SelectValue>
                      {(v: UserRole | null) => (v ? USER_ROLE_LABELS[v] : "")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {USER_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={USER_ROLE_BADGE_VARIANT[user.role]}>
                  {USER_ROLE_LABELS[user.role]}
                </Badge>
              )}
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
