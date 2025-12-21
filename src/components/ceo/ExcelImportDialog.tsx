import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface StaffMember {
  user_id: string;
  full_name: string;
  phone_number: string;
  code?: string;
}

interface ParsedDailyReport {
  date: string;
  staffReports: {
    staffName: string;
    workStatus: 'حاضر' | 'غایب';
    overtimeHours: number;
    amountReceived: number;
    receivingNotes: string;
    amountSpent: number;
    spendingNotes: string;
    notes: string;
    isCashBox: boolean;
  }[];
  orderReports: {
    projectName: string;
    activityDescription: string;
    serviceDetails: string;
    teamName: string;
    notes: string;
  }[];
}

interface ExcelImportDialogProps {
  onImportComplete: (reports: ParsedDailyReport[]) => void;
  knownStaffMembers: StaffMember[];
}

export function ExcelImportDialog({ onImportComplete, knownStaffMembers }: ExcelImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'reading' | 'parsing' | 'saving' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<{ total: number; parsed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('لطفاً یک فایل اکسل (.xlsx یا .xls) انتخاب کنید');
        return;
      }
      setFile(selectedFile);
      setStatus('idle');
      setResults(null);
    }
  };

  const processExcel = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(10);
    setStatus('reading');

    try {
      // Read Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      setProgress(30);
      setStatus('parsing');

      // Extract data from each sheet
      const sheetsData: { sheetName: string; rows: string[][] }[] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { 
          header: 1,
          defval: ''
        });
        
        // Filter out completely empty rows
        const filteredRows = jsonData.filter((row: string[]) => 
          row.some((cell: string) => cell && String(cell).trim())
        );
        
        if (filteredRows.length > 0) {
          sheetsData.push({
            sheetName,
            rows: filteredRows.map((row: string[]) => row.map((cell: string) => String(cell || '')))
          });
        }
      }

      console.log('Extracted', sheetsData.length, 'sheets with data');
      setProgress(50);

      // Prepare staff members with codes extracted from names
      const staffWithCodes = knownStaffMembers.map(s => ({
        ...s,
        code: extractCode(s.full_name) || s.phone_number?.slice(-4) || ''
      }));

      // Send to edge function for AI processing
      const { data, error } = await supabase.functions.invoke('parse-excel-report', {
        body: {
          sheetsData,
          knownStaffMembers: staffWithCodes
        }
      });

      setProgress(90);

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'خطا در پردازش فایل');
      }

      setResults({ total: data.totalSheets, parsed: data.parsedSheets });
      setStatus('done');
      setProgress(100);

      if (data.reports && data.reports.length > 0) {
        toast.success(`${data.parsedSheets} گزارش از ${data.totalSheets} شیت استخراج شد`);
        onImportComplete(data.reports);
      } else {
        toast.warning('هیچ گزارش قابل استخراجی یافت نشد');
      }

    } catch (error) {
      console.error('Error processing Excel:', error);
      setStatus('error');
      toast.error(error instanceof Error ? error.message : 'خطا در پردازش فایل');
    } finally {
      setProcessing(false);
    }
  };

  const extractCode = (name: string): string => {
    const match = name.match(/\b\d{4,6}\b/);
    return match ? match[0] : '';
  };

  const resetDialog = () => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'reading': return 'در حال خواندن فایل اکسل...';
      case 'parsing': return 'در حال پردازش با هوش مصنوعی...';
      case 'saving': return 'در حال ذخیره گزارشات...';
      case 'done': return 'پردازش با موفقیت انجام شد';
      case 'error': return 'خطا در پردازش';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetDialog();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          ورود از اکسل
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            ورود گزارشات از فایل اکسل
          </DialogTitle>
          <DialogDescription>
            فایل اکسل گزارشات روزانه را آپلود کنید. هر شیت به عنوان یک روز جداگانه پردازش می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload Area */}
          <div 
            className={`
              border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${file ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted-foreground/30 hover:border-primary/50'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="excel-upload"
            />
            
            {file ? (
              <div className="space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                </div>
                <p className="font-medium text-green-700 dark:text-green-400">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetDialog}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 ml-1" />
                  انتخاب فایل دیگر
                </Button>
              </div>
            ) : (
              <label htmlFor="excel-upload" className="cursor-pointer space-y-3 block">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">فایل اکسل را اینجا رها کنید یا کلیک کنید</p>
                  <p className="text-sm text-muted-foreground">فرمت‌های پشتیبانی شده: xlsx, xls</p>
                </div>
              </label>
            )}
          </div>

          {/* Progress */}
          {processing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {getStatusText()}
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Results */}
          {status === 'done' && results && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <Check className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  پردازش با موفقیت انجام شد
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  {results.parsed} گزارش از {results.total} شیت استخراج شد
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-medium text-destructive">خطا در پردازش</p>
                <p className="text-sm text-destructive/80">لطفاً مجدداً تلاش کنید</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              بستن
            </Button>
            <Button 
              onClick={processExcel} 
              disabled={!file || processing}
              className="gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال پردازش...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  شروع پردازش
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
