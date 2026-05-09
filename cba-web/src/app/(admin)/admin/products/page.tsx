'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, CreditCard, Pencil, Layers, Trash2 } from 'lucide-react';
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

const ACCRUAL_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-annual',
  ANNUAL: 'Annual',
  AT_MATURITY: 'At Maturity',
};

const ACCRUAL_OPTIONS: Record<string, string[]> = {
  SAVINGS:       ['DAILY', 'MONTHLY'],
  CURRENT:       ['DAILY', 'MONTHLY'],
  LOAN:          ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'],
  FIXED_DEPOSIT: ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'AT_MATURITY'],
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
  accrualFrequency: z.enum(['DAILY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'AT_MATURITY']).optional(),
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

const FIELD_TIPS = {
  productCode: 'Short unique identifier used in GL mappings and reports (e.g. REG_SAV, 3MTH_FD). Cannot be changed after first account is opened.',
  productType: 'Determines the account lifecycle, GL control account, and applicable rules. FIXED_DEPOSIT and LOAN types require a tenor.',
  interestRate: 'Annual rate stored as a decimal (e.g. 5% → stored as 0.05). For FD products, rate bands override this default per amount range.',
  interestRateType: 'FLAT RATE: interest charged on original principal throughout. REDUCING BALANCE: charged only on outstanding principal (cheaper). FIXED: rate locked for the full tenor. VARIABLE: floats with CBN MPR.',
  minLoanAmount: 'Minimum amount a customer can borrow on this product. Applications below this amount will be rejected.',
  minBalance: 'Minimum balance the account must maintain. Falling below may trigger a maintenance charge.',
  minTenorDays: 'Shortest allowed tenor (in days) a customer can select when opening an account or applying for a loan on this product.',
  maxTenorDays: 'Longest allowed tenor (in days). Requests beyond this are rejected at the application stage.',
  rateBandMin: 'Lower bound of the deposit/principal range this rate applies to (inclusive).',
  rateBandMax: 'Upper bound of the deposit/principal range this rate applies to (inclusive).',
  rateBandRate: 'Annual interest rate for this amount band, entered as a percentage (e.g. 5 = 5% p.a.).',
  accrualFrequency: 'How often interest is calculated and applied. DAILY = CBN norm for savings/current (rate ÷ 365 × balance each day). MONTHLY = standard for term loans (12 EMI periods/year). AT MATURITY = simple interest paid in one lump sum — common for short-term FDs.',
};

function ProductFormFields({ register, errors, watch, setValue, isEdit = false }: {
  register: any; errors: any; watch: any; setValue: any; isEdit?: boolean;
}) {
  const productType = watch('productType');
  const isLoan = productType === 'LOAN';
  const isTenor = productType === 'FIXED_DEPOSIT' || productType === 'LOAN';
  const interestRateType = watch('interestRateType') ?? 'FLAT_RATE';
  const accrualFrequency = watch('accrualFrequency') ?? (productType === 'SAVINGS' || productType === 'CURRENT' ? 'DAILY' : productType === 'FIXED_DEPOSIT' ? 'AT_MATURITY' : 'MONTHLY');
  const accrualOptions = ACCRUAL_OPTIONS[productType] ?? ['MONTHLY'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Name" error={errors.name?.message} required>
          <Input placeholder="Regular Savings" {...register('name')} />
        </FormField>
        <FormField label="Code" error={errors.code?.message} required tooltip={FIELD_TIPS.productCode}>
          <Input placeholder="REG_SAV" {...register('code')} />
        </FormField>
      </div>
      {!isEdit && (
        <FormField label="Product Type" required tooltip={FIELD_TIPS.productType}>
          <Select value={productType} onValueChange={v => setValue('productType', v as any)}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </Select>
        </FormField>
      )}
      <FormField label="Description">
        <Input placeholder="Optional description" {...register('description')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Interest Rate (%)" error={errors.interestRate?.message} tooltip={FIELD_TIPS.interestRate}>
          <div className="relative">
            <Input type="number" step="0.01" min="0" max="100" placeholder="5" {...register('interestRate')} className="pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </FormField>
        {isLoan ? (
          <FormField label="Rate Calculation Method" tooltip={FIELD_TIPS.interestRateType}>
            <Select value={interestRateType} onValueChange={v => setValue('interestRateType', v as any)}>
              {Object.entries(RATE_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </Select>
          </FormField>
        ) : (
          <FormField label="Min Balance (₦)" error={errors.minBalance?.message} tooltip={FIELD_TIPS.minBalance}>
            <Input type="number" placeholder="0" {...register('minBalance')} />
          </FormField>
        )}
      </div>
      {isLoan && (
        <FormField label="Min Loan Amount (₦)" error={errors.minBalance?.message} tooltip={FIELD_TIPS.minLoanAmount}>
          <Input type="number" placeholder="50000" {...register('minBalance')} />
        </FormField>
      )}
      <FormField label="Interest Accrual Frequency" tooltip={FIELD_TIPS.accrualFrequency}>
        <Select value={accrualFrequency} onValueChange={v => setValue('accrualFrequency', v as any)}>
          {accrualOptions.map(v => <SelectItem key={v} value={v}>{ACCRUAL_LABELS[v]}</SelectItem>)}
        </Select>
      </FormField>
      {isTenor && (
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Min Tenor (days)" error={errors.minTenorDays?.message} tooltip={FIELD_TIPS.minTenorDays}>
            <Input type="number" placeholder="30" {...register('minTenorDays')} />
          </FormField>
          <FormField label="Max Tenor (days)" error={errors.maxTenorDays?.message} tooltip={FIELD_TIPS.maxTenorDays}>
            <Input type="number" placeholder="365" {...register('maxTenorDays')} />
          </FormField>
        </div>
      )}
    </div>
  );
}

function RateBandsDialog({ product }: { product: any }) {
  const [open, setOpen] = useState(false);
  const [editBand, setEditBand] = useState<any | null>(null);
  const qc = useQueryClient();
  const queryKey = ['admin', 'products', product.id, 'rate-bands'];

  const { data: bands, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiClient.get(`/admin/products/${product.id}/rate-bands`).then(r => r.data),
    enabled: open,
  });

  const addForm = useForm<RateBandForm>({ resolver: zodResolver(rateBandSchema) });
  const editForm = useForm<RateBandForm>({ resolver: zodResolver(rateBandSchema) });

  const addBand = useMutation({
    mutationFn: (dto: RateBandForm) => apiClient.post(`/admin/products/${product.id}/rate-bands`, {
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      rate: dto.rate / 100,
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Rate band added'); addForm.reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateBand = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RateBandForm }) =>
      apiClient.patch(`/admin/products/${product.id}/rate-bands/${id}`, {
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        rate: dto.rate / 100,
      }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Rate band updated'); setEditBand(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBand = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/products/${product.id}/rate-bands/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Rate band deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(b: any) {
    setEditBand(b);
    editForm.reset({
      minAmount: Number(b.minAmount),
      maxAmount: Number(b.maxAmount),
      rate: Number(b.rate) * 100,
    });
  }

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
            Different interest rates for different deposit/loan amount ranges. Bands are matched at interest calculation time. Amounts are in ₦.
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (bands ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No rate bands configured.</p>
          ) : (
            <Table>
              <Thead>
                <Tr><Th>Min Amount (₦)</Th><Th>Max Amount (₦)</Th><Th>Rate</Th><Th></Th></Tr>
              </Thead>
              <Tbody>
                {(bands ?? []).map((b: any) => (
                  <Tr key={b.id}>
                    <Td>₦{Number(b.minAmount).toLocaleString()}</Td>
                    <Td>₦{Number(b.maxAmount).toLocaleString()}</Td>
                    <Td className="font-medium">{(Number(b.rate) * 100).toFixed(2)}%</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                          onClick={() => deleteBand.mutate(b.id)} disabled={deleteBand.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {/* Edit band inline */}
          {editBand && (
            <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">Edit Band</p>
              <form onSubmit={editForm.handleSubmit(d => updateBand.mutate({ id: editBand.id, dto: d }))} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Min Amount (₦)" error={editForm.formState.errors.minAmount?.message} tooltip={FIELD_TIPS.rateBandMin}>
                    <Input type="number" placeholder="1000000" {...editForm.register('minAmount')} />
                  </FormField>
                  <FormField label="Max Amount (₦)" error={editForm.formState.errors.maxAmount?.message} tooltip={FIELD_TIPS.rateBandMax}>
                    <Input type="number" placeholder="5000000" {...editForm.register('maxAmount')} />
                  </FormField>
                  <FormField label="Rate (%)" error={editForm.formState.errors.rate?.message} tooltip={FIELD_TIPS.rateBandRate}>
                    <div className="relative">
                      <Input type="number" step="0.01" placeholder="5" {...editForm.register('rate')} className="pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </FormField>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={updateBand.isPending}>
                    {updateBand.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditBand(null)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-3">Add Rate Band</p>
            <form onSubmit={addForm.handleSubmit(d => addBand.mutate(d))} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Min Amount (₦)" error={addForm.formState.errors.minAmount?.message} required tooltip={FIELD_TIPS.rateBandMin}>
                  <Input type="number" placeholder="1000000" {...addForm.register('minAmount')} />
                </FormField>
                <FormField label="Max Amount (₦)" error={addForm.formState.errors.maxAmount?.message} required tooltip={FIELD_TIPS.rateBandMax}>
                  <Input type="number" placeholder="5000000" {...addForm.register('maxAmount')} />
                </FormField>
                <FormField label="Rate (%)" error={addForm.formState.errors.rate?.message} required tooltip={FIELD_TIPS.rateBandRate}>
                  <div className="relative">
                    <Input type="number" step="0.01" placeholder="5" {...addForm.register('rate')} className="pr-8" />
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

  const editForm = useForm<ProductForm>({ resolver: zodResolver(productSchema) });

  const create = useMutation({
    mutationFn: (dto: ProductForm) => {
      const defaultFreq = dto.productType === 'SAVINGS' || dto.productType === 'CURRENT' ? 'DAILY'
        : dto.productType === 'FIXED_DEPOSIT' ? 'AT_MATURITY' : 'MONTHLY';
      return apiClient.post('/admin/products', {
        ...dto,
        interestRate: toDecimalRate(dto.interestRate),
        accrualFrequency: dto.accrualFrequency ?? defaultFreq,
      }).then(r => r.data);
    },
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
      accrualFrequency: p.accrualFrequency ?? 'MONTHLY',
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

      <Dialog open={!!editProduct} onOpenChange={open => { if (!open) setEditProduct(null); }}>
        <DialogContent title="Edit Product" className="max-w-xl">
          {editProduct && (
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
          )}
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
              <Th>Name</Th><Th>Code</Th><Th>Type</Th><Th>Rate</Th><Th>Rate Method</Th><Th>Accrual</Th><Th>Min Amount</Th><Th></Th>
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
                  {p.productType === 'LOAN' ? (RATE_TYPE_LABELS[p.interestRateType] ?? '—') : '—'}
                </Td>
                <Td className="text-xs text-muted-foreground">{ACCRUAL_LABELS[p.accrualFrequency] ?? '—'}</Td>
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
