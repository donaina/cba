'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Key, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
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
  scopes: z.string().min(1, 'Required'),
  expiresAt: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function ApiKeysPage() {
  const [open, setOpen] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'api-keys'],
    queryFn: () => apiClient.get('/baas/api-keys').then(r => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { scopes: 'txn:read, account:read' },
  });

  const create = useMutation({
    mutationFn: (dto: Form) => apiClient.post('/baas/api-keys', {
      name: dto.name,
      scopes: dto.scopes.split(',').map(s => s.trim()),
      expiresAt: dto.expiresAt || undefined,
    }).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      toast.success('API key created — copy it now, it won\'t be shown again');
      setRawKey(res.rawKey ?? res.key ?? null);
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/baas/api-keys/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'api-keys'] }); toast.success('Key revoked'); },
    onError: (e: any) => toast.error(e.message),
  });

  const keys = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">Keys are stored as SHA-256 hashes — the raw key is shown only once at creation</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" />Create Key</Button>
          </DialogTrigger>
          <DialogContent title="Create API Key">
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="space-y-4">
              <FormField label="Label" error={errors.name?.message} required>
                <Input placeholder="Production Key" {...register('name')} />
              </FormField>
              <FormField label="Scopes (comma-separated)" error={errors.scopes?.message} required>
                <Input placeholder="txn:read, account:read, loan:read" {...register('scopes')} />
              </FormField>
              <FormField label="Expires At (leave blank for no expiry)">
                <Input type="datetime-local" {...register('expiresAt')} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button type="submit" size="sm" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Key'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rawKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-yellow-800">New API key — copy it now</p>
          <p className="text-xs text-yellow-700">This is the only time it will be displayed. Store it securely.</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-white border border-yellow-200 rounded px-3 py-2 flex-1 font-mono overflow-x-auto">
              {showKey ? rawKey : rawKey.replace(/./g, '•')}
            </code>
            <button onClick={() => setShowKey(s => !s)} className="p-1.5 hover:bg-yellow-100 rounded text-yellow-700">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button onClick={() => { navigator.clipboard.writeText(rawKey); toast.success('Copied!'); }}
              className="p-1.5 hover:bg-yellow-100 rounded text-yellow-700">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRawKey(null)}>Dismiss</Button>
        </div>
      )}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : keys.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Key className="h-8 w-8" /><p className="text-sm">No API keys yet.</p>
        </div>
      ) : (
        <Table>
          <Thead><Tr><Th>Name</Th><Th>Scopes</Th><Th>Created</Th><Th>Expires</Th><Th></Th></Tr></Thead>
          <Tbody>
            {keys.map((k: any) => (
              <Tr key={k.id}>
                <Td className="font-medium">{k.name}</Td>
                <Td><div className="flex flex-wrap gap-1">{(k.scopes ?? []).map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}</div></Td>
                <Td className="text-muted-foreground text-xs">{formatDate(k.createdAt)}</Td>
                <Td className="text-muted-foreground text-xs">{k.expiresAt ? formatDate(k.expiresAt) : 'Never'}</Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)} className="text-destructive hover:bg-destructive/10">
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
