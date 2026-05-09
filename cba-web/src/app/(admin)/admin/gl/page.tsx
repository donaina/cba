'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Landmark } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const schema = z.object({
  code: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  level: z.enum(['CONTROL', 'SUB_CONTROL', 'DETAIL']),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  description: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const TYPE_VARIANT: Record<string, any> = { ASSET: 'default', LIABILITY: 'secondary', EQUITY: 'outline', INCOME: 'success', EXPENSE: 'destructive' };

export default function GlPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'gl'],
    queryFn: () => apiClient.get('/gl/accounts').then(r => r.data),
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'ASSET', level: 'DETAIL', normalBalance: 'DEBIT' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/gl/accounts', dto).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'gl'] }); toast.success('GL account created'); reset(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const accounts: any[] = (data ?? []).filter((a: any) =>
    !search || a.code.includes(search.toUpperCase()) || a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">GL Accounts</h2>
          <p className="text-sm text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add GL Account</Button>
          </DialogTrigger>
          <DialogContent title="Create GL Account" className="max-w-xl">
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Code" error={errors.code?.message} required>
                  <Input placeholder="SAVINGS_CONTROL" {...register('code')} />
                </FormField>
                <FormField label="Name" error={errors.name?.message} required>
                  <Input placeholder="Savings Control Account" {...register('name')} />
                </FormField>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Type" required>
                  <Select value={watch('type')} onValueChange={v => setValue('type', v as any)}>
                    {['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </Select>
                </FormField>
                <FormField label="Level" required>
                  <Select value={watch('level')} onValueChange={v => setValue('level', v as any)}>
                    <SelectItem value="CONTROL">Control</SelectItem>
                    <SelectItem value="SUB_CONTROL">Sub-Control</SelectItem>
                    <SelectItem value="DETAIL">Detail</SelectItem>
                  </Select>
                </FormField>
                <FormField label="Normal Balance" required>
                  <Select value={watch('normalBalance')} onValueChange={v => setValue('normalBalance', v as any)}>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                  </Select>
                </FormField>
              </div>
              <FormField label="Description">
                <Input placeholder="Optional description" {...register('description')} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Account'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Search by code or name…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Landmark className="h-8 w-8" /><p className="text-sm">No GL accounts found.</p>
        </div>
      ) : (
        <Table>
          <Thead><Tr><Th>Code</Th><Th>Name</Th><Th>Type</Th><Th>Level</Th><Th>Normal Balance</Th></Tr></Thead>
          <Tbody>
            {accounts.map((a: any) => (
              <Tr key={a.id}>
                <Td><span className="font-mono text-xs font-medium">{a.code}</span></Td>
                <Td>{a.name}</Td>
                <Td><Badge variant={TYPE_VARIANT[a.type]}>{a.type}</Badge></Td>
                <Td className="text-muted-foreground text-xs">{a.level}</Td>
                <Td><Badge variant={a.normalBalance === 'DEBIT' ? 'default' : 'secondary'}>{a.normalBalance}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
