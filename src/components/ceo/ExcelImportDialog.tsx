import { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, X, Sparkles, MessageSquare, Image, Plus, Clock, Trash2, FolderOpen } from 'lucide-react';
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
import { useRecentExcelFiles } from '@/hooks/useRecentExcelFiles';
import { useFileSystemAccess } from '@/hooks/useFileSystemAccess';

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
  type SelectedExcel = { name: string; size: number; buffer: ArrayBuffer };

  const [open, setOpen] = useState(false);
  const [selectedExcel, setSelectedExcel] = useState<SelectedExcel | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'reading' | 'parsing' | 'saving' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<{ total: number; parsed: number } | null>(null);
  const [processingReport, setProcessingReport] = useState<{
    actionsPerformed: string[];
    itemsIgnored: string[];
    warnings: string[];
    needsUserInput: string[];
  } | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionImages, setInstructionImages] = useState<{ file: File; preview: string }[]>([]);
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [progressLogs, setProgressLogs] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);
  const [currentSheet, setCurrentSheet] = useState<{ index: number; name: string; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recentFilesSectionRef = useRef<HTMLDivElement>(null);
  const progressLogsRef = useRef<HTMLDivElement>(null);

  // Recent files and File System Access hooks
  const { recentFiles, addRecentFile, removeRecentFile } = useRecentExcelFiles();
  const { isSupported: fsApiSupported, openFilePicker } = useFileSystemAccess();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    // Always reset input so selecting the same file again triggers change
    if (e.target) {
      e.target.value = '';
    }

    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('لطفاً یک فایل اکسل (.xlsx یا .xls) انتخاب کنید');
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      console.log('[ExcelImportDialog] excel selected:', selectedFile.name, selectedFile.size);
      const excelData = { name: selectedFile.name, size: selectedFile.size, buffer };
      setSelectedExcel(excelData);
      addRecentFile(excelData);
      setStatus('idle');
      setResults(null);
      setProgress(0);
      setShowRecentFiles(false);
    } catch (error) {
      console.error('[ExcelImportDialog] error reading excel:', error);
      toast.error('خطا در خواندن فایل اکسل');
    }
  };

  // Select from recent files
  const selectRecentFile = (file: { name: string; size: number; buffer: ArrayBuffer }) => {
    setSelectedExcel(file);
    addRecentFile(file); // Move to top of recent list
    setStatus('idle');
    setResults(null);
    setProgress(0);
    setShowRecentFiles(false);
    toast.success(`فایل "${file.name}" انتخاب شد`);
  };

  // Use File System Access API if supported
  const openWithFsApi = async () => {
    const result = await openFilePicker();
    if (result) {
      setSelectedExcel(result);
      addRecentFile(result);
      setStatus('idle');
      setResults(null);
      setProgress(0);
      setShowRecentFiles(false);
    }
  };

  const openNewFilePicker = () => {
    if (fsApiSupported) {
      openWithFsApi();
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const openExcelPicker = () => {
    // Prefer "Recent files" first to avoid Windows/Excel lock issues (This file is in use)
    if (recentFiles.length > 0) {
      setShowRecentFiles(true);
      toast.message('برای استفاده از همان فایل قبلی، از «فایل‌های اخیر» انتخاب کنید. برای فایل جدید، دکمه «انتخاب فایل جدید» را بزنید.');
      return;
    }

    openNewFilePicker();
  };

  useEffect(() => {
    // Make "Recent files" visible by default when the dialog opens (reduces need to re-pick locked files)
    if (open && recentFiles.length > 0 && !selectedExcel) {
      setShowRecentFiles(true);
    }
  }, [open, recentFiles.length, selectedExcel]);

  useEffect(() => {
    if (!showRecentFiles) return;

    const t = window.setTimeout(() => {
      recentFilesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    return () => window.clearTimeout(t);
  }, [showRecentFiles]);

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
    if (!selectedExcel) return;

    setProcessing(true);
    setProgress(5);
    setStatus('reading');
    setProgressLogs([]);
    setCurrentSheet(null);

    try {
      // Read Excel file from memory buffer (prevents OS "file is in use" lock issues)
      setProgressLogs(prev => [...prev, { message: 'خواندن فایل اکسل...', type: 'info' }]);
      const workbook = XLSX.read(selectedExcel.buffer, { type: 'array' });
      
      setProgress(15);
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

      setProgressLogs(prev => [...prev, { message: `${sheetsData.length} شیت با داده یافت شد`, type: 'info' }]);
      setProgress(20);

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

      setProgressLogs(prev => [...prev, { message: 'ارسال به هوش مصنوعی برای پردازش...', type: 'info' }]);

      // Use streaming for real-time progress with extended timeout
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Create AbortController with 10 minute timeout for large files
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

      let response: Response;
      try {
        response = await fetch(`${supabaseUrl}/functions/v1/parse-excel-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            sheetsData,
            knownStaffMembers: staffWithCodes,
            customInstructions: customInstructions.trim() || undefined,
            instructionImages: imageBase64List.length > 0 ? imageBase64List : undefined,
            streaming: true
          }),
          signal: controller.signal
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('پردازش بیش از حد طول کشید. لطفا فایل کوچکتری امتحان کنید یا تعداد شیت‌ها را کاهش دهید.');
        }
        throw fetchError;
      }

      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(`خطا در ارتباط با سرور: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: any = null;

      if (reader) {
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              
              try {
                const event = JSON.parse(jsonStr);
                
                switch (event.type) {
                  case 'start':
                    setProgressLogs(prev => [...prev, { message: event.message, type: 'info' }]);
                    setCurrentSheet({ index: 0, name: '', total: event.totalSheets });
                    break;
                    
                  case 'progress':
                    setCurrentSheet({ index: event.sheetIndex, name: event.sheetName, total: sheetsData.length });
                    setProgress(20 + ((event.sheetIndex / sheetsData.length) * 70));
                    // Show step-specific message
                    if (event.step === 'ai_processing') {
                      setProgressLogs(prev => [...prev, { message: event.message, type: 'info' }]);
                    }
                    break;
                    
                  case 'sheet_done':
                    setProgressLogs(prev => [...prev, { message: event.message, type: 'success' }]);
                    break;
                    
                  case 'sheet_empty':
                    setProgressLogs(prev => [...prev, { message: event.message, type: 'warning' }]);
                    break;
                    
                  case 'warning':
                    setProgressLogs(prev => [...prev, { message: event.message, type: 'warning' }]);
                    break;
                    
                  case 'error':
                    setProgressLogs(prev => [...prev, { message: event.message, type: 'error' }]);
                    break;
                    
                  case 'complete':
                    finalData = event;
                    setProgress(95);
                    break;
                    
                  case 'done':
                    setProgress(100);
                    break;
                }
                
                // Auto-scroll logs
                setTimeout(() => {
                  progressLogsRef.current?.scrollTo({
                    top: progressLogsRef.current.scrollHeight,
                    behavior: 'smooth'
                  });
                }, 50);
                
              } catch (e) {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }
      }

      // Clear timeout after successful read
      clearTimeout(timeoutId);

      if (finalData) {
        setResults({ total: finalData.totalSheets, parsed: finalData.parsedSheets });
        setProcessingReport(finalData.processingReport || null);
        setStatus('done');
        setCurrentSheet(null);

        if (finalData.reports && finalData.reports.length > 0) {
          toast.success(`${finalData.parsedSheets} گزارش از ${finalData.totalSheets} شیت استخراج شد`);
          onImportComplete(finalData.reports);
        } else {
          toast.warning('هیچ گزارش قابل استخراجی یافت نشد');
        }
      } else {
        throw new Error('پاسخی از سرور دریافت نشد');
      }

    } catch (error) {
      console.error('Error processing Excel:', error);
      setStatus('error');
      setProgressLogs(prev => [...prev, { message: `خطا: ${error instanceof Error ? error.message : 'خطای نامشخص'}`, type: 'error' }]);
      toast.error(error instanceof Error ? error.message : 'خطا در پردازش فایل');
    } finally {
      setProcessing(false);
      setCurrentSheet(null);
    }
  };

  const extractCode = (name: string): string => {
    const match = name.match(/\b\d{4,6}\b/);
    return match ? match[0] : '';
  };

  const resetDialog = () => {
    setSelectedExcel(null);
    setStatus('idle');
    setProgress(0);
    setResults(null);
    setProcessingReport(null);
    setCustomInstructions('');
    setShowInstructions(false);
    setShowRecentFiles(false);
    setProgressLogs([]);
    setCurrentSheet(null);
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
          {recentFiles.length > 0 && !selectedExcel && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">آخرین فایل استفاده‌شده</p>
                  <p className="text-xs text-muted-foreground truncate">{recentFiles[0].name}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => selectRecentFile(recentFiles[0])}
                >
                  انتخاب
                </Button>
              </div>
            </div>
          )}

          {/* File Upload Area */}
          <div 
            className={`
              border-2 border-dashed rounded-xl p-6 text-center transition-colors
              ${selectedExcel ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-muted-foreground/30 hover:border-primary/50'}
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
            
            {selectedExcel ? (
              <div className="space-y-2">
                <div className="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <FileSpreadsheet className="h-7 w-7 text-green-600" />
                </div>
                <p className="font-medium text-green-700 dark:text-green-400">{selectedExcel.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedExcel.size / 1024).toFixed(1)} KB
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {recentFiles.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowRecentFiles(true)}
                      className="gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      انتخاب از فایل‌های اخیر
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={openNewFilePicker}
                    className="text-muted-foreground gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    انتخاب فایل جدید
                  </Button>
                </div>
              </div>
            ) : (
              <div className="cursor-pointer space-y-3" onClick={(e) => { e.preventDefault(); openExcelPicker(); }}>
                <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">فایل اکسل را اینجا رها کنید یا کلیک کنید</p>
                  <p className="text-sm text-muted-foreground">فرمت‌های پشتیبانی شده: xlsx, xls</p>
                </div>
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              اگر هنگام انتخاب فایل پیام <span className="font-medium">This file is in use</span> دیدید، یعنی فایل داخل Excel باز است.
              در این حالت یا Excel را ببندید/یک کپی با نام جدید ذخیره کنید، یا از بخش «فایل‌های اخیر» همینجا فایل قبلی را انتخاب کنید.
            </p>
          </div>

          {/* Recent Files Section */}
          {recentFiles.length > 0 && (
            <div ref={recentFilesSectionRef} className="scroll-mt-4">
              <Collapsible open={showRecentFiles} onOpenChange={setShowRecentFiles}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between gap-2 text-muted-foreground hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>فایل‌های اخیر ({recentFiles.length})</span>
                    </div>
                    <FolderOpen className={`h-4 w-4 transition-transform ${showRecentFiles ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      روی هر فایل کلیک کنید تا مستقیم انتخاب شود
                    </p>
                    {recentFiles.map((file, index) => (
                      <div 
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between p-2 rounded-md bg-background hover:bg-accent/50 cursor-pointer transition-colors group"
                        onClick={() => selectRecentFile(file)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentFile(file.name);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

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
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {currentSheet ? (
                    <span>پردازش شیت {currentSheet.index} از {currentSheet.total}: "{currentSheet.name}"</span>
                  ) : (
                    getStatusText()
                  )}
                </div>
                {currentSheet && (
                  <span className="text-xs text-primary font-medium">
                    {Math.round(progress)}%
                  </span>
                )}
              </div>
              <Progress value={progress} className="h-2" />
              
              {/* Real-time progress logs */}
              {progressLogs.length > 0 && (
                <div 
                  ref={progressLogsRef}
                  className="max-h-32 overflow-y-auto rounded-lg border bg-muted/30 p-2 space-y-1 text-xs"
                >
                  {progressLogs.map((log, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-start gap-2 ${
                        log.type === 'success' ? 'text-green-600 dark:text-green-400' :
                        log.type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                        log.type === 'error' ? 'text-destructive' :
                        'text-muted-foreground'
                      }`}
                    >
                      {log.type === 'success' && <Check className="h-3 w-3 mt-0.5 shrink-0" />}
                      {log.type === 'warning' && <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />}
                      {log.type === 'error' && <X className="h-3 w-3 mt-0.5 shrink-0" />}
                      {log.type === 'info' && <Loader2 className="h-3 w-3 mt-0.5 shrink-0 animate-spin" />}
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {status === 'done' && results && (
            <div className="space-y-4">
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

              {/* Processing Report */}
              {processingReport && (
                <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    گزارش پردازش هوش مصنوعی
                  </h4>

                  {/* Actions Performed */}
                  {processingReport.actionsPerformed.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        کارهای انجام شده:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mr-4 list-disc">
                        {processingReport.actionsPerformed.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Items Ignored */}
                  {processingReport.itemsIgnored.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <X className="h-3 w-3" />
                        موارد نادیده گرفته شده:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 mr-4 list-disc">
                        {processingReport.itemsIgnored.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {processingReport.warnings.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        هشدارها:
                      </p>
                      <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5 mr-4 list-disc">
                        {processingReport.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Needs User Input */}
                  {processingReport.needsUserInput.length > 0 && (
                    <div className="space-y-1 p-2 rounded bg-primary/10 border border-primary/20">
                      <p className="text-xs font-medium text-primary flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        نیاز به توضیحات بیشتر:
                      </p>
                      <ul className="text-xs text-primary space-y-0.5 mr-4 list-disc">
                        {processingReport.needsUserInput.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 این موارد را در بخش "توضیحات اختصاصی برای هوش مصنوعی" وارد کنید و دوباره پردازش کنید.
                      </p>
                    </div>
                  )}
                </div>
              )}
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
              disabled={!selectedExcel || processing}
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
