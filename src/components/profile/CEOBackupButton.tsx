import { useState } from 'react';
import { Database, Download, Loader2, CheckCircle2, AlertCircle, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { cacheSet } from '@/lib/offlineDb';
import { toast } from 'sonner';

type BackupStatus = 'idle' | 'fetching' | 'saving' | 'done' | 'error';

interface BackupData {
  version: number;
  created_at: string;
  created_by: string;
  tables: Record<string, any[]>;
  table_counts: Record<string, number>;
  total_records: number;
  errors?: string[];
}

export function CEOBackupButton() {
  const [status, setStatus] = useState<BackupStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);

  const runBackup = async () => {
    setStatus('fetching');
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('لطفاً ابتدا وارد حساب کاربری شوید');
        setStatus('error');
        return;
      }

      setProgress(20);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('full-backup', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      const backupData = data as BackupData;

      if (backupData.errors && backupData.errors.length > 0) {
        console.warn('Backup warnings:', backupData.errors);
      }

      setProgress(60);
      setStatus('saving');
      setTotalRecords(backupData.total_records);

      // Save to IndexedDB
      await cacheSet('full_backup:latest', backupData);
      await cacheSet('full_backup:meta', {
        created_at: backupData.created_at,
        total_records: backupData.total_records,
        table_counts: backupData.table_counts,
      });

      // Save each table separately for granular offline access
      const tables = Object.entries(backupData.tables);
      for (let i = 0; i < tables.length; i++) {
        const [tableName, tableData] = tables[i];
        await cacheSet(`full_backup:table:${tableName}`, tableData);
        setProgress(60 + Math.round((i / tables.length) * 30));
      }

      setProgress(95);

      // Also trigger download
      downloadBackup(backupData);

      setProgress(100);
      setStatus('done');
      setLastBackup(backupData.created_at);

      toast.success(`بک‌اپ با موفقیت ذخیره شد - ${backupData.total_records.toLocaleString('fa-IR')} رکورد`);
    } catch (err: any) {
      console.error('Backup error:', err);
      setStatus('error');
      toast.error('خطا در تهیه بک‌اپ: ' + (err.message || 'خطای ناشناخته'));
    }
  };

  const downloadBackup = (data: BackupData) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ahrom-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadFromCache = async () => {
    try {
      const { cacheGet } = await import('@/lib/offlineDb');
      const data = await cacheGet<BackupData>('full_backup:latest');
      if (data) {
        downloadBackup(data);
        toast.success('فایل بک‌اپ دانلود شد');
      } else {
        toast.error('بک‌اپی در حافظه موجود نیست');
      }
    } catch {
      toast.error('خطا در خواندن بک‌اپ از حافظه');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={runBackup}
          disabled={status === 'fetching' || status === 'saving'}
          variant="outline"
          className="flex items-center gap-2 border-primary/30 hover:bg-primary/5"
        >
          {status === 'fetching' || status === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === 'done' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : status === 'error' ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Database className="h-4 w-4 text-primary" />
          )}
          <span>
            {status === 'fetching' ? 'در حال دریافت داده‌ها...' :
             status === 'saving' ? 'در حال ذخیره...' :
             status === 'done' ? 'بک‌اپ تکمیل شد' :
             status === 'error' ? 'خطا - تلاش مجدد' :
             'تهیه بک‌اپ کامل'}
          </span>
        </Button>

        <Button
          onClick={downloadFromCache}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Download className="h-4 w-4" />
          <span>دانلود آخرین بک‌اپ</span>
        </Button>
      </div>

      {(status === 'fetching' || status === 'saving') && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {status === 'fetching' ? 'دریافت داده‌ها از سرور...' : 'ذخیره در حافظه مرورگر...'}
          </p>
        </div>
      )}

      {status === 'done' && totalRecords > 0 && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg p-2">
          <HardDrive className="h-3 w-3" />
          <span>
            {totalRecords.toLocaleString('fa-IR')} رکورد ذخیره شد
            {lastBackup && ` - ${new Date(lastBackup).toLocaleString('fa-IR')}`}
          </span>
        </div>
      )}
    </div>
  );
}
