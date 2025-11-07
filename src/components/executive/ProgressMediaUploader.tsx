import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProgressMedia {
  id: string;
  storage_path: string;
  file_name: string;
  description: string | null;
  created_at: string;
  stage: string;
}

interface ProgressMediaUploaderProps {
  projectId: string;
  stage: 'ready' | 'in_progress' | 'completed' | 'awaiting_payment' | 'order_executed' | 'awaiting_collection';
  stageName: string;
}

export function ProgressMediaUploader({ projectId, stage, stageName }: ProgressMediaUploaderProps) {
  const { user } = useAuth();
  const [media, setMedia] = useState<ProgressMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [projectId, stage]);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_progress_media')
        .select('*')
        .eq('project_id', projectId)
        .eq('stage', stage)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedia(data || []);
    } catch (error) {
      console.error('Error fetching media:', error);
      toast.error('خطا در دریافت تصاویر');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // بررسی نوع فایل
    if (!file.type.startsWith('image/')) {
      toast.error('فقط فایل‌های تصویری مجاز هستند');
      return;
    }

    // بررسی حجم فایل (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم فایل نباید بیشتر از 10 مگابایت باشد');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    try {
      setUploading(true);

      // آپلود به Storage
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = `${user.id}/${projectId}/${stage}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('executive-progress')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // ثبت در دیتابیس
      const { error: dbError } = await supabase
        .from('project_progress_media')
        .insert({
          project_id: projectId,
          uploaded_by: user.id,
          stage,
          storage_path: filePath,
          media_type: selectedFile.type,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          description: description.trim() || null
        });

      if (dbError) throw dbError;

      toast.success('تصویر با موفقیت آپلود شد');
      setSelectedFile(null);
      setDescription('');
      fetchMedia();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'خطا در آپلود تصویر');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (mediaId: string, storagePath: string) => {
    if (!confirm('آیا از حذف این تصویر اطمینان دارید؟')) return;

    try {
      // حذف از Storage
      const { error: storageError } = await supabase.storage
        .from('executive-progress')
        .remove([storagePath]);

      if (storageError) throw storageError;

      // حذف از دیتابیس
      const { error: dbError } = await supabase
        .from('project_progress_media')
        .delete()
        .eq('id', mediaId);

      if (dbError) throw dbError;

      toast.success('تصویر حذف شد');
      fetchMedia();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'خطا در حذف تصویر');
    }
  };

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('executive-progress')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          تصاویر پیشرفت - {stageName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* فرم آپلود */}
        <div className="space-y-3 p-4 bg-secondary/30 rounded-lg">
          <div>
            <Label>انتخاب تصویر</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>

          {previewUrl && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={previewUrl}
                alt="پیش‌نمایش"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div>
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات مربوط به تصویر..."
              rows={2}
              disabled={uploading}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال آپلود...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  آپلود تصویر
                </>
              )}
            </Button>
            {selectedFile && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  setDescription('');
                }}
                disabled={uploading}
              >
                انصراف
              </Button>
            )}
          </div>
        </div>

        {/* لیست تصاویر */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            در حال بارگذاری...
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p>هنوز تصویری آپلود نشده است</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                onClick={() => setViewImage(getImageUrl(item.storage_path))}
              >
                <img
                  src={getImageUrl(item.storage_path)}
                  alt={item.file_name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <p className="text-white text-xs text-center line-clamp-2">
                    {item.description || item.file_name}
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id, item.storage_path);
                    }}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* دیالوگ نمایش تصویر */}
        <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>نمایش تصویر</DialogTitle>
            </DialogHeader>
            {viewImage && (
              <img
                src={viewImage}
                alt="نمایش کامل"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
