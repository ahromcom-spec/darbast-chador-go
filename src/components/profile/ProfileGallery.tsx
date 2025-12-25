import { useState, useRef, useEffect } from 'react';
import { Plus, X, Loader2, Image as ImageIcon, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfilePhoto {
  id: string;
  file_path: string;
  sort_order: number;
}

interface ProfileGalleryProps {
  userId: string;
}

const MAX_PHOTOS = 10;

export function ProfileGallery({ userId }: ProfileGalleryProps) {
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotos();
  }, [userId]);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_photos')
        .select('id, file_path, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`حداکثر ${MAX_PHOTOS} عکس می‌توانید اضافه کنید`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    setUploading(true);
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
          toast.error(`فایل ${file.name}: فرمت نامعتبر`);
          continue;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`فایل ${file.name}: حجم بیشتر از ۵ مگابایت`);
          continue;
        }

        // Upload file
        const fileExt = file.name.split('.').pop();
        const fileName = `gallery_${Date.now()}_${i}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Add to database
        const { error: dbError } = await supabase
          .from('profile_photos')
          .insert({
            user_id: userId,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            sort_order: photos.length + i,
          });

        if (dbError) {
          console.error('DB error:', dbError);
          // Remove uploaded file if db insert fails
          await supabase.storage.from('profile-images').remove([filePath]);
        }
      }

      toast.success('عکس‌ها با موفقیت آپلود شدند');
      fetchPhotos();
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('خطا در آپلود عکس‌ها');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (photo: ProfilePhoto) => {
    setDeletingId(photo.id);
    try {
      // Delete from storage
      await supabase.storage.from('profile-images').remove([photo.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('profile_photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      toast.success('عکس حذف شد');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('خطا در حذف عکس');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              گالری تصاویر
            </CardTitle>
            <CardDescription>
              حداکثر {MAX_PHOTOS} عکس می‌توانید اضافه کنید ({photos.length}/{MAX_PHOTOS})
            </CardDescription>
          </div>
          {photos.length < MAX_PHOTOS && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 ml-1" />
              )}
              افزودن عکس
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {photos.length === 0 ? (
          <div 
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              هنوز عکسی اضافه نشده است
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              برای افزودن عکس کلیک کنید
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden group border border-border"
              >
                <img
                  src={getPublicUrl(photo.file_path)}
                  alt="گالری"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(photo)}
                    disabled={deletingId === photo.id}
                  >
                    {deletingId === photo.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Add more button inside grid */}
            {photos.length < MAX_PHOTOS && (
              <div
                className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                ) : (
                  <Plus className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
