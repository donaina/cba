'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Building2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
  branchType: z.enum(['HEAD_OFFICE', 'BRANCH', 'AGENCY']).default('BRANCH'),
});
type Form = z.infer<typeof schema>;

export default function BranchesPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'branches'],
    queryFn: () => apiClient.get('/admin/branches').then(r => r.data),
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { branchType: 'BRANCH' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/admin/branches', dto).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'branches'] }); toast.success('Branch created'); reset(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const branches = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Branches</h2>
          <p className="text-sm text-muted-foreground">{branches.length} branch{branches.length !== 1 ? 'es' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add Branch</Button>
          </DialogTrigger>
          <DialogContent title="Create Branch">
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
              <FormField label="Branch Name" error={errors.name?.message} required>
                <Input placeholder="Lagos Island Branch" {...register('name')} />
              </FormField>
              <FormField label="Branch Code" error={errors.code?.message} required>
                <Input placeholder="LGS001" {...register('code')} />
              </FormField>
              <FormField label="Address">
                <Input placeholder="1 Marina Road, Lagos" {...register('address')} />
              </FormField>
              <FormField label="Branch Type" required>
                <Select value={watch('branchType')} onValueChange={v => setValue('branchType', v as any)}>
                  <SelectItem value="HEAD_OFFICE">Head Office</SelectItem>
                  <SelectItem value="BRANCH">Branch</SelectItem>
                  <SelectItem value="AGENCY">Agency</SelectItem>
                </Select>
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Branch'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : branches.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Building2 className="h-8 w-8" /><p className="text-sm">No branches yet.</p>
        </div>
      ) : (
        <Table>
          <Thead><Tr><Th>Name</Th><Th>Code</Th><Th>Type</Th><Th>Address</Th></Tr></Thead>
          <Tbody>
            {branches.map((b: any) => (
              <Tr key={b.id}>
                <Td className="font-medium">{b.name}</Td>
                <Td><span className="font-mono text-xs">{b.code}</span></Td>
                <Td><Badge variant={b.branchType === 'HEAD_OFFICE' ? 'default' : 'secondary'}>{b.branchType?.replace('_', ' ')}</Badge></Td>
                <Td className="text-muted-foreground">{b.address ?? '—'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
