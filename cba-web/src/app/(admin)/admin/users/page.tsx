'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, UserCog, X, UserCheck, UserX } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  isActive: boolean;
}

interface UserRole {
  role: Role;
}

interface BranchAccess {
  branch: Branch;
}

interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  userRoles: UserRole[];
  branchAccess: BranchAccess[];
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  phone: z.string().optional(),
  branchId: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const assignSchema = z.object({ roleId: z.string().min(1, 'Select a role') });
type AssignForm = z.infer<typeof assignSchema>;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StaffUsersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<StaffUser | null>(null);

  const { data: users = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ['auth', 'users'],
    queryFn: () => apiClient.get('/auth/users').then(r => r.data),
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['auth', 'roles'],
    queryFn: () => apiClient.get('/auth/roles').then(r => r.data),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['admin', 'branches'],
    queryFn: () => apiClient.get('/admin/branches').then(r => r.data),
  });

  // ── Create form ────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const createMutation = useMutation({
    mutationFn: (dto: CreateForm) => apiClient.post('/auth/users', {
      ...dto,
      branchId: dto.branchId || undefined,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'users'] });
      toast.success('Staff user created. They must change their password on first login.');
      reset();
      setCreateOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  // ── Assign role form ───────────────────────────────────────────────────────

  const {
    setValue: setAssignValue,
    watch: watchAssign,
    reset: resetAssign,
    formState: { errors: assignErrors },
  } = useForm<AssignForm>({ resolver: zodResolver(assignSchema) });

  const assignMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      apiClient.post(`/auth/users/${userId}/roles`, { roleId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'users'] });
      toast.success('Role assigned');
      resetAssign();
      setAssignTarget(null);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      apiClient.delete(`/auth/users/${userId}/roles/${roleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'users'] });
      toast.success('Role removed');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/auth/users/${id}`, { isActive }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'users'] });
      toast.success('User status updated');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const selectedBranchId = watch('branchId');
  const selectedRoleId = watchAssign('roleId');

  const activeRoles = roles.filter(r => r.isActive);

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage bank staff accounts and role assignments</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Branch</Th>
                <Th>Roles</Th>
                <Th>Last login</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.length === 0 && (
                <Tr>
                  <Td colSpan={7} className="text-center text-muted-foreground py-8">
                    No staff users yet.
                  </Td>
                </Tr>
              )}
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm">{u.firstName} {u.lastName}</span>
                    </div>
                  </Td>
                  <Td className="text-sm text-muted-foreground">{u.email}</Td>
                  <Td className="text-sm text-muted-foreground">
                    {u.branchAccess[0]?.branch.name ?? '—'}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.userRoles.length === 0 && (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      )}
                      {u.userRoles.map(ur => (
                        <span
                          key={ur.role.id}
                          className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                        >
                          {ur.role.name}
                          <button
                            onClick={() => removeRoleMutation.mutate({ userId: u.id, roleId: ur.role.id })}
                            className="hover:text-destructive transition-colors"
                            title="Remove role"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <button
                        onClick={() => { setAssignTarget(u); resetAssign(); }}
                        className="text-xs text-muted-foreground border border-dashed border-border px-2 py-0.5 rounded-full hover:border-primary hover:text-primary transition-colors"
                      >
                        + Role
                      </button>
                    </div>
                  </Td>
                  <Td className="text-sm text-muted-foreground">{formatDate(u.lastLoginAt)}</Td>
                  <Td>
                    <Badge variant={u.isActive ? 'success' : 'secondary'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                      className={`p-1.5 rounded hover:bg-muted transition-colors ${u.isActive ? 'text-destructive' : 'text-primary'}`}
                      title={u.isActive ? 'Deactivate user' : 'Activate user'}
                    >
                      {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-4">Create Staff User</h2>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" error={errors.firstName?.message}>
                <Input placeholder="John" {...register('firstName')} />
              </FormField>
              <FormField label="Last name" error={errors.lastName?.message}>
                <Input placeholder="Doe" {...register('lastName')} />
              </FormField>
            </div>
            <FormField label="Email address" error={errors.email?.message}>
              <Input type="email" placeholder="john@bank.ng" {...register('email')} />
            </FormField>
            <FormField
              label="Temporary password"
              error={errors.password?.message}
              tooltip="User must change this password on first login"
            >
              <Input type="password" placeholder="Min. 8 characters" {...register('password')} />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <Input placeholder="08012345678" {...register('phone')} />
            </FormField>
            <FormField label="Branch" error={errors.branchId?.message}>
              <Select
                value={selectedBranchId ?? ''}
                onValueChange={v => setValue('branchId', v)}
                placeholder="Select branch (optional)"
              >
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </Select>
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign role dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => { if (!o) setAssignTarget(null); }}>
        <DialogContent className="max-w-sm">
          <h2 className="text-lg font-semibold text-foreground mb-1">Assign Role</h2>
          {assignTarget && (
            <p className="text-sm text-muted-foreground mb-4">
              Assigning to <strong>{assignTarget.firstName} {assignTarget.lastName}</strong>
            </p>
          )}
          <div className="space-y-4">
            <FormField label="Role" error={assignErrors.roleId?.message}>
              <Select
                value={selectedRoleId ?? ''}
                onValueChange={v => setAssignValue('roleId', v)}
                placeholder="Select a role"
              >
                {activeRoles
                  .filter(r => !assignTarget?.userRoles.some(ur => ur.role.id === r.id))
                  .map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
              </Select>
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!selectedRoleId || !assignTarget) return;
                  assignMutation.mutate({ userId: assignTarget.id, roleId: selectedRoleId });
                }}
                disabled={!selectedRoleId || assignMutation.isPending}
              >
                {assignMutation.isPending ? 'Assigning…' : 'Assign Role'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
