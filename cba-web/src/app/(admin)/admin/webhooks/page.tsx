'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Webhook, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  url: z.string().url('Must be a valid HTTPS URL'),
  events: z.string().min(1, 'Required'),
});
type Form = z.infer<typeof schema>;

const EVENT_OPTIONS = ['transaction.completed', 'transaction.failed', 'loan.disbursed', 'loan.repaid', 'account.opened', 'account.closed', 'kyc.verified'];

export default function WebhooksPage() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'webhooks'],
    queryFn: () => apiClient.get('/baas/webhooks').then(r => r.data),
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { events: '' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/baas/webhooks', {
      name: dto.name, url: dto.url,
      events: dto.events.split(',').map(s => s.trim()).filter(Boolean),
    }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'webhooks'] }); toast.success('Webhook created'); reset(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/baas/webhooks/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'webhooks'] }); toast.success('Webhook deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const webhooks = data ?? [];
  const selectedEvents = (watch('events') || '').split(',').map(s => s.trim()).filter(Boolean);

  function toggleEvent(ev: string) {
    const current = selectedEvents;
    const next = current.includes(ev) ? current.filter(e => e !== ev) : [...current, ev];
    setValue('events', next.join(', '));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">Events delivered with HMAC-SHA256 signature</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Add Webhook</Button>
          </DialogTrigger>
          <DialogContent title="Register Webhook">
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
              <FormField label="Name" error={errors.name?.message} required>
                <Input placeholder="Production Webhook" {...register('name')} />
              </FormField>
              <FormField label="Endpoint URL" error={errors.url?.message} required>
                <Input placeholder="https://api.yourapp.com/webhooks/cba" {...register('url')} />
              </FormField>
              <FormField label="Events" error={errors.events?.message} required>
                <div className="flex flex-wrap gap-2 mt-1">
                  {EVENT_OPTIONS.map(ev => (
                    <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedEvents.includes(ev) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      {ev}
                    </button>
                  ))}
                </div>
                {errors.events && <p className="text-xs text-destructive mt-1">{errors.events.message}</p>}
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Webhook'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Webhook className="h-8 w-8" /><p className="text-sm">No webhooks registered.</p>
        </div>
      ) : (
        <Table>
          <Thead><Tr><Th>Name</Th><Th>URL</Th><Th>Events</Th><Th>Created</Th><Th></Th></Tr></Thead>
          <Tbody>
            {webhooks.map((w: any) => (
              <Tr key={w.id}>
                <Td className="font-medium">{w.name}</Td>
                <Td className="max-w-[200px]"><span className="text-xs font-mono truncate block">{w.url}</span></Td>
                <Td><div className="flex flex-wrap gap-1">{(w.events ?? []).map((e: string) => <Badge key={e} variant="outline">{e}</Badge>)}</div></Td>
                <Td className="text-muted-foreground text-xs">{formatDate(w.createdAt)}</Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(w.id)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
