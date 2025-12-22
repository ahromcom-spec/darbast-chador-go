import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, X, Sparkles, MessageSquare, Image, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionImages, setInstructionImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    // Reset input value to allow selecting the same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleUploadClick = () => {
    // Always reset the input before clicking to ensure same file can be selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages: { file: File; preview: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          newImages.push({
            file,
            preview: URL.createObjectURL(file)
          });
        }
      }
      setInstructionImages(prev => [...prev, ...newImages]);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeInstructionImage = (index: number) => {
    setInstructionImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

      // Convert images to base64
      const imageBase64List: string[] = [];
      for (const img of instructionImages) {
        const base64 = await convertImageToBase64(img.file);
        imageBase64List.push(base64);
      }

      // Send to edge function for AI processing
      const { data, error } = await supabase.functions.invoke('parse-excel-report', {
        body: {
          sheetsData,
          knownStaffMembers: staffWithCodes,
          customInstructions: customInstructions.trim() || undefined,
          instructionImages: imageBase64List.length > 0 ? imageBase64List : undefined
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
    setCustomInstructions('');
    setShowInstructions(false);
    // Clean up image previews
    instructionImages.forEach(img => URL.revokeObjectURL(img.preview));
    setInstructionImages([]);
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            ورود گزارشات از فایل اکسل
          </DialogTitle>
          <DialogDescription>
            فایل اکسل گزارشات روزانه را آپلود کنید. هر شیت به عنوان یک روز جداگانه پردازش می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Area */}
          <div 
            className={`
              border-2 border-dashed rounded-xl p-6 text-center transition-colors
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
              onClick={handleUploadClick}
            />
            
            {file ? (
              <div className="space-y-2">
                <div className="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <FileSpreadsheet className="h-7 w-7 text-green-600" />
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
                <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">فایل اکسل را اینجا رها کنید یا کلیک کنید</p>
                  <p className="text-sm text-muted-foreground">فرمت‌های پشتیبانی شده: xlsx, xls</p>
                </div>
              </label>
            )}
          </div>

          {/* AI Instructions Section */}
          <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between gap-2 text-primary hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>توضیحات اختصاصی برای هوش مصنوعی</span>
                </div>
                <MessageSquare className={`h-4 w-4 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-2 text-sm text-primary">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    هوش مصنوعی مانند یک کارمند حرفه‌ای با شما همکاری می‌کند. 
                    هرچه توضیحات دقیق‌تر بدهید، نتیجه بهتری خواهید گرفت.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-instructions" className="text-sm font-medium">
                    توضیحات و دستورات خاص:
                  </Label>
                  <Textarea
                    id="custom-instructions"
                    placeholder={`مثال‌ها:
- ستون اول نام نیرو است و ستون دوم ساعت کارکرد
- اگر عدد صفر در ستون کارکرد بود یعنی غایب است
- مبالغ به تومان هستند نه ریال
- ردیف‌هایی که رنگ زرد دارند مهم هستند
- تاریخ را از نام شیت استخراج کن
- فقط اطلاعات نیروها را استخراج کن، سفارشات مهم نیست`}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="min-h-[120px] text-sm resize-none"
                    dir="rtl"
                  />
                </div>

                {/* Image Upload Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    تصاویر کمکی (اختیاری):
                  </Label>
                  
                  <div className="flex flex-wrap gap-2">
                    {instructionImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={img.preview} 
                          alt={`تصویر ${index + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removeInstructionImage(index)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    <label 
                      htmlFor="instruction-image-upload"
                      className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Plus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">افزودن</span>
                    </label>
                    
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                      id="instruction-image-upload"
                    />
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    📷 می‌توانید اسکرین‌شات از اکسل یا توضیحات بیشتر را اینجا اضافه کنید.
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  💡 هرچه توضیحات شما دقیق‌تر باشد، هوش مصنوعی بهتر می‌تواند داده‌ها را استخراج کند.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
