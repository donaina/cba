'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, ShieldCheck, Pencil } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// ── Permission grouping ───────────────────────────────────────────────────────

const MODULE_ORDER = [
  'user', 'role', 'customer', 'account', 'loan', 'transaction',
  'report', 'document', 'gl', 'admin', 'aml', 'baas', 'audit',
  'notification', 'kyc',
];

function groupPermissions(permissions: Permission[]) {
  const groups: Record<string, Permission[]> = {};
  for (const p of permissions) {
    const module = p.code.split(':')[0];
    if (!groups[module]) groups[module] = [];
    groups[module].push(p);
  }
  const ordered: Array<[string, Permission[]]> = [];
  for (const mod of MODULE_ORDER) {
    if (groups[mod]) ordered.push([mod, groups[mod]]);
  }
  for (const [mod, perms] of Object.entries(groups)) {
    if (!MODULE_ORDER.includes(mod)) ordered.push([mod, perms]);
  }
  return ordered;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Permission {
  id: string;
  code: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { rolePermissions: number; userRoles: number };
}

interface RoleDetail extends Role {
  rolePermissions: Array<{ permission: Permission }>;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  permissionCodes: z.array(z.string()).min(1, 'Select at least one permission'),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  permissionCodes: z.array(z.string()).min(1, 'Select at least one permission'),
});
type EditForm = z.infer<typeof editSchema>;

// ── Permission picker component ───────────────────────────────────────────────

function PermissionPicker({
  permissions,
  selected,
  onChange,
}: {
  permissions: Permission[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const selectedSet = new Set(selected);

  function toggle(code: string) {
    const next = selectedSet.has(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(next);
  }

  function toggleGroup(codes: string[]) {
    const allSelected = codes.every((c) => selectedSet.has(c));
    if (allSelected) {
      onChange(selected.filter((c) => !codes.includes(c)));
    } else {
      const toAdd = codes.filter((c) => !selectedSet.has(c));
      onChange([...selected, ...toAdd]);
    }
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
      {groups.map(([module, perms]) => {
        const codes = perms.map((p) => p.code);
        const allSelected = codes.every((c) => selectedSet.has(c));
        const someSelected = codes.some((c) => selectedSet.has(c));

        return (
          <div key={module} className="border border-border rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(codes)}
              className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted text-sm font-medium text-foreground transition-colors"
            >
              <span className="capitalize">{module}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${allSelected ? 'bg-primary text-primary-foreground' : someSelected ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                {someSelected ? (allSelected ? 'all' : 'some') : 'none'}
              </span>
            </button>
            <div className="divide-y divide-border">
              {perms.map((p) => (
                <label key={p.code} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(p.code)}
                    onChange={() => toggle(p.code)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-input accent-primary"
                  />
                  <div>
                    <p className="text-xs font-mono text-foreground">{p.code}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleDetail | null>(null);

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['auth', 'roles'],
    queryFn: () => apiClient.get('/auth/roles').then(r => r.data),
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ['auth', 'permissions'],
    queryFn: () => apiClient.get('/auth/permissions').then(r => r.data),
  });

  // ── Create form ────────────────────────────────────────────────────────────

  const {
    register: regCreate,
    handleSubmit: handleCreate,
    control: createControl,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { permissionCodes: [] },
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateForm) => apiClient.post('/auth/roles', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'roles'] });
      toast.success('Role created');
      resetCreate();
      setCreateOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  // ── Edit form ──────────────────────────────────────────────────────────────

  const {
    register: regEdit,
    handleSubmit: handleEdit,
    control: editControl,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  function openEdit(role: Role) {
    apiClient.get<RoleDetail>(`/auth/roles/${role.id}`).then(r => {
      const detail = r.data;
      setEditRole(detail);
      resetEdit({
        name: detail.name,
        description: detail.description ?? '',
        permissionCodes: detail.rolePermissions.map(rp => rp.permission.code),
      });
    }).catch((e: ApiError) => toast.error(e.message));
  }

  const updateMutation = useMutation({
    mutationFn: (dto: EditForm) =>
      apiClient.patch(`/auth/roles/${editRole!.id}`, dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'roles'] });
      toast.success('Role updated');
      setEditRole(null);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/auth/roles/${id}`, { isActive }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'roles'] });
      toast.success('Role status updated');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define roles and assign permissions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Role
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
                <Th>Description</Th>
                <Th>Permissions</Th>
                <Th>Users</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {roles.length === 0 && (
                <Tr>
                  <Td colSpan={6} className="text-center text-muted-foreground py-8">
                    No roles yet. Create one to get started.
                  </Td>
                </Tr>
              )}
              {roles.map((role) => (
                <Tr key={role.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm">{role.name}</span>
                    </div>
                  </Td>
                  <Td className="text-sm text-muted-foreground">{role.description ?? '—'}</Td>
                  <Td>
                    <span className="text-sm font-medium">{role._count.rolePermissions}</span>
                    <span className="text-xs text-muted-foreground ml-1">permissions</span>
                  </Td>
                  <Td>
                    <span className="text-sm font-medium">{role._count.userRoles}</span>
                    <span className="text-xs text-muted-foreground ml-1">users</span>
                  </Td>
                  <Td>
                    <Badge variant={role.isActive ? 'success' : 'secondary'}>
                      {role.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(role)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit role"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive.mutate({ id: role.id, isActive: !role.isActive })}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          role.isActive
                            ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
                            : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                        }`}
                      >
                        {role.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <h2 className="text-lg font-semibold text-foreground mb-4">Create Role</h2>
          <form onSubmit={handleCreate(d => createMutation.mutate(d))} className="space-y-4">
            <FormField label="Role name" error={createErrors.name?.message}>
              <Input placeholder="e.g. BRANCH_MANAGER" {...regCreate('name')} />
            </FormField>
            <FormField label="Description" error={createErrors.description?.message}>
              <Input placeholder="Optional description" {...regCreate('description')} />
            </FormField>
            <FormField label="Permissions" error={createErrors.permissionCodes?.message}>
              <Controller
                name="permissionCodes"
                control={createControl}
                render={({ field }) => (
                  <PermissionPicker
                    permissions={permissions}
                    selected={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Role'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRole} onOpenChange={(o) => { if (!o) setEditRole(null); }}>
        <DialogContent className="max-w-2xl">
          <h2 className="text-lg font-semibold text-foreground mb-4">Edit Role</h2>
          <form onSubmit={handleEdit(d => updateMutation.mutate(d))} className="space-y-4">
            <FormField label="Role name" error={editErrors.name?.message}>
              <Input placeholder="e.g. BRANCH_MANAGER" {...regEdit('name')} />
            </FormField>
            <FormField label="Description" error={editErrors.description?.message}>
              <Input placeholder="Optional description" {...regEdit('description')} />
            </FormField>
            <FormField label="Permissions" error={editErrors.permissionCodes?.message}>
              <Controller
                name="permissionCodes"
                control={editControl}
                render={({ field }) => (
                  <PermissionPicker
                    permissions={permissions}
                    selected={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
