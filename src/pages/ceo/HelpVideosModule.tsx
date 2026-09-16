import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, PlayCircle, Plus, Pencil, Trash2, Upload, Loader2, Search, Video, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { HelpContextPicker, type HelpPlacement } from '@/components/help/HelpContextPicker';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useCEORole } from '@/hooks/useCEORole';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { useHelpVideosAdmin, type HelpVideo } from '@/hooks/useHelpVideos';
import { getContextLabel } from '@/lib/helpVideoContexts';
import { ContextualVideoHelp } from '@/components/help/ContextualVideoHelp';

const emptyForm = {
  context_key: '',
  title: '',
  description: '',
  video_url: '',
  storage_path: '' as string | null,
  is_active: true,
  placement: 'anchor' as 'anchor' | 'floating',
  page_route: null as string | null,
  pos_x: null as number | null,
  pos_y: null as number | null,
  box_size: 56,
  pos_x_mobile: null as number | null,
  pos_y_mobile: null as number | null,
  box_size_mobile: null as number | null,
};

export default function HelpVideosModule() {
  const navigate = useNavigate();
  const { isCEO, loading: ceoLoading } = useCEORole();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isGeneralManager, loading: gmLoading } = useGeneralManagerRole();
  const { videos, loading, saveVideo, toggleActive, deleteVideo, uploadVideoFile } = useHelpVideosAdmin();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HelpVideo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');

  const canManage = isCEO || isAdmin || isGeneralManager;
  const rolesLoading = ceoLoading || adminLoading || gmLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q) ||
        v.context_key.toLowerCase().includes(q) ||
        getContextLabel(v.context_key).toLowerCase().includes(q)
    );
  }, [videos, search]);


  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (video: HelpVideo) => {
    setEditing(video);
    setForm({
      context_key: video.context_key,
      title: video.title,
      description: video.description || '',
      video_url: video.video_url,
      storage_path: video.storage_path,
      is_active: video.is_active,
      placement: (video.placement === 'floating' ? 'floating' : 'anchor'),
      page_route: video.page_route,
      pos_x: video.pos_x,
      pos_y: video.pos_y,
      box_size: video.box_size || 56,
      pos_x_mobile: video.pos_x_mobile,
      pos_y_mobile: video.pos_y_mobile,
      box_size_mobile: video.box_size_mobile,
    });
    setDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setUploadPercent(0);
      setUploadFileName(file.name);
      const result = await uploadVideoFile(file, (p) => setUploadPercent(p));
      setForm((f) => ({ ...f, storage_path: result.storage_path, video_url: result.video_url }));
      toast({ title: 'ویدیو بارگذاری شد', description: 'حالا عنوان و محل نمایش را ثبت کنید.' });
    } catch (err: any) {
      toast({ title: 'خطا در بارگذاری ویدیو', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.context_key) {
      toast({ title: 'محل نمایش راهنما را انتخاب کنید', variant: 'destructive' });
      return;
    }
    if (!form.title.trim()) {
      toast({ title: 'عنوان راهنما را وارد کنید', variant: 'destructive' });
      return;
    }
    if (!form.video_url.trim()) {
      toast({ title: 'فایل ویدیو را بارگذاری کنید یا لینک ویدیو را وارد کنید', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await saveVideo(
        {
          context_key: form.context_key,
          title: form.title.trim(),
          description: form.description.trim() || null,
          video_url: form.video_url.trim(),
          storage_path: form.storage_path || null,
          is_active: form.is_active,
          placement: form.placement,
          page_route: form.page_route,
          pos_x: form.pos_x,
          pos_y: form.pos_y,
          box_size: form.box_size,
          pos_x_mobile: form.pos_x_mobile,
          pos_y_mobile: form.pos_y_mobile,
          box_size_mobile: form.box_size_mobile,
        },
        editing?.id
      );
      toast({ title: 'راهنمای ویدیویی ذخیره شد' });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'خطا در ذخیره راهنما', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (video: HelpVideo) => {
    if (!window.confirm(`راهنمای «${video.title}» حذف شود؟`)) return;
    try {
      await deleteVideo(video);
      toast({ title: 'راهنما حذف شد' });
    } catch (err: any) {
      toast({ title: 'خطا در حذف راهنما', description: err?.message, variant: 'destructive' });
    }
  };

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <p className="text-muted-foreground">شما به این ماژول دسترسی ندارید.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>بازگشت</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">ماژول راهنماهای ویدیویی سایت</h1>
            <p className="text-sm text-muted-foreground">
              برای هر صفحه، تب یا فرم یک فیلم آموزشی ثبت کنید تا در همان بخش به کاربران نمایش داده شود.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" />
            راهنمای جدید
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-1.5">
            بازگشت
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-primary" />
            راهنماهای ثبت‌شده ({videos.length})
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو بر اساس عنوان، توضیح یا محل نمایش..."
              className="pr-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              هنوز راهنمای ویدیویی ثبت نشده است.
            </p>
          ) : (
            filtered.map((video) => (
              <div
                key={video.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{video.title}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {getContextLabel(video.context_key)}
                    </Badge>
                    {video.is_active ? (
                      <Badge className="text-[11px] bg-green-600 hover:bg-green-600">فعال</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px]">غیرفعال</Badge>
                    )}
                  </div>
                  {video.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ContextualVideoHelp contextKey={video.context_key} label="پیش‌نمایش" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={video.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                    onClick={() => toggleActive(video.id, !video.is_active)}
                  >
                    {video.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(video)} title="ویرایش">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(video)}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>{editing ? 'ویرایش راهنمای ویدیویی' : 'ثبت راهنمای ویدیویی جدید'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>محل نمایش راهنما</Label>
              <HelpContextPicker
                value={form.context_key}
                onChange={(v) => setForm((f) => ({ ...f, context_key: v }))}
                placement={{
                  placement: form.placement,
                  page_route: form.page_route,
                  pos_x: form.pos_x,
                  pos_y: form.pos_y,
                  box_size: form.box_size,
                }}
                onPlacementChange={(pl: HelpPlacement) =>
                  setForm((f) => ({
                    ...f,
                    placement: pl.placement,
                    page_route: pl.page_route,
                    pos_x: pl.pos_x,
                    pos_y: pl.pos_y,
                    box_size: pl.box_size,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>عنوان راهنما</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: نحوه ثبت سفارش داربست"
              />
            </div>

            <div className="space-y-1.5">
              <Label>توضیح کوتاه (اختیاری)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="در چند خط توضیح دهید این فیلم چه چیزی را آموزش می‌دهد."
              />
            </div>

            <div className="space-y-1.5">
              <Label>فایل ویدیو</Label>
              <div className="flex items-center gap-2">
                <input
                  id="help-video-file"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={uploading}
                  onClick={() => document.getElementById('help-video-file')?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  بارگذاری فیلم ضبط‌شده
                </Button>
                {form.storage_path && !uploading && (
                  <span className="text-xs text-green-600">فایل آماده است</span>
                )}
              </div>

              {uploading && (
                <div className="space-y-1 rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">
                      در حال بارگذاری {uploadFileName}
                    </span>
                    <span className="font-semibold text-primary shrink-0">{uploadPercent}%</span>
                  </div>
                  <Progress value={uploadPercent} className="h-2" />
                </div>
              )}
              <Input
                value={form.video_url}
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value, storage_path: null }))}
                placeholder="یا لینک مستقیم ویدیو (MP4 / استریم)"
                className="mt-2 text-left"
                dir="ltr"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">نمایش این راهنما به کاربران</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  در حالت غیرفعال، راهنما در سایت نمایش داده نمی‌شود.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
            <Button onClick={handleSave} disabled={saving || uploading} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              ذخیره راهنما
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
