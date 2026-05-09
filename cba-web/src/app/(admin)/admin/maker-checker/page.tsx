'use client';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Shield, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';

const schema = z.object({
  module: z.string().min(1, 'Required'),
  action: z.string().min(1, 'Required'),
  requiresApprovalAbove: z.coerce.number().min(0).optional(),
  channels: z.string().min(1, 'Required'),
  requiredApprovers: z.coerce.number().int().min(1).default(1),
  ttlMinutes: z.coerce.number().int().min(1).default(60),
});
type Form = z.infer<typeof schema>;

export default function MakerCheckerPage() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { requiredApprovers: 1, ttlMinutes: 60, channels: 'MOBILE, INTERNET' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => {
      const payload = { ...dto, channels: dto.channels.split(',').map(s => s.trim()) };
      return apiClient.post('/admin/maker-checker-rules', payload).then(r => r.data);
    },
    onSuccess: () => { toast.success('Rule created'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-xl font-semibold">Maker-Checker Rules</h2>
        <p className="text-sm text-muted-foreground">Transactions matching a rule require a second approver (maker ≠ checker)</p>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4 flex gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How it works</p>
          <p>When a transaction matches the module + action + channel, it enters a pending queue. A different user must approve it before it executes. The approver cannot be the same person who initiated it.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Module" error={errors.module?.message} required>
              <Input placeholder="transactions" {...register('module')} />
            </FormField>
            <FormField label="Action" error={errors.action?.message} required>
              <Input placeholder="OTC_DEPOSIT" {...register('action')} />
            </FormField>
          </div>
          <FormField label="Channels (comma-separated)" error={errors.channels?.message} required>
            <Input placeholder="MOBILE, INTERNET" {...register('channels')} />
          </FormField>
          <FormField label="Trigger only when amount above (₦, leave blank for all amounts)">
            <Input type="number" placeholder="100000" {...register('requiresApprovalAbove')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Required Approvers" error={errors.requiredApprovers?.message} required>
              <Input type="number" min="1" {...register('requiredApprovers')} />
            </FormField>
            <FormField label="Expiry (minutes)" error={errors.ttlMinutes?.message} required>
              <Input type="number" min="1" {...register('ttlMinutes')} />
            </FormField>
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full">
            {create.isPending ? 'Saving…' : 'Create Rule'}
          </Button>
        </form>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4 flex gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Common examples</p>
          <ul className="space-y-1">
            {[['transactions', 'OTC_DEPOSIT', '₦1,000,000+'], ['transactions', 'INTRA_TRANSFER', '₦500,000+'], ['loans', 'DISBURSE', 'all amounts']].map(([m, a, t]) => (
              <li key={a} className="flex gap-2"><span className="font-mono text-xs">{m} / {a}</span><span>→ {t}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
