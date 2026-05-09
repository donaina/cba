'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, CreditCard } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required'),
  productType: z.enum(['SAVINGS', 'CURRENT', 'FIXED_DEPOSIT', 'LOAN']),
  description: z.string().optional(),
  interestRate: z.coerce.number().min(0).optional(),
  minBalance: z.coerce.number().min(0).optional(),
  maxBalance: z.coerce.number().min(0).optional(),
  minTenorDays: z.coerce.number().int().positive().optional(),
  maxTenorDays: z.coerce.number().int().positive().optional(),
});
type Form = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = { SAVINGS: 'Savings', CURRENT: 'Current', FIXED_DEPOSIT: 'Fixed Deposit', LOAN: 'Loan' };

export default function ProductsPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => apiClient.get('/admin/products').then(r => r.data),
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { productType: 'SAVINGS' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/admin/products', dto).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'products'] }); toast.success('Product created'); reset(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const products = data ?? [];
  const productType = watch('productType');
  const isTenorProduct = productType === 'FIXED_DEPOSIT' || productType === 'LOAN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add Product</Button>
          </DialogTrigger>
          <DialogContent title="Create Product" className="max-w-xl">
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Name" error={errors.name?.message} required>
                  <Input placeholder="Regular Savings" {...register('name')} />
                </FormField>
                <FormField label="Code" error={errors.code?.message} required>
                  <Input placeholder="REG_SAV" {...register('code')} />
                </FormField>
              </div>
              <FormField label="Product Type" required>
                <Select value={productType} onValueChange={v => setValue('productType', v as any)}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </Select>
              </FormField>
              <FormField label="Description">
                <Input placeholder="Optional description" {...register('description')} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Interest Rate (e.g. 0.04 = 4%)" error={errors.interestRate?.message}>
                  <Input type="number" step="0.001" placeholder="0.04" {...register('interestRate')} />
                </FormField>
                <FormField label="Min Balance (₦)" error={errors.minBalance?.message}>
                  <Input type="number" placeholder="0" {...register('minBalance')} />
                </FormField>
              </div>
              {isTenorProduct && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Min Tenor (days)" error={errors.minTenorDays?.message}>
                    <Input type="number" placeholder="30" {...register('minTenorDays')} />
                  </FormField>
                  <FormField label="Max Tenor (days)" error={errors.maxTenorDays?.message}>
                    <Input type="number" placeholder="365" {...register('maxTenorDays')} />
                  </FormField>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Product'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <CreditCard className="h-8 w-8" /><p className="text-sm">No products yet.</p>
        </div>
      ) : (
        <Table>
          <Thead><Tr><Th>Name</Th><Th>Code</Th><Th>Type</Th><Th>Interest Rate</Th><Th>Min Balance</Th></Tr></Thead>
          <Tbody>
            {products.map((p: any) => (
              <Tr key={p.id}>
                <Td className="font-medium">{p.name}</Td>
                <Td><span className="font-mono text-xs">{p.code}</span></Td>
                <Td><Badge variant="secondary">{TYPE_LABELS[p.productType] ?? p.productType}</Badge></Td>
                <Td>{p.interestRate != null ? `${(p.interestRate * 100).toFixed(2)}%` : '—'}</Td>
                <Td>{p.minBalance != null ? `₦${Number(p.minBalance).toLocaleString()}` : '—'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
