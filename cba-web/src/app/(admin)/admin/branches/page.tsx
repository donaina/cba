'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Building2, Pencil } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
  branchType: z.enum(['HEAD_OFFICE', 'BRANCH', 'AGENCY']).default('BRANCH'),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, 'Required'),
  address: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function BranchesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Branch[]>({
    queryKey: ['admin', 'branches'],
    queryFn: () => apiClient.get('/admin/branches').then(r => r.data),
  });

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { branchType: 'BRANCH' },
  });

  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  const create = useMutation({
    mutationFn: (dto: CreateForm) => apiClient.post('/admin/branches', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
      toast.success('Branch created');
      createForm.reset();
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: EditForm }) =>
      apiClient.patch(`/admin/branches/${id}`, dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
      toast.success('Branch updated');
      setEditBranch(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/admin/branches/${id}`, { isActive }).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
      toast.success(vars.isActive ? 'Branch reopened' : 'Branch closed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(b: any) {
    setEditBranch(b);
    editForm.reset({ name: b.name, address: b.address ?? '' });
  }

  const branches = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Branches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {branches.length} branch{branches.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />Add Branch</Button>
          </DialogTrigger>
          <DialogContent title="Create Branch">
            <form onSubmit={createForm.handleSubmit(d => create.mutate(d))} className="space-y-4">
              <FormField label="Branch Name" error={createForm.formState.errors.name?.message} required>
                <Input placeholder="Lagos Island Branch" {...createForm.register('name')} />
              </FormField>
              <FormField
                label="Branch Code"
                error={createForm.formState.errors.code?.message}
                required
                tooltip="Short unique code used in reports and account prefixes (e.g. LGS001). Cannot be changed after accounts are opened at this branch."
              >
                <Input placeholder="LGS001" {...createForm.register('code')} />
              </FormField>
              <FormField label="Address">
                <Input placeholder="1 Marina Road, Lagos" {...createForm.register('address')} />
              </FormField>
              <FormField
                label="Branch Type"
                required
                tooltip="HEAD OFFICE: the primary branch — only one allowed per tenant. BRANCH: a standard branch. AGENCY: a limited-service agent location."
              >
                <Select value={createForm.watch('branchType')} onValueChange={v => createForm.setValue('branchType', v as any)}>
                  <SelectItem value="HEAD_OFFICE">Head Office</SelectItem>
                  <SelectItem value="BRANCH">Branch</SelectItem>
                  <SelectItem value="AGENCY">Agency</SelectItem>
                </Select>
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create Branch'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editBranch} onOpenChange={open => { if (!open) setEditBranch(null); }}>
        <DialogContent title="Edit Branch">
          <form onSubmit={editForm.handleSubmit(d => update.mutate({ id: editBranch.id, dto: d }))} className="space-y-4">
            <FormField label="Branch Name" error={editForm.formState.errors.name?.message} required>
              <Input {...editForm.register('name')} />
            </FormField>
            <FormField label="Address">
              <Input {...editForm.register('address')} />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditBranch(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : branches.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Building2 className="h-8 w-8" />
          <p className="text-sm">No branches yet. Add one to get started.</p>
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr><Th>Name</Th><Th>Code</Th><Th>Type</Th><Th>Address</Th><Th>Status</Th><Th></Th></Tr>
          </Thead>
          <Tbody>
            {branches.map((b: any) => (
              <Tr key={b.id}>
                <Td className="font-medium">{b.name}</Td>
                <Td><span className="font-mono text-xs">{b.code}</span></Td>
                <Td>
                  <Badge variant={b.branchType === 'HEAD_OFFICE' ? 'default' : 'secondary'}>
                    {b.branchType?.replace('_', ' ')}
                  </Badge>
                </Td>
                <Td className="text-muted-foreground">{b.address ?? '—'}</Td>
                <Td>
                  <Badge variant={b.isActive ? 'success' : 'destructive'}>
                    {b.isActive ? 'Active' : 'Closed'}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)} title="Edit branch">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={b.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-green-600 hover:bg-green-50'}
                      onClick={() => toggleStatus.mutate({ id: b.id, isActive: !b.isActive })}
                      disabled={toggleStatus.isPending}
                    >
                      {b.isActive ? 'Close' : 'Reopen'}
                    </Button>
                  </div>
                </Td>
              </Tr>
            </Thead>
            <Tbody>
              {branches.map(b => (
                <Tr key={b.id}>
                  <Td className="font-medium">{b.name}</Td>
                  <Td><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{b.code}</span></Td>
                  <Td>
                    <Badge variant={b.branchType === 'HEAD_OFFICE' ? 'default' : 'secondary'}>
                      {b.branchType?.replace(/_/g, ' ')}
                    </Badge>
                  </Td>
                  <Td className="text-sm text-muted-foreground">{b.address ?? '—'}</Td>
                  <Td>
                    <Badge variant={b.isActive ? 'success' : 'destructive'}>
                      {b.isActive ? 'Active' : 'Closed'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(b)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit branch"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleStatus.mutate({ id: b.id, isActive: !b.isActive })}
                        disabled={toggleStatus.isPending}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          b.isActive
                            ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
                            : 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white'
                        }`}
                      >
                        {b.isActive ? 'Close' : 'Reopen'}
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
