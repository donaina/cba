'use client';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';

const schema = z.object({
  taxType: z.enum(['VAT', 'WHT', 'STAMP_DUTY']),
  rate: z.string().regex(/^\d+(\.\d+)?$/, 'Enter a valid decimal e.g. 0.075'),
  effectiveDate: z.string().min(1, 'Required'),
});
type Form = z.infer<typeof schema>;

const TAX_HINTS: Record<string, string> = {
  VAT: 'Value Added Tax on service fees — CBN standard: 7.5% → enter 0.075',
  WHT: 'Withholding Tax on FD interest — CBN standard: 10% → enter 0.10',
  STAMP_DUTY: 'Stamp Duty on applicable transactions',
};

export default function TaxRatesPage() {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { taxType: 'VAT', effectiveDate: new Date().toISOString().split('T')[0] },
  });

  const set = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/admin/tax-rates', dto).then(r => r.data),
    onSuccess: () => { toast.success('Tax rate saved'); reset({ taxType: 'VAT', effectiveDate: new Date().toISOString().split('T')[0] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const taxType = watch('taxType');

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-xl font-semibold">Tax Rates</h2>
        <p className="text-sm text-muted-foreground">Configure VAT, WHT, and Stamp Duty rates</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <form onSubmit={handleSubmit(d => set.mutate(d))} className="space-y-4">
          <FormField label="Tax Type" required>
            <Select value={taxType} onValueChange={v => setValue('taxType', v as any)}>
              <SelectItem value="VAT">VAT — Value Added Tax</SelectItem>
              <SelectItem value="WHT">WHT — Withholding Tax</SelectItem>
              <SelectItem value="STAMP_DUTY">Stamp Duty</SelectItem>
            </Select>
          </FormField>
          {taxType && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">{TAX_HINTS[taxType]}</p>
          )}
          <FormField label="Rate (decimal, e.g. 0.075 = 7.5%)" error={errors.rate?.message} required>
            <Input placeholder="0.075" {...register('rate')} />
          </FormField>
          <FormField label="Effective From" error={errors.effectiveDate?.message} required>
            <Input type="date" {...register('effectiveDate')} />
          </FormField>
          <Button type="submit" disabled={set.isPending} className="w-full">
            {set.isPending ? 'Saving…' : 'Save Tax Rate'}
          </Button>
        </form>
      </div>

      <div className="bg-muted/40 border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">CBN Reference Rates</h3>
        <div className="space-y-2 text-sm">
          {[['VAT on fees', '7.5%', '0.075'], ['WHT on FD interest', '10%', '0.10'], ['NIP fee ≤₦5,000', '₦10.75 flat', '—'], ['NIP fee ≤₦50,000', '₦26.88 flat', '—'], ['NIP fee >₦50,000', '₦53.75 flat', '—']].map(([t, r, d]) => (
            <div key={t} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
              <span className="text-muted-foreground">{t}</span>
              <div className="flex gap-4">
                <span className="font-medium">{r}</span>
                <span className="font-mono text-xs text-muted-foreground w-12 text-right">{d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
