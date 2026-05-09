'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, ArrowLeftRight } from 'lucide-react';
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
  category: z.string().min(1, 'Required'),
  flatFee: z.coerce.number().min(0),
  percentageFee: z.coerce.number().min(0),
  minFee: z.coerce.number().min(0),
  maxFee: z.coerce.number().min(0),
  vatApplicable: z.boolean(),
  whtApplicable: z.boolean(),
  requiresApprovalAbove: z.coerce.number().min(0).optional(),
  approvalChannels: z.string(),
});
type Form = z.infer<typeof schema>;

export default function TxnTypesPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'txn-types'],
    queryFn: () => apiClient.get('/admin/transaction-types').then(r => r.data),
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { flatFee: 0, percentageFee: 0, minFee: 0, maxFee: 0, vatApplicable: false, whtApplicable: false, approvalChannels: '' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => {
      const payload = { ...dto, approvalChannels: dto.approvalChannels ? dto.approvalChannels.split(',').map(s => s.trim()) : [] };
      return apiClient.post('/admin/transaction-types', payload).then(r => r.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'txn-types'] }); toast.success('Transaction type created'); reset(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const types = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Transaction Types</h2>
          <p className="text-sm text-muted-foreground">{types.length} type{types.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add Type</Button>
          </DialogTrigger>
          <DialogContent title="Create Transaction Type" className="max-w-xl">
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Code" error={errors.code?.message} required>
                  <Input placeholder="NIP_TRANSFER" {...register('code')} />
                </FormField>
                <FormField label="Name" error={errors.name?.message} required>
                  <Input placeholder="NIP Inter-bank Transfer" {...register('name')} />
                </FormField>
              </div>
              <FormField label="Category" error={errors.category?.message} required>
                <Select value={watch('category') || ''} onValueChange={v => setValue('category', v)}>
                  <SelectItem value="DEPOSIT">Deposit</SelectItem>
                  <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="FEE">Fee</SelectItem>
                  <SelectItem value="INTEREST">Interest</SelectItem>
                </Select>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Flat Fee (₦)" error={errors.flatFee?.message}>
                  <Input type="number" step="0.01" placeholder="10.75" {...register('flatFee')} />
                </FormField>
                <FormField label="Max Fee (₦)" error={errors.maxFee?.message}>
                  <Input type="number" step="0.01" placeholder="0" {...register('maxFee')} />
                </FormField>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" {...register('vatApplicable')} className="rounded" />
                  VAT applicable (7.5%)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" {...register('whtApplicable')} className="rounded" />
                  WHT applicable
                </label>
              </div>
              <FormField label="Approval threshold (₦, leave blank to skip maker-checker)">
                <Input type="number" placeholder="100000" {...register('requiresApprovalAbove')} />
              </FormField>
              <FormField label="Approval channels (comma-separated)">
                <Input placeholder="MOBILE, INTERNET" {...register('approvalChannels')} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : types.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <ArrowLeftRight className="h-8 w-8" /><p className="text-sm">No transaction types yet.</p>
        </div>
      ) : (
        <Table>
          <Thead><Tr><Th>Code</Th><Th>Name</Th><Th>Category</Th><Th>Flat Fee</Th><Th>VAT</Th><Th>WHT</Th></Tr></Thead>
          <Tbody>
            {types.map((t: any) => (
              <Tr key={t.id}>
                <Td><span className="font-mono text-xs">{t.code}</span></Td>
                <Td>{t.name}</Td>
                <Td><Badge variant="secondary">{t.category}</Badge></Td>
                <Td>₦{Number(t.flatFee).toFixed(2)}</Td>
                <Td><Badge variant={t.vatApplicable ? 'success' : 'outline'}>{t.vatApplicable ? 'Yes' : 'No'}</Badge></Td>
                <Td><Badge variant={t.whtApplicable ? 'success' : 'outline'}>{t.whtApplicable ? 'Yes' : 'No'}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
