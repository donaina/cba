'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Landmark, Info } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const GL_LEVELS = ['CATEGORY', 'HEADER', 'SUB_HEADER', 'DETAIL'] as const;
const GL_LEVEL_LABELS: Record<string, string> = {
  CATEGORY: 'Category',
  HEADER: 'Header',
  SUB_HEADER: 'Sub-Header',
  DETAIL: 'Detail (postable)',
};

const schema = z.object({
  code: z.string().min(1, 'Required'),
  accountNumber: z.string().optional(),
  name: z.string().min(1, 'Required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  level: z.enum(GL_LEVELS),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  parentId: z.string().optional(),
  description: z.string().optional(),
});
type Form = z.infer<typeof schema>;

interface GlAccount {
  id: string;
  code: string;
  accountNumber: string | null;
  name: string;
  type: string;
  level: string;
  normalBalance: string;
  parentId: string | null;
  isSystemAccount: boolean;
  isActive: boolean;
  description: string | null;
}

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'destructive'> = {
  ASSET: 'default',
  LIABILITY: 'secondary',
  EQUITY: 'outline',
  INCOME: 'success',
  EXPENSE: 'destructive',
};

export default function GlPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<GlAccount[]>({
    queryKey: ['admin', 'gl'],
    queryFn: () => apiClient.get('/gl/accounts').then(r => r.data),
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'ASSET', level: 'DETAIL', normalBalance: 'DEBIT' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/gl/accounts', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gl'] });
      toast.success('GL account created');
      reset();
      setOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const allAccounts: GlAccount[] = data ?? [];
  const accounts = allAccounts.filter(a =>
    !search ||
    a.code.includes(search.toUpperCase()) ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.accountNumber ?? '').includes(search),
  );

  const accountById = Object.fromEntries(allAccounts.map(a => [a.id, a]));

  const selectedLevel = watch('level');
  const selectedType = watch('type');

  function handleOpen(val: boolean) {
    if (!val) reset();
    setOpen(val);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add GL Account</Button>
          </DialogTrigger>
          <DialogContent title="Create GL Account" className="max-w-xl">
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Symbolic Code"
                  error={errors.code?.message}
                  required
                  tooltip="Unique code used by PostingEngine (e.g. SAVINGS_CONTROL). All-caps, underscore-separated."
                >
                  <Input placeholder="SAVINGS_CONTROL" {...register('code')} className="uppercase" />
                </FormField>
                <FormField
                  label="Account Number"
                  error={errors.accountNumber?.message}
                  tooltip="Numeric code for chart of accounts. Convention: 1xxx=Assets, 2xxx=Liabilities, 3xxx=Equity, 4xxx=Income, 5xxx=Expense."
                >
                  <Input placeholder="2001" {...register('accountNumber')} />
                </FormField>
              </div>

              <FormField label="Account Name" error={errors.name?.message} required>
                <Input placeholder="Savings Control Account" {...register('name')} />
              </FormField>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Type" required>
                  <Select value={selectedType} onValueChange={v => setValue('type', v as Form['type'])}>
                    {['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Level"
                  required
                  tooltip="CATEGORY / HEADER / SUB_HEADER are summary nodes. Only DETAIL accounts accept actual postings via PostingEngine."
                >
                  <Select value={selectedLevel} onValueChange={v => setValue('level', v as Form['level'])}>
                    {GL_LEVELS.map(l => (
                      <SelectItem key={l} value={l}>{GL_LEVEL_LABELS[l]}</SelectItem>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Normal Balance" required>
                  <Select value={watch('normalBalance')} onValueChange={v => setValue('normalBalance', v as Form['normalBalance'])}>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                  </Select>
                </FormField>
              </div>

              <FormField
                label="Parent Account"
                tooltip="Optional. Set this to place the account in the hierarchy (e.g. a HEADER under a CATEGORY). Leave blank for top-level accounts."
              >
                <Select
                  value={watch('parentId') ?? ''}
                  onValueChange={v => setValue('parentId', v || undefined)}
                >
                  <SelectItem value="">— None (top-level) —</SelectItem>
                  {allAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.accountNumber ? `${a.accountNumber} · ` : ''}{a.name} ({a.level})
                    </SelectItem>
                  ))}
                </Select>
              </FormField>

              <FormField label="Description">
                <Input placeholder="Optional description" {...register('description')} />
              </FormField>

              {selectedLevel === 'DETAIL' && (
                <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong>DETAIL</strong> accounts are the only level that receive actual postings.
                    After creating this account, link it to a product on the <strong>Products</strong> page
                    using the &quot;GL Account&quot; field.
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" size="sm">Cancel</Button>
                </DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search by code, name, or account number…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Landmark className="h-8 w-8" />
          <p className="text-sm">No GL accounts found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>No.</Th>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Level</Th>
                <Th>Normal Balance</Th>
                <Th>Reports To</Th>
              </Tr>
            </Thead>
            <Tbody>
              {accounts.map(a => {
                const parent = a.parentId ? accountById[a.parentId] : null;
                return (
                  <Tr key={a.id}>
                    <Td className="font-mono text-xs text-muted-foreground w-16">
                      {a.accountNumber ?? '—'}
                    </Td>
                    <Td>
                      <span className="font-mono text-xs font-medium bg-muted px-1.5 py-0.5 rounded">
                        {a.code}
                      </span>
                    </Td>
                    <Td className="font-medium">{a.name}</Td>
                    <Td><Badge variant={TYPE_VARIANT[a.type]}>{a.type}</Badge></Td>
                    <Td>
                      <Badge variant={a.level === 'DETAIL' ? 'default' : 'outline'}>
                        {GL_LEVEL_LABELS[a.level] ?? a.level}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge variant={a.normalBalance === 'DEBIT' ? 'default' : 'secondary'}>
                        {a.normalBalance}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {parent ? (
                        <span>
                          {parent.accountNumber ? `${parent.accountNumber} · ` : ''}{parent.name}
                        </span>
                      ) : '—'}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
