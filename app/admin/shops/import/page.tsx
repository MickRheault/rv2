'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import { Loader2 } from 'lucide-react';
import { ShopManifest } from '@/types/shop-manifest';

const schema = z.object({
  url: z.string().url(),
  manifest: z.string().optional(), // JSON string
});

type FormValues = z.infer<typeof schema>;

export default function ImportShopPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manifestData, setManifestData] = useState<ShopManifest | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onExtract = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/extract-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.url }),
      });

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setManifestData(result.manifest);
      setValue('manifest', JSON.stringify(result.manifest, null, 2));
      setSuccess('Shop data extracted successfully! Review the JSON below.');
    } catch (err: any) {
      setError(err.message || 'An error occurred during extraction.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSync = async (data: FormValues) => {
    if (!data.manifest) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const manifest = JSON.parse(data.manifest) as ShopManifest;
      const response = await fetch('/api/admin/sync-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest, dryRun: false }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setSuccess(`Sync successful! Result: ${JSON.stringify(result.result, null, 2)}`);
      // Optionally redirect or refresh
    } catch (err: any) {
      setError(err.message || 'An error occurred during sync.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Import Shop via URL</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onExtract)} className="space-y-4">
            <div className="flex space-x-2">
              <Input
                {...register('url')}
                placeholder="Enter shop URL (e.g., https://example.com)"
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Extract'}
              </Button>
            </div>
            {errors.url && <p className="text-red-500 text-sm">{errors.url.message}</p>}
          </form>

          {error && (
            <Alert 
              variant="error" 
              title="Error" 
              description={error} 
              className="mt-4"
            />
          )}

          {success && (
            <Alert 
              variant="success" 
              title="Success" 
              description={success} 
              className="mt-4 bg-green-50 border-green-200 text-green-800"
            />
          )}

          {manifestData && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-medium">Review & Sync</h3>
              <Textarea
                {...register('manifest')}
                rows={20}
                className="font-mono text-sm"
                placeholder="JSON manifest will appear here..."
              />
              <Button onClick={handleSubmit(onSync)} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sync to Database'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
