'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Landmark, Info, AlertTriangle, ShieldCheck, Pencil } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Sheet } from '@/components/ui/sheet';
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

const TYPE_PREFIX: Record<string, string> = {
  ASSET: '1',
  LIABILITY: '2',
  EQUITY: '3',
  INCOME: '4',
  EXPENSE: '5',
};

const TYPE_PREFIX_LABEL: Record<string, string> = {
  ASSET: '1xxx',
  LIABILITY: '2xxx',
  EQUITY: '3xxx',
  INCOME: '4xxx',
  EXPENSE: '5xxx',
};

const createSchema = z.object({
  code: z.string().min(1, 'Required'),
  accountNumber: z.string().optional(),
  name: z.string().min(1, 'Required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  level: z.enum(GL_LEVELS),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  parentId: z.string().optional(),
  description: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  accountNumber: z.string().optional(),
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  level: z.enum(GL_LEVELS),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
});
type EditForm = z.infer<typeof editSchema>;

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

function prefixMismatch(type: string, accountNumber: string | undefined): boolean {
  if (!accountNumber) return false;
  const expected = TYPE_PREFIX[type];
  return !!expected && !accountNumber.startsWith(expected);
}

export default function GlPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GlAccount | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<GlAccount[]>({
    queryKey: ['admin', 'gl'],
    queryFn: () => apiClient.get('/gl/accounts').then(r => r.data),
  });

  // ── Create form ──────────────────────────────────────────────────────────────
  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: 'ASSET', level: 'DETAIL', normalBalance: 'DEBIT' },
  });
  const selectedType = createForm.watch('type');
  const selectedLevel = createForm.watch('level');
  const accountNumberValue = createForm.watch('accountNumber');

  useEffect(() => {
    const current = accountNumberValue ?? '';
    if (current === '' || Object.values(TYPE_PREFIX).includes(current)) {
      createForm.setValue('accountNumber', TYPE_PREFIX[selectedType] ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  // ── Edit form ────────────────────────────────────────────────────────────────
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  const editAccountNumber = editForm.watch('accountNumber');

  function openEdit(a: GlAccount) {
    editForm.reset({
      accountNumber: a.accountNumber ?? '',
      name: a.name,
      description: a.description ?? '',
      parentId: a.parentId ?? '',
      level: a.level as EditForm['level'],
      normalBalance: a.normalBalance as EditForm['normalBalance'],
    });
    setEditOpen(true);
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: (dto: CreateForm) => apiClient.post('/gl/accounts', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gl'] });
      toast.success('GL account created');
      createForm.reset();
      setCreateOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (dto: EditForm) =>
      apiClient.patch(`/gl/accounts/${selected!.id}`, {
        ...dto,
        accountNumber: dto.accountNumber || null,
        parentId: dto.parentId || null,
      }).then(r => r.data),
    onSuccess: (updated: GlAccount) => {
      qc.invalidateQueries({ queryKey: ['admin', 'gl'] });
      toast.success('GL account updated');
      setSelected(updated);
      setEditOpen(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  // ── Derived state ────────────────────────────────────────────────────────────
  const allAccounts: GlAccount[] = data ?? [];
  const accounts = allAccounts.filter(a =>
    !search ||
    a.code.includes(search.toUpperCase()) ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.accountNumber ?? '').includes(search),
  );
  const accountById = Object.fromEntries(allAccounts.map(a => [a.id, a]));
  const children = selected ? allAccounts.filter(a => a.parentId === selected.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={open => { if (!open) createForm.reset(); setCreateOpen(open); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add GL Account</Button>
          </DialogTrigger>
          <DialogContent title="Create GL Account" className="max-w-xl">
            <form onSubmit={createForm.handleSubmit(d => create.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Symbolic Code"
                  error={createForm.formState.errors.code?.message}
                  required
                  tooltip="Unique code used by PostingEngine (e.g. SAVINGS_CONTROL). All-caps, underscore-separated."
                >
                  <Input placeholder="SAVINGS_CONTROL" {...createForm.register('code')} className="uppercase" />
                </FormField>
                <FormField
                  label="Account Number"
                  tooltip={`Numeric code for the chart of accounts. Convention: ${Object.entries(TYPE_PREFIX_LABEL).map(([t, p]) => `${p}=${t}`).join(', ')}.`}
                >
                  <Input placeholder={`${TYPE_PREFIX[selectedType]}001`} {...createForm.register('accountNumber')} />
                  {prefixMismatch(selectedType, accountNumberValue) && (
                    <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {selectedType} accounts typically start with {TYPE_PREFIX_LABEL[selectedType]}
                    </p>
                  )}
                </FormField>
              </div>

              <FormField label="Account Name" error={createForm.formState.errors.name?.message} required>
                <Input placeholder="Savings Control Account" {...createForm.register('name')} />
              </FormField>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Type" required>
                  <Select value={selectedType} onValueChange={v => createForm.setValue('type', v as CreateForm['type'])}>
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
                  <Select value={selectedLevel} onValueChange={v => createForm.setValue('level', v as CreateForm['level'])}>
                    {GL_LEVELS.map(l => (
                      <SelectItem key={l} value={l}>{GL_LEVEL_LABELS[l]}</SelectItem>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Normal Balance" required>
                  <Select value={createForm.watch('normalBalance')} onValueChange={v => createForm.setValue('normalBalance', v as CreateForm['normalBalance'])}>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                  </Select>
                </FormField>
              </div>

              <FormField
                label="Parent Account"
                tooltip="Optional. Set this to place the account in the hierarchy. Leave blank for top-level accounts."
              >
                <Select
                  value={createForm.watch('parentId') ?? '__none__'}
                  onValueChange={v => createForm.setValue('parentId', v === '__none__' ? undefined : v)}
                >
                  <SelectItem value="__none__">— None (top-level) —</SelectItem>
                  {allAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.accountNumber ? `${a.accountNumber} · ` : ''}{a.name} ({a.level})
                    </SelectItem>
                  ))}
                </Select>
              </FormField>

              <FormField label="Description">
                <Input placeholder="Optional description" {...createForm.register('description')} />
              </FormField>

              {selectedLevel === 'DETAIL' && (
                <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong>DETAIL</strong> accounts are the only level that receive actual postings.
                    After creating, link it to a product via the <strong>Products</strong> page.
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
                  <Tr
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(a)}
                  >
                    <Td className="font-mono text-xs text-muted-foreground w-16">
                      {a.accountNumber ?? <span className="text-amber-500">—</span>}
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
                      {parent ? `${parent.accountNumber ? `${parent.accountNumber} · ` : ''}${parent.name}` : '—'}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      )}

      {/* ── Detail side panel ─────────────────────────────────────────────── */}
      <Sheet
        open={!!selected}
        onClose={() => { setSelected(null); setEditOpen(false); }}
        title={selected?.code ?? ''}
      >
        {selected && !editOpen && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant={TYPE_VARIANT[selected.type]}>{selected.type}</Badge>
              <Badge variant={selected.level === 'DETAIL' ? 'default' : 'outline'}>
                {GL_LEVEL_LABELS[selected.level] ?? selected.level}
              </Badge>
              <Badge variant={selected.normalBalance === 'DEBIT' ? 'default' : 'secondary'}>
                {selected.normalBalance}
              </Badge>
              {selected.isSystemAccount && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> System
                </Badge>
              )}
              <Badge variant={selected.isActive ? 'success' : 'destructive'}>
                {selected.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Account Name</dt>
                <dd className="font-medium">{selected.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Account Number</dt>
                <dd className="font-mono">
                  {selected.accountNumber ?? (
                    <span className="text-amber-500 text-xs">Not set</span>
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5">Symbolic Code</dt>
                <dd>
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{selected.code}</span>
                </dd>
              </div>
              {selected.parentId && accountById[selected.parentId] && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground mb-0.5">Reports To</dt>
                  <dd
                    className="text-primary underline-offset-2 hover:underline cursor-pointer text-sm"
                    onClick={() => setSelected(accountById[selected.parentId!])}
                  >
                    {accountById[selected.parentId].accountNumber
                      ? `${accountById[selected.parentId].accountNumber} · `
                      : ''}
                    {accountById[selected.parentId].name}
                  </dd>
                </div>
              )}
              {selected.description && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground mb-0.5">Description</dt>
                  <dd className="text-sm text-muted-foreground">{selected.description}</dd>
                </div>
              )}
            </dl>

            <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Account
            </Button>

            {children.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Sub-accounts ({children.length})
                </h3>
                <ul className="space-y-1">
                  {children.map(c => (
                    <li key={c.id}>
                      <button
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
                        onClick={() => setSelected(c)}
                      >
                        <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">
                          {c.accountNumber ?? '—'}
                        </span>
                        <span className="flex-1 truncate font-medium">{c.name}</span>
                        <Badge variant={c.level === 'DETAIL' ? 'default' : 'outline'} className="text-xs shrink-0">
                          {GL_LEVEL_LABELS[c.level] ?? c.level}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.level === 'DETAIL' && (
              <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  This is a <strong>DETAIL</strong> account — it can receive postings via PostingEngine.
                  Link it to a product on the <strong>Products</strong> page.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Inline edit form inside drawer ──────────────────────────────── */}
        {selected && editOpen && (
          <form onSubmit={editForm.handleSubmit(d => update.mutate(d))} className="space-y-4">
            <p className="text-xs text-muted-foreground -mt-1">
              Editing <span className="font-mono font-medium text-foreground">{selected.code}</span>
            </p>

            <FormField
              label="Account Number"
              error={editForm.formState.errors.accountNumber?.message}
              tooltip={`Prefix convention: ${Object.entries(TYPE_PREFIX_LABEL).map(([t, p]) => `${p}=${t}`).join(', ')}.`}
            >
              <Input placeholder={`${TYPE_PREFIX[selected.type]}001`} {...editForm.register('accountNumber')} />
              {prefixMismatch(selected.type, editAccountNumber) && (
                <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {selected.type} accounts typically start with {TYPE_PREFIX_LABEL[selected.type]}
                </p>
              )}
            </FormField>

            <FormField label="Account Name" error={editForm.formState.errors.name?.message} required>
              <Input {...editForm.register('name')} />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Level" required>
                <Select value={editForm.watch('level')} onValueChange={v => editForm.setValue('level', v as EditForm['level'])}>
                  {GL_LEVELS.map(l => (
                    <SelectItem key={l} value={l}>{GL_LEVEL_LABELS[l]}</SelectItem>
                  ))}
                </Select>
              </FormField>
              <FormField label="Normal Balance" required>
                <Select value={editForm.watch('normalBalance')} onValueChange={v => editForm.setValue('normalBalance', v as EditForm['normalBalance'])}>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </Select>
              </FormField>
            </div>

            <FormField label="Parent Account">
              <Select
                value={editForm.watch('parentId') || '__none__'}
                onValueChange={v => editForm.setValue('parentId', v === '__none__' ? '' : v)}
              >
                <SelectItem value="__none__">— None (top-level) —</SelectItem>
                {allAccounts.filter(a => a.id !== selected.id).map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.accountNumber ? `${a.accountNumber} · ` : ''}{a.name} ({a.level})
                  </SelectItem>
                ))}
              </Select>
            </FormField>

            <FormField label="Description">
              <Input placeholder="Optional description" {...editForm.register('description')} />
            </FormField>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
