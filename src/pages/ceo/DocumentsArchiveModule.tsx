import { useMemo, useState } from 'react';
import { ModuleHeader } from '@/components/common/ModuleHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Archive,
  Download,
  Eye,
  FileDown,
  FileText,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPersianDate } from '@/lib/dateUtils';
import {
  ArchiveDoc,
  ArchiveFilters,
  ArchiveFormat,
  DAILY_REPORT_MODULES,
  DOC_KIND_LABEL,
  buildArchiveZip,
  downloadBlob,
  fetchArchiveDocs,
  htmlToPdfBlob,
  safeFileName,
} from '@/lib/documentsArchive';

const faNum = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

export default function DocumentsArchiveModule() {
  const [filters, setFilters] = useState<ArchiveFilters>({
    includeOrders: true,
    includeStatements: true,
    includeDailyReports: true,
    fromDate: null,
    toDate: null,
    search: '',
    moduleKey: 'all',
    statementStatus: 'all',
    onlyPaidOrders: false,
  });
  const [docs, setDocs] = useState<ArchiveDoc[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [singleBusy, setSingleBusy] = useState<string | null>(null);
  const [zipFormat, setZipFormat] = useState<ArchiveFormat>('html');

  const set = <K extends keyof ArchiveFilters>(k: K, v: ArchiveFilters[K]) =>
    setFilters((p) => ({ ...p, [k]: v }));

  const load = async () => {
    if (!filters.includeOrders && !filters.includeStatements && !filters.includeDailyReports) {
      toast.error('حداقل یک نوع سند را انتخاب کنید');
      return;
    }
    setLoading(true);
    try {
      const list = await fetchArchiveDocs(filters);
      setDocs(list);
      const sel: Record<string, boolean> = {};
      list.forEach((d) => (sel[d.id] = true));
      setSelected(sel);
      toast.success(`${faNum(list.length)} سند آماده شد`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'خطا در دریافت اسناد');
    } finally {
      setLoading(false);
    }
  };

  const selectedDocs = useMemo(() => docs.filter((d) => selected[d.id]), [docs, selected]);

  const counts = useMemo(() => {
    const c = { order: 0, statement: 0, daily_report: 0 } as Record<string, number>;
    docs.forEach((d) => (c[d.kind] += 1));
    return c;
  }, [docs]);

  const downloadZip = async () => {
    if (!selectedDocs.length) {
      toast.error('هیچ سندی انتخاب نشده است');
      return;
    }
    setZipping(true);
    setProgress({ done: 0, total: selectedDocs.length, current: '' });
    try {
      const blob = await buildArchiveZip(selectedDocs, (done, total, current) =>
        setProgress({ done, total, current }),
      );
      const stamp = formatPersianDate(new Date()).replace(/\//g, '-');
      downloadBlob(blob, `اسناد-اهرم-${stamp}.zip`);
      toast.success('فایل زیپ دانلود شد');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'خطا در ساخت فایل زیپ');
    } finally {
      setZipping(false);
      setProgress(null);
    }
  };

  const singlePdf = async (doc: ArchiveDoc, mode: 'download' | 'view') => {
    setSingleBusy(doc.id);
    try {
      const blob = await htmlToPdfBlob(doc.html);
      if (mode === 'download') downloadBlob(blob, `${safeFileName(doc.title)}.pdf`);
      else {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (e: any) {
      toast.error(e.message || 'خطا در ساخت فایل PDF');
    } finally {
      setSingleBusy(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 pb-10" dir="rtl">
      <ModuleHeader
        title="آرشیو و دانلود اسناد"
        description="دانلود فاکتور سفارش‌ها، صورتحساب‌ها و گزارشات روزانه به صورت PDF داخل یک فایل زیپ"
        icon={<Archive className="h-5 w-5" />}
        backTo="/profile?tab=modules"
      />

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">فیلترها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {[
              ['includeOrders', 'فاکتور سفارش‌ها'],
              ['includeStatements', 'صورتحساب‌های مشتریان'],
              ['includeDailyReports', 'گزارشات روزانه'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={Boolean(filters[key as keyof ArchiveFilters])}
                  onCheckedChange={(v) => set(key as any, Boolean(v) as any)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">از تاریخ</Label>
              <PersianDatePicker
                value={filters.fromDate || undefined}
                onChange={(v) => set('fromDate', v)}
                timeMode="none"
                placeholder="بدون محدودیت"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">تا تاریخ</Label>
              <PersianDatePicker
                value={filters.toDate || undefined}
                onChange={(v) => set('toDate', v)}
                timeMode="none"
                placeholder="بدون محدودیت"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">جستجو (کد سفارش، نام، آدرس)</Label>
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pr-8"
                  value={filters.search || ''}
                  onChange={(e) => set('search', e.target.value)}
                  placeholder="جستجو..."
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ماژول گزارش روزانه</Label>
              <Select value={filters.moduleKey} onValueChange={(v) => set('moduleKey', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه ماژول‌ها</SelectItem>
                  {DAILY_REPORT_MODULES.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">وضعیت صورتحساب</Label>
              <Select
                value={filters.statementStatus}
                onValueChange={(v) => set('statementStatus', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="open">باز</SelectItem>
                  <SelectItem value="closed">بسته شده</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={Boolean(filters.onlyPaidOrders)}
              onCheckedChange={(v) => set('onlyPaidOrders', Boolean(v))}
            />
            فقط سفارش‌های پرداخت‌شده
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={load} disabled={loading || zipping} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              آماده‌سازی فهرست اسناد
            </Button>
            <Button
              onClick={downloadZip}
              disabled={zipping || loading || !selectedDocs.length}
              variant="default"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              دانلود زیپ ({faNum(selectedDocs.length)})
            </Button>
          </div>

          {progress && (
            <div className="text-xs text-muted-foreground">
              در حال ساخت PDF: {faNum(progress.done)} از {faNum(progress.total)} — {progress.current}
            </div>
          )}
        </CardContent>
      </Card>

      {docs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">اسناد یافت‌شده ({faNum(docs.length)})</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">سفارش: {faNum(counts.order)}</Badge>
                <Badge variant="outline">صورتحساب: {faNum(counts.statement)}</Badge>
                <Badge variant="outline">گزارش روزانه: {faNum(counts.daily_report)}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const all = selectedDocs.length !== docs.length;
                    const sel: Record<string, boolean> = {};
                    docs.forEach((d) => (sel[d.id] = all));
                    setSelected(sel);
                  }}
                >
                  {selectedDocs.length === docs.length ? 'برداشتن همه' : 'انتخاب همه'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] pr-2">
              <div className="space-y-2">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 bg-card"
                  >
                    <Checkbox
                      checked={Boolean(selected[d.id])}
                      onCheckedChange={(v) => setSelected((p) => ({ ...p, [d.id]: Boolean(v) }))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">{d.title}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {DOC_KIND_LABEL[d.kind]}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">{d.subtitle}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {d.date ? formatPersianDate(d.date) : '-'}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={singleBusy === d.id}
                        onClick={() => singlePdf(d, 'view')}
                      >
                        {singleBusy === d.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                        مشاهده
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={singleBusy === d.id}
                        onClick={() => singlePdf(d, 'download')}
                      >
                        <FileDown className="h-3 w-3" />
                        PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
