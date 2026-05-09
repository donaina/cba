'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, CreditCard, Pencil, Layers } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const RATE_TYPE_LABELS: Record<string, string> = {
  FLAT_RATE: 'Flat Rate',
  REDUCING_BALANCE: 'Reducing Balance',
  FIXED: 'Fixed',
  VARIABLE: 'Variable',
};

const TYPE_LABELS: Record<string, string> = {
  SAVINGS: 'Savings',
  CURRENT: 'Current',
  FIXED_DEPOSIT: 'Fixed Deposit',
  LOAN: 'Loan',
};

const productSchema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required'),
  productType: z.enum(['SAVINGS', 'CURRENT', 'FIXED_DEPOSIT', 'LOAN']),
  description: z.string().optional(),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  interestRateType: z.enum(['FLAT_RATE', 'REDUCING_BALANCE', 'FIXED', 'VARIABLE']).optional(),
  minBalance: z.coerce.number().min(0).optional(),
  maxBalance: z.coerce.number().min(0).optional(),
  minTenorDays: z.coerce.number().int().positive().optional(),
  maxTenorDays: z.coerce.number().int().positive().optional(),
});
type ProductForm = z.infer<typeof productSchema>;

const rateBandSchema = z.object({
  minAmount: z.coerce.number().min(0, 'Required'),
  maxAmount: z.coerce.number().min(0, 'Required'),
  rate: z.coerce.number().min(0).max(100, 'Max 100%'),
});
type RateBandForm = z.infer<typeof rateBandSchema>;

function toDecimalRate(pct: number | undefined) {
  return pct !== undefined ? pct / 100 : undefined;
}

function ProductFormFields({ register, errors, watch, setValue, isEdit = false }: {
  register: any; errors: any; watch: any; setValue: any; isEdit?: boolean;
}) {
  const productType = watch('productType');
  const isLoan = productType === 'LOAN';
  const isTenor = productType === 'FIXED_DEPOSIT' || productType === 'LOAN';
  const interestRateType = watch('interestRateType') ?? 'FLAT_RATE';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Name" error={errors.name?.message} required>
          <Input placeholder="Regular Savings" {...register('name')} />
        </FormField>
        <FormField label="Code" error={errors.code?.message} required>
          <Input placeholder="REG_SAV" {...register('code')} />
        </FormField>
      </div>
      {!isEdit && (
        <FormField label="Product Type" required>
          <Select value={productType} onValueChange={v => setValue('productType', v as any)}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </Select>
        </FormField>
      )}
      <FormField label="Description">
        <Input placeholder="Optional description" {...register('description')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Interest Rate (%)" error={errors.interestRate?.message}>
          <div className="relative">
            <Input type="number" step="0.01" min="0" max="100" placeholder="5" {...register('interestRate')} className="pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </FormField>
        {isLoan && (
          <FormField label="Rate Calculation Method">
            <Select value={interestRateType} onValueChange={v => setValue('interestRateType', v as any)}>
              {Object.entries(RATE_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </Select>
          </FormField>
        )}
        {!isLoan && (
          <FormField label={isLoan ? 'Min Amount (₦)' : 'Min Balance (₦)'} error={errors.minBalance?.message}>
            <Input type="number" placeholder="0" {...register('minBalance')} />
          </FormField>
        )}
      </div>
      {isLoan && (
        <FormField label="Min Loan Amount (₦)" error={errors.minBalance?.message}>
          <Input type="number" placeholder="50000" {...register('minBalance')} />
        </FormField>
      )}
      {isTenor && (
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Min Tenor (days)" error={errors.minTenorDays?.message}>
            <Input type="number" placeholder="30" {...register('minTenorDays')} />
          </FormField>
          <FormField label="Max Tenor (days)" error={errors.maxTenorDays?.message}>
            <Input type="number" placeholder="365" {...register('maxTenorDays')} />
          </FormField>
        </div>
      )}
    </div>
  );
}

function RateBandsDialog({ product }: { product: any }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: bands, isLoading } = useQuery({
    queryKey: ['admin', 'products', product.id, 'rate-bands'],
    queryFn: () => apiClient.get(`/admin/products/${product.id}/rate-bands`).then(r => r.data),
    enabled: open,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RateBandForm>({
    resolver: zodResolver(rateBandSchema),
  });

  const addBand = useMutation({
    mutationFn: (dto: RateBandForm) => apiClient.post(`/admin/products/${product.id}/rate-bands`, {
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      rate: dto.rate / 100,
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products', product.id, 'rate-bands'] });
      toast.success('Rate band added');
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Manage rate bands">
          <Layers className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent title={`Rate Bands — ${product.name}`} className="max-w-xl">
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Set different interest rates for different deposit amount ranges. Bands are matched by the account balance at interest calculation time.
          </p>

          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (bands ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No rate bands yet.</p>
          ) : (
            <Table>
              <Thead><Tr><Th>Min Amount (₦)</Th><Th>Max Amount (₦)</Th><Th>Rate</Th></Tr></Thead>
              <Tbody>
                {(bands ?? []).map((b: any) => (
                  <Tr key={b.id}>
                    <Td>₦{Number(b.minAmount).toLocaleString()}</Td>
                    <Td>₦{Number(b.maxAmount).toLocaleString()}</Td>
                    <Td className="font-medium">{(Number(b.rate) * 100).toFixed(2)}%</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-3">Add Rate Band</p>
            <form onSubmit={handleSubmit(d => addBand.mutate(d))} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Min Amount (₦)" error={errors.minAmount?.message} required>
                  <Input type="number" placeholder="1000000" {...register('minAmount')} />
                </FormField>
                <FormField label="Max Amount (₦)" error={errors.maxAmount?.message} required>
                  <Input type="number" placeholder="5000000" {...register('maxAmount')} />
                </FormField>
                <FormField label="Rate (%)" error={errors.rate?.message} required>
                  <div className="relative">
                    <Input type="number" step="0.01" placeholder="5" {...register('rate')} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </FormField>
              </div>
              <Button type="submit" size="sm" disabled={addBand.isPending} className="w-full">
                {addBand.isPending ? 'Adding…' : 'Add Band'}
              </Button>
            </form>
          </div>

          <div className="flex justify-end">
            <DialogClose asChild><Button variant="outline" size="sm">Close</Button></DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => apiClient.get('/admin/products').then(r => r.data),
  });

  const createForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { productType: 'SAVINGS', interestRateType: 'FLAT_RATE' },
  });

  const editForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  const create = useMutation({
    mutationFn: (dto: ProductForm) => apiClient.post('/admin/products', {
      ...dto,
      interestRate: toDecimalRate(dto.interestRate),
    }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Product created');
      createForm.reset();
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ProductForm }) =>
      apiClient.patch(`/admin/products/${id}`, {
        ...dto,
        interestRate: toDecimalRate(dto.interestRate),
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Product updated');
      setEditProduct(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(p: any) {
    setEditProduct(p);
    editForm.reset({
      name: p.name,
      code: p.code,
      productType: p.productType,
      description: p.description ?? '',
      interestRate: p.interestRate != null ? Number(p.interestRate) * 100 : undefined,
      interestRateType: p.interestRateType ?? 'FLAT_RATE',
      minBalance: p.minBalance != null ? Number(p.minBalance) : undefined,
      maxBalance: p.maxBalance != null ? Number(p.maxBalance) : undefined,
      minTenorDays: p.minTenorDays ?? undefined,
      maxTenorDays: p.maxTenorDays ?? undefined,
    });
  }

  const products = data ?? [];
  const isFdOrLoan = (type: string) => type === 'FIXED_DEPOSIT' || type === 'LOAN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add Product</Button>
          </DialogTrigger>
          <DialogContent title="Create Product" className="max-w-xl">
            <form onSubmit={createForm.handleSubmit(d => create.mutate(d))} className="space-y-4">
              <ProductFormFields
                register={createForm.register}
                errors={createForm.formState.errors}
                watch={createForm.watch}
                setValue={createForm.setValue}
              />
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create Product'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editProduct} onOpenChange={open => { if (!open) setEditProduct(null); }}>
        <DialogContent title="Edit Product" className="max-w-xl">
          <form onSubmit={editForm.handleSubmit(d => update.mutate({ id: editProduct.id, dto: d }))} className="space-y-4">
            <ProductFormFields
              register={editForm.register}
              errors={editForm.formState.errors}
              watch={editForm.watch}
              setValue={editForm.setValue}
              isEdit
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditProduct(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <CreditCard className="h-8 w-8" /><p className="text-sm">No products yet.</p>
        </div>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th><Th>Code</Th><Th>Type</Th><Th>Interest Rate</Th><Th>Rate Method</Th><Th>Min Amount</Th><Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {products.map((p: any) => (
              <Tr key={p.id}>
                <Td className="font-medium">{p.name}</Td>
                <Td><span className="font-mono text-xs">{p.code}</span></Td>
                <Td><Badge variant="secondary">{TYPE_LABELS[p.productType] ?? p.productType}</Badge></Td>
                <Td className="font-medium">{p.interestRate != null ? `${(Number(p.interestRate) * 100).toFixed(2)}%` : '—'}</Td>
                <Td className="text-xs text-muted-foreground">
                  {p.productType === 'LOAN' ? (RATE_TYPE_LABELS[p.interestRateType] ?? p.interestRateType ?? '—') : '—'}
                </Td>
                <Td>{p.minBalance != null ? `₦${Number(p.minBalance).toLocaleString()}` : '—'}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    {isFdOrLoan(p.productType) && <RateBandsDialog product={p} />}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Edit product">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
