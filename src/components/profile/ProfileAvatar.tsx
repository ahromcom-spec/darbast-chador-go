import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader2, Shield, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useImageModeration } from '@/hooks/useImageModeration';
import { cn } from '@/lib/utils';

interface ProfilePhoto {
  id: string;
  file_path: string;
  sort_order: number;
}

interface ProfileAvatarProps {
  userId: string;
  avatarUrl: string | null;
  fullName: string;
  onAvatarUpdate: (url: string | null) => void;
}

const MAX_PHOTOS = 10;

export function ProfileAvatar({ userId, avatarUrl, fullName, onAvatarUpdate }: ProfileAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { checkImageWithToast, checking } = useImageModeration();

  const getInitials = (name: string) => {
    if (!name) return '؟';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2);
  };

  // Fetch all profile photos
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
      
      // Find the current avatar in the photos list
      if (avatarUrl && data) {
        const currentPhotoIndex = data.findIndex(p => {
          const photoUrl = getPublicUrl(p.file_path);
          return photoUrl === avatarUrl;
        });
        if (currentPhotoIndex !== -1) {
          setCurrentIndex(currentPhotoIndex);
        }
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Get the current display image
  const getCurrentImage = () => {
    if (photos.length > 0 && photos[currentIndex]) {
      return getPublicUrl(photos[currentIndex].file_path);
    }
    return avatarUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check limit
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`حداکثر ${MAX_PHOTOS} عکس می‌توانید اضافه کنید`);
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('فرمت فایل باید JPEG، PNG، WebP یا GIF باشد');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم فایل نباید بیشتر از ۵ مگابایت باشد');
      return;
    }

    // Check image content with AI moderation
    const isSafe = await checkImageWithToast(file);
    if (!isSafe) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);
    try {
      // Upload new photo
      const fileExt = file.name.split('.').pop();
      const fileName = `gallery_${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      // Add to database with sort_order at the beginning (prepend)
      const { error: dbError } = await supabase
        .from('profile_photos')
        .insert({
          user_id: userId,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          sort_order: 0, // New photos go first
        });

      if (dbError) {
        // Remove uploaded file if db insert fails
        await supabase.storage.from('profile-images').remove([filePath]);
        throw dbError;
      }

      // Update sort_order for other photos
      for (const photo of photos) {
        await supabase
          .from('profile_photos')
          .update({ sort_order: photo.sort_order + 1 })
          .eq('id', photo.id);
      }

      // Update main avatar to the new photo
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      onAvatarUpdate(publicUrl);
      setCurrentIndex(0);
      await fetchPhotos();
      toast.success('عکس با موفقیت اضافه شد');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('خطا در آپلود عکس');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectPhoto = async (index: number) => {
    if (index === currentIndex) return;
    
    const photo = photos[index];
    if (!photo) return;

    const publicUrl = getPublicUrl(photo.file_path);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      if (error) throw error;

      setCurrentIndex(index);
      onAvatarUpdate(publicUrl);
      toast.success('عکس پروفایل تغییر کرد');
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('خطا در تغییر عکس پروفایل');
    }
  };

  const handleDeletePhoto = async (photo: ProfilePhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    
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

      // Update avatar if this was the current one
      const photoUrl = getPublicUrl(photo.file_path);
      if (avatarUrl === photoUrl) {
        const remainingPhotos = photos.filter(p => p.id !== photo.id);
        if (remainingPhotos.length > 0) {
          const newAvatarUrl = getPublicUrl(remainingPhotos[0].file_path);
          await supabase
            .from('profiles')
            .update({ avatar_url: newAvatarUrl })
            .eq('user_id', userId);
          onAvatarUpdate(newAvatarUrl);
        } else {
          await supabase
            .from('profiles')
            .update({ avatar_url: null })
            .eq('user_id', userId);
          onAvatarUpdate(null);
        }
      }

      // Update state
      const newPhotos = photos.filter(p => p.id !== photo.id);
      setPhotos(newPhotos);
      
      // Adjust current index if needed
      if (currentIndex >= newPhotos.length) {
        setCurrentIndex(Math.max(0, newPhotos.length - 1));
      }

      toast.success('عکس حذف شد');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('خطا در حذف عکس');
    } finally {
      setDeletingId(null);
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (photos.length <= 1) return;
    
    if (direction === 'prev') {
      const newIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
      handleSelectPhoto(newIndex);
    } else {
      const newIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
      handleSelectPhoto(newIndex);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main Avatar with navigation */}
      <div className="relative group">
        <Avatar className="h-24 w-24 border-4 border-primary/20">
          <AvatarImage src={getCurrentImage() || undefined} alt={fullName} />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
            {getInitials(fullName)}
          </AvatarFallback>
        </Avatar>
        
        
        {/* Photo counter */}
        {photos.length > 1 && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {currentIndex + 1}/{photos.length}
          </div>
        )}
        
        {/* Upload overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading || checking ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <Camera className="h-8 w-8 text-white" />
          )}
        </div>
      </div>

      {/* Photo thumbnails - Telegram style */}
      {photos.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[200px]">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => handleSelectPhoto(index)}
              className={cn(
                "relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all hover:scale-110",
                index === currentIndex 
                  ? "border-primary ring-2 ring-primary/30" 
                  : "border-muted hover:border-primary/50"
              )}
            >
              <img
                src={getPublicUrl(photo.file_path)}
                alt=""
                className="w-full h-full object-cover"
              />
              {/* Delete button on hover */}
              <div 
                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                onClick={(e) => handleDeletePhoto(photo, e)}
              >
                {deletingId === photo.id ? (
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                ) : (
                  <X className="h-3 w-3 text-white" />
                )}
              </div>
            </button>
          ))}
          
          {/* Add more button */}
          {photos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || checking}
              className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors"
            >
              {uploading || checking ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || checking || photos.length >= MAX_PHOTOS}
        >
          {checking ? (
            <Shield className="h-4 w-4 ml-1 animate-pulse" />
          ) : (
            <Upload className="h-4 w-4 ml-1" />
          )}
          {photos.length >= MAX_PHOTOS ? `حداکثر ${MAX_PHOTOS} عکس` : 'آپلود تصویر'}
        </Button>
        {photos.length > 0 && photos[currentIndex] && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleDeletePhoto(photos[currentIndex], e)}
            disabled={uploading || deletingId !== null}
            className="text-destructive hover:text-destructive"
          >
            {deletingId === photos[currentIndex]?.id ? (
              <Loader2 className="h-4 w-4 ml-1 animate-spin" />
            ) : (
              <X className="h-4 w-4 ml-1" />
            )}
            حذف
          </Button>
        )}
      </div>
      
      {/* Photo count info */}
      {photos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {photos.length}/{MAX_PHOTOS} عکس • روی عکس‌های کوچک کلیک کنید تا تغییر کند
        </p>
      )}
    </div>
  );
}
