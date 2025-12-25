import { useState, useEffect, useRef } from 'react';
import { Shield, Crown, Briefcase, Star, Edit2, Save, X, Camera, Loader2, Plus } from 'lucide-react';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useImageModeration } from '@/hooks/useImageModeration';
import { cn } from '@/lib/utils';

interface ProfilePhoto {
  id: string;
  file_path: string;
  sort_order: number;
}

interface UnifiedProfileCardProps {
  user: SupabaseUser;
  fullName: string;
  roles?: string[];
  phoneNumber?: string;
  bio?: string | null;
  onNameUpdate: (name: string) => void;
  onBioUpdate: (bio: string) => void;
}

const MAX_PHOTOS = 10;
const MAX_BIO_LENGTH = 500;

// Transliteration map for Persian to English
const persianToEnglish: { [key: string]: string } = {
  'آ': 'a', 'ا': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch',
  'ح': 'h', 'خ': 'kh', 'd': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's',
  'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h',
  'ی': 'i', 'ئ': 'i', 'ة': 'e'
};

function transliteratePersianToEnglish(text: string): string {
  if (!text) return '';
  let result = '';
  for (let char of text.toLowerCase()) {
    if (persianToEnglish[char]) {
      result += persianToEnglish[char];
    } else if (/[a-z0-9]/.test(char)) {
      result += char;
    } else if (char === ' ') {
      result += '-';
    }
  }
  return result.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function generateUsername(fullName: string): string {
  const transliterated = transliteratePersianToEnglish(fullName);
  return transliterated ? `${transliterated}@ahrom.ir` : '';
}

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'مدیر عامل':
      return 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-amber-600';
    case 'مدیر سیستم':
      return 'bg-gradient-to-r from-red-500 to-rose-400 text-white border-red-600';
    case 'مدیر ارشد':
      return 'bg-gradient-to-r from-purple-500 to-violet-400 text-white border-purple-600';
    case 'مدیر اجرایی':
      return 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white border-blue-600';
    case 'مدیر فروش':
      return 'bg-gradient-to-r from-green-500 to-emerald-400 text-white border-green-600';
    case 'مدیر مالی':
      return 'bg-gradient-to-r from-indigo-500 to-blue-400 text-white border-indigo-600';
    case 'پیمانکار':
      return 'bg-gradient-to-r from-orange-500 to-amber-400 text-white border-orange-600';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'مدیر عامل':
      return <Crown className="h-3 w-3" />;
    case 'مدیر سیستم':
      return <Shield className="h-3 w-3" />;
    case 'مدیر ارشد':
    case 'مدیر اجرایی':
    case 'مدیر فروش':
    case 'مدیر مالی':
      return <Briefcase className="h-3 w-3" />;
    case 'پیمانکار':
      return <Star className="h-3 w-3" />;
    default:
      return null;
  }
};

export function UnifiedProfileCard({ 
  user, 
  fullName, 
  roles = [], 
  phoneNumber,
  bio,
  onNameUpdate,
  onBioUpdate
}: UnifiedProfileCardProps) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(fullName);
  const [editBio, setEditBio] = useState(bio || '');
  
  // Photo states
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { checkImageWithToast, checking } = useImageModeration();
  
  const username = generateUsername(fullName);
  const sortedRoles = [...roles].sort((a, b) => {
    if (a === 'مدیر عامل') return -1;
    if (b === 'مدیر عامل') return 1;
    return 0;
  });

  const getInitials = (name: string) => {
    if (!name) return '؟';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2);
  };

  useEffect(() => {
    fetchPhotos();
    fetchAvatarUrl();
  }, [user.id]);

  useEffect(() => {
    setEditName(fullName);
    setEditBio(bio || '');
  }, [fullName, bio]);

  const fetchAvatarUrl = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data?.avatar_url) {
      setAvatarUrl(data.avatar_url);
    }
  };

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_photos')
        .select('id, file_path, sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getCurrentImage = () => {
    if (photos.length > 0 && photos[currentIndex]) {
      return getPublicUrl(photos[currentIndex].file_path);
    }
    return avatarUrl;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: editName,
          bio: editBio.trim() || null 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      onNameUpdate(editName);
      onBioUpdate(editBio);
      setEditMode(false);
      toast.success('اطلاعات ذخیره شد');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('خطا در ذخیره');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(fullName);
    setEditBio(bio || '');
    setEditMode(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= MAX_PHOTOS) {
      toast.error(`حداکثر ${MAX_PHOTOS} عکس`);
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('فرمت نامعتبر');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حداکثر ۵ مگابایت');
      return;
    }

    const isSafe = await checkImageWithToast(file);
    if (!isSafe) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `gallery_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      await supabase.from('profile_photos').insert({
        user_id: user.id,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        sort_order: 0,
      });

      for (const photo of photos) {
        await supabase
          .from('profile_photos')
          .update({ sort_order: photo.sort_order + 1 })
          .eq('id', photo.id);
      }

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      setAvatarUrl(publicUrl);
      setCurrentIndex(0);
      await fetchPhotos();
      toast.success('عکس اضافه شد');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('خطا در آپلود');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPhoto = async (index: number) => {
    if (index === currentIndex) return;
    const photo = photos[index];
    if (!photo) return;

    const publicUrl = getPublicUrl(photo.file_path);
    
    try {
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      setCurrentIndex(index);
      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error updating avatar:', error);
    }
  };

  const handleDeletePhoto = async (photo: ProfilePhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(photo.id);
    
    try {
      await supabase.storage.from('profile-images').remove([photo.file_path]);
      await supabase.from('profile_photos').delete().eq('id', photo.id);

      const photoUrl = getPublicUrl(photo.file_path);
      if (avatarUrl === photoUrl) {
        const remainingPhotos = photos.filter(p => p.id !== photo.id);
        if (remainingPhotos.length > 0) {
          const newUrl = getPublicUrl(remainingPhotos[0].file_path);
          await supabase.from('profiles').update({ avatar_url: newUrl }).eq('user_id', user.id);
          setAvatarUrl(newUrl);
        } else {
          await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', user.id);
          setAvatarUrl(null);
        }
      }

      const newPhotos = photos.filter(p => p.id !== photo.id);
      setPhotos(newPhotos);
      if (currentIndex >= newPhotos.length) {
        setCurrentIndex(Math.max(0, newPhotos.length - 1));
      }
      toast.success('حذف شد');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('خطا');
    } finally {
      setDeletingId(null);
    }
  };


  const photoUrls = photos.map(p => getPublicUrl(p.file_path));

  return (
    <>
    <ImageZoomModal
      imageUrl={getCurrentImage() || ''}
      isOpen={zoomModalOpen}
      onClose={() => setZoomModalOpen(false)}
      images={photoUrls.length > 0 ? photoUrls : (avatarUrl ? [avatarUrl] : [])}
      initialIndex={currentIndex}
      activeIndex={currentIndex}
      onSelect={photos.length > 0 ? (idx) => handleSelectPhoto(idx) : undefined}
      type="profile"
    />
    <Card className="mb-6 overflow-hidden">
      {/* CEO Banner */}
      {roles.includes('مدیر عامل') && (
        <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-3 py-1.5 flex items-center justify-center gap-2">
          <Crown className="h-4 w-4 text-white" />
          <span className="text-white font-bold text-xs">مدیر عامل</span>
        </div>
      )}
      
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative group">
              <Avatar 
                className="h-20 w-20 border-2 border-primary/20 cursor-pointer"
                onClick={() => {
                  if (photos.length > 0 || avatarUrl) {
                    setZoomModalOpen(true);
                  }
                }}
              >
                <AvatarImage src={getCurrentImage() || undefined} alt={fullName} />
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              
              
              {/* Counter */}
              {photos.length > 1 && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {currentIndex + 1}/{photos.length}
                </div>
              )}
              
              {/* Upload button (does not block avatar click) */}
              <button
                type="button"
                aria-label="افزودن عکس"
                disabled={uploading || checking}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className={cn(
                  "absolute -bottom-1 -right-1 h-7 w-7 rounded-full border border-border bg-background/90 shadow flex items-center justify-center transition",
                  (uploading || checking) && "opacity-70 cursor-not-allowed"
                )}
              >
                {uploading || checking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Camera className="h-4 w-4 text-foreground" />
                )}
              </button>
            </div>

            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          {/* Info Section */}
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="نام و نام خانوادگی"
                  className="h-8 text-sm"
                />
                <Textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                  placeholder="درباره خودتان..."
                  className="min-h-[60px] text-sm resize-none"
                />
                <div className="flex gap-1">
                  <Button onClick={handleSave} disabled={saving} size="sm" className="h-7 text-xs flex-1">
                    <Save className="h-3 w-3 ml-1" />
                    {saving ? '...' : 'ذخیره'}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm" className="h-7 text-xs">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold truncate">{fullName || 'کاربر'}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5">
                      اهرم من
                    </Badge>
                    <Button onClick={() => setEditMode(true)} variant="ghost" size="icon" className="h-6 w-6">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {username && (
                  <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">
                    {username}
                  </p>
                )}
                
                {phoneNumber && (
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    📱 {phoneNumber}
                  </p>
                )}
                
                {bio && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {bio}
                  </p>
                )}
                
                {!bio && (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="text-xs text-primary/70 hover:text-primary"
                  >
                    + افزودن بیوگرافی
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Roles - Compact */}
        {sortedRoles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
            {sortedRoles.map((role, index) => (
              <Badge 
                key={index}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border ${getRoleBadgeStyle(role)}`}
              >
                {getRoleIcon(role)}
                {role}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
