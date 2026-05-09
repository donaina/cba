'use client';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export default function BrandingPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: logoData } = useQuery({
    queryKey: ['admin', 'logo'],
    queryFn: () => apiClient.get('/admin/branding/logo').then(r => r.data),
  });

  const upload = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append('file', f);
      return apiClient.post('/admin/branding/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'logo'] });
      toast.success('Logo uploaded successfully');
      setFile(null);
      setPreview(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/png', 'image/jpeg'].includes(f.type)) {
      toast.error('Only PNG or JPEG files are supported');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  const currentLogo = logoData?.dataUri;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-xl font-semibold">Branding</h2>
        <p className="text-sm text-muted-foreground">Logo is embedded in all generated PDF statements and FD certificates</p>
      </div>

      {currentLogo && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold">Current Logo</h3>
          <div className="flex items-center justify-center bg-muted/40 rounded-lg p-6 min-h-[120px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentLogo} alt="Bank logo" className="max-h-24 max-w-full object-contain" />
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold">Upload New Logo</h3>
        <p className="text-xs text-muted-foreground">PNG or JPEG, recommended size 400×120px or similar wide format. The image is stored in MinIO and served as a base64 data URI in PDFs.</p>

        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="Preview" className="max-h-24 mx-auto object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm">Click to select a file</p>
              <p className="text-xs">PNG or JPEG</p>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />

        {file && (
          <div className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-muted-foreground truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        )}

        <Button
          className="w-full"
          disabled={!file || upload.isPending}
          onClick={() => file && upload.mutate(file)}
        >
          <Upload className="h-4 w-4" />
          {upload.isPending ? 'Uploading…' : 'Upload Logo'}
        </Button>
      </div>
    </div>
  );
}
