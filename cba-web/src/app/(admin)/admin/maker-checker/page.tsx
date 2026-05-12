'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Shield, CheckCircle2, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatNaira } from '@/lib/utils';

// ── Static option tables ───────────────────────────────────────────────────────

const MODULE_ACTIONS: Record<string, Array<{ value: string; label: string }>> = {
  TRANSACTIONS: [
    { value: 'OTC_DEPOSIT',    label: 'OTC Deposit' },
    { value: 'OTC_WITHDRAWAL', label: 'OTC Withdrawal' },
    { value: 'INTRA_TRANSFER', label: 'Intra-Bank Transfer' },
    { value: 'NIP_TRANSFER',   label: 'NIP Transfer' },
  ],
  LOANS: [
    { value: 'APPROVE',    label: 'Loan Approval' },
    { value: 'DISBURSE',   label: 'Loan Disbursement' },
    { value: 'WRITE_OFF',  label: 'Loan Write-Off' },
  ],
  ACCOUNTS: [
    { value: 'OPEN',  label: 'Account Opening' },
    { value: 'CLOSE', label: 'Account Closure' },
  ],
};

const MODULES = Object.keys(MODULE_ACTIONS).map(v => ({
  value: v,
  label: v.charAt(0) + v.slice(1).toLowerCase(),
}));

const CHANNELS = [
  { value: 'OTC',      label: 'OTC (Counter)' },
  { value: 'MOBILE',   label: 'Mobile Banking' },
  { value: 'INTERNET', label: 'Internet Banking' },
  { value: 'API',      label: 'API / BaaS' },
];

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  module: z.string().min(1, 'Select a module'),
  action: z.string().min(1, 'Select an action'),
  requiresApprovalAbove: z.coerce.number().min(0).optional(),
  channels: z.array(z.string()).min(1, 'Select at least one channel'),
  requiredApprovers: z.coerce.number().int().min(1),
  ttlMinutes: z.coerce.number().int().min(1),
});
type Form = z.infer<typeof schema>;

// ── Channel checkboxes ────────────────────────────────────────────────────────

function ChannelPicker({
  selected,
  onChange,
  error,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter(c => c !== value)
        : [...selected, value],
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-3">
        {CHANNELS.map(ch => (
          <label
            key={ch.value}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm ${
              selected.includes(ch.value)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-foreground hover:bg-muted'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(ch.value)}
              onChange={() => toggle(ch.value)}
              className="sr-only"
            />
            <span
              className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                selected.includes(ch.value)
                  ? 'border-primary bg-primary'
                  : 'border-input'
              }`}
            >
              {selected.includes(ch.value) && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {ch.label}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface Rule {
  id: string;
  module: string;
  action: string;
  channels: string[];
  requiresApprovalAbove: string | null;
  requiredApprovers: number;
  ttlMinutes: number;
  isActive: boolean;
}

export default function MakerCheckerPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ['admin', 'maker-checker-rules'],
    queryFn: () => apiClient.get('/admin/maker-checker-rules').then(r => r.data),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { requiredApprovers: 1, ttlMinutes: 60, channels: [] },
  });

  const selectedModule = watch('module');
  const availableActions = selectedModule ? (MODULE_ACTIONS[selectedModule] ?? []) : [];

  const create = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/admin/maker-checker-rules', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'maker-checker-rules'] });
      toast.success('Rule saved');
      reset({ requiredApprovers: 1, ttlMinutes: 60, channels: [] });
      setShowForm(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/admin/maker-checker-rules/${id}`, { isActive }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'maker-checker-rules'] });
      toast.success('Rule updated');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  function actionLabel(module: string, action: string) {
    return MODULE_ACTIONS[module]?.find(a => a.value === action)?.label ?? action;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maker-Checker Rules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Transactions matching a rule require a second approver — maker ≠ checker
          </p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Rule'}
        </Button>
      </div>

      {/* How it works */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 flex gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How it works</p>
          <p>
            When a transaction matches the module + action + channel, it enters a pending queue.
            A different user must approve it before it executes. The approver cannot be the same
            person who initiated it.
          </p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">New Rule</h2>
          <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-5">
            {/* Module + Action */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Module"
                error={errors.module?.message}
                required
                tooltip="The banking module where this rule applies"
              >
                <Controller
                  name="module"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={v => {
                        field.onChange(v);
                        setValue('action', '');
                      }}
                      placeholder="Select module"
                    >
                      {MODULES.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </Select>
                  )}
                />
              </FormField>

              <FormField
                label="Action"
                error={errors.action?.message}
                required
                tooltip="The specific operation that requires dual approval"
              >
                <Controller
                  name="action"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      placeholder={selectedModule ? 'Select action' : 'Select module first'}
                      disabled={!selectedModule}
                    >
                      {availableActions.map(a => (
                        <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                      ))}
                    </Select>
                  )}
                />
              </FormField>
            </div>

            {/* Channels */}
            <FormField
              label="Channels"
              error={errors.channels?.message}
              required
              tooltip="Which banking channels trigger this rule. Select all that apply."
            >
              <Controller
                name="channels"
                control={control}
                render={({ field }) => (
                  <ChannelPicker
                    selected={field.value}
                    onChange={field.onChange}
                    error={errors.channels?.message}
                  />
                )}
              />
            </FormField>

            {/* Amount threshold */}
            <FormField
              label="Trigger only when amount above (₦)"
              tooltip="Leave blank to require approval on ALL amounts for this action"
            >
              <Input
                type="number"
                placeholder="e.g. 1000000 — leave blank for all amounts"
                {...register('requiresApprovalAbove')}
              />
            </FormField>

            {/* Approvers + TTL */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Required Approvers"
                error={errors.requiredApprovers?.message}
                required
                tooltip="How many different users must approve before the transaction executes"
              >
                <Input type="number" min="1" {...register('requiredApprovers')} />
              </FormField>
              <FormField
                label="Approval window (minutes)"
                error={errors.ttlMinutes?.message}
                required
                tooltip="How long the pending request stays open before it expires"
              >
                <Input type="number" min="1" {...register('ttlMinutes')} />
              </FormField>
            </div>

            <Button type="submit" disabled={create.isPending} className="w-full">
              {create.isPending ? 'Saving…' : 'Save Rule'}
            </Button>
          </form>
        </div>
      )}

      {/* Rules table */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th>Module</Th>
                <Th>Action</Th>
                <Th>Channels</Th>
                <Th>Amount threshold</Th>
                <Th>Approvers</Th>
                <Th>Window</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {rules.length === 0 && (
                <Tr>
                  <Td colSpan={8} className="text-center text-muted-foreground py-10">
                    No rules configured yet. Click <strong>+ New Rule</strong> to get started.
                  </Td>
                </Tr>
              )}
              {rules.map(rule => (
                <Tr key={rule.id}>
                  <Td>
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {rule.module}
                    </span>
                  </Td>
                  <Td className="text-sm">{actionLabel(rule.module, rule.action)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {rule.channels.map(ch => (
                        <Badge key={ch} variant="outline">{ch}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-sm text-muted-foreground">
                    {rule.requiresApprovalAbove
                      ? `Above ${formatNaira(Number(rule.requiresApprovalAbove))}`
                      : 'All amounts'}
                  </Td>
                  <Td className="text-sm">{rule.requiredApprovers}</Td>
                  <Td className="text-sm text-muted-foreground">{rule.ttlMinutes} min</Td>
                  <Td>
                    <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <button
                      onClick={() => toggle.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={rule.isActive ? 'Deactivate rule' : 'Activate rule'}
                    >
                      {rule.isActive
                        ? <ToggleRight className="h-5 w-5 text-primary" />
                        : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      {/* Quick reference */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 flex gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">Common configurations</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { module: 'TRANSACTIONS', action: 'OTC_DEPOSIT',    threshold: '₦1,000,000+', channels: 'OTC' },
              { module: 'TRANSACTIONS', action: 'INTRA_TRANSFER', threshold: '₦500,000+',   channels: 'OTC, MOBILE' },
              { module: 'LOANS',        action: 'DISBURSE',       threshold: 'All amounts',  channels: 'OTC, API' },
            ].map(ex => (
              <div key={ex.action} className="bg-card border border-border rounded-md px-3 py-2 space-y-0.5">
                <p className="font-mono text-xs text-foreground">{ex.module} / {ex.action}</p>
                <p className="text-xs">{ex.threshold} · {ex.channels}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
