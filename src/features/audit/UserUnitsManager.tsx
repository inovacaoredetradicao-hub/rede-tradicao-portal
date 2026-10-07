import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getOperationalUsers, getUnitsForUser, getOperationalUnits, setUnitsForUser } from '@/features/operational-alerts/api';
import { OperationalUnitOption, OperationalUserOption } from '@/features/operational-alerts/types';

export const UserUnitsManager: React.FC = () => {
  const [users, setUsers] = useState<OperationalUserOption[]>([]);
  const [units, setUnits] = useState<OperationalUnitOption[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [userList, unitList] = await Promise.all([getOperationalUsers(), getOperationalUnits()]);
        setUsers(userList);
        setUnits(unitList);

        const entries = await Promise.all(
          userList.map(async (user) => {
            const userUnits = await getUnitsForUser(user.id);
            return [user.id, new Set(userUnits.map((unit) => unit.id))] as const;
          }),
        );
        setAssignments(Object.fromEntries(entries));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar os vinculos de filial.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const toggleAssignment = async (userId: string, unitId: string) => {
    const current = assignments[userId] ?? new Set<string>();
    const next = new Set(current);
    if (next.has(unitId)) {
      next.delete(unitId);
    } else {
      next.add(unitId);
    }

    const key = `${userId}:${unitId}`;
    setSavingKey(key);
    try {
      await setUnitsForUser(userId, Array.from(next));
      setAssignments((current2) => ({ ...current2, [userId]: next }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o vinculo.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando usuarios e filiais...</p>;
  }

  return (
    <div className="rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Usuario</TableHead>
            {units.map((unit) => (
              <TableHead key={unit.id} className="text-center">
                {unit.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="pl-4 font-medium text-foreground">{user.name}</TableCell>
              {units.map((unit) => {
                const checked = assignments[user.id]?.has(unit.id) ?? false;
                const key = `${user.id}:${unit.id}`;
                return (
                  <TableCell key={unit.id} className="text-center">
                    <Checkbox
                      checked={checked}
                      disabled={savingKey === key}
                      onCheckedChange={() => void toggleAssignment(user.id, unit.id)}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
