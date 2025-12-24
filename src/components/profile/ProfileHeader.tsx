import { useState, useRef } from 'react';
import { User, Shield, Crown, Briefcase, Star, Camera, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileHeaderProps {
  user: SupabaseUser;
  fullName: string;
  roles?: string[];
  phoneNumber?: string;
  avatarUrl?: string | null;
  onAvatarUpdate?: (url: string) => void;
}

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
  
  // Remove consecutive dashes and trim
  return result.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function generateUsername(fullName: string): string {
  const transliterated = transliteratePersianToEnglish(fullName);
  return transliterated ? `${transliterated}@ahrom.ir` : '';
}

// Role badge styling
const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'مدیر عامل':
      return 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-amber-600 shadow-lg shadow-amber-500/30';
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
      return <Crown className="h-3.5 w-3.5" />;
    case 'مدیر سیستم':
      return <Shield className="h-3.5 w-3.5" />;
    case 'مدیر ارشد':
    case 'مدیر اجرایی':
    case 'مدیر فروش':
    case 'مدیر مالی':
      return <Briefcase className="h-3.5 w-3.5" />;
    case 'پیمانکار':
      return <Star className="h-3.5 w-3.5" />;
    default:
      return null;
  }
};

export function ProfileHeader({ user, fullName, roles = [], phoneNumber, avatarUrl, onAvatarUpdate }: ProfileHeaderProps) {
  const username = generateUsername(fullName);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  
  // Sort roles to show مدیر عامل first
  const sortedRoles = [...roles].sort((a, b) => {
    if (a === 'مدیر عامل') return -1;
    if (b === 'مدیر عامل') return 1;
    return 0;
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('لطفاً یک فایل تصویر انتخاب کنید');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم فایل نباید بیشتر از 5 مگابایت باشد');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Delete old avatar if exists
      await supabase.storage.from('avatars').remove([filePath]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add timestamp to bust cache
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithTimestamp })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setCurrentAvatarUrl(urlWithTimestamp);
      onAvatarUpdate?.(urlWithTimestamp);
      toast.success('عکس پروفایل با موفقیت بروزرسانی شد');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('خطا در بارگذاری تصویر: ' + (error.message || 'خطای ناشناخته'));
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <Card className="mb-6 overflow-hidden">
      {/* CEO Highlight Banner */}
      {roles.includes('مدیر عامل') && (
        <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-4 py-2 flex items-center justify-center gap-2">
          <Crown className="h-5 w-5 text-white" />
          <span className="text-white font-bold text-sm">مدیر عامل</span>
          <Crown className="h-5 w-5 text-white" />
        </div>
      )}
      
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Avatar with upload capability */}
          <div className="relative group">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div 
              onClick={handleAvatarClick}
              className={`h-20 w-20 rounded-full flex items-center justify-center shrink-0 cursor-pointer overflow-hidden transition-all hover:opacity-80 ${
                roles.includes('مدیر عامل') 
                  ? 'bg-gradient-to-br from-amber-400 to-yellow-500 ring-4 ring-amber-200' 
                  : 'bg-primary/10 ring-2 ring-primary/20'
              }`}
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : currentAvatarUrl ? (
                <img 
                  src={currentAvatarUrl} 
                  alt={fullName || 'پروفایل کاربر'}
                  className="h-full w-full object-cover"
                />
              ) : roles.includes('مدیر عامل') ? (
                <Crown className="h-10 w-10 text-white" />
              ) : (
                <User className="h-10 w-10 text-primary" />
              )}
            </div>
            {/* Camera overlay on hover */}
            <div 
              onClick={handleAvatarClick}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>
          
          {/* User Info */}
          <div className="flex-1 space-y-2">
            <CardTitle className="text-2xl">{fullName || 'کاربر'}</CardTitle>
            
            {/* Username */}
            {username && (
              <p className="text-sm text-muted-foreground" dir="ltr">
                <span className="font-mono bg-muted px-2 py-1 rounded">{username}</span>
              </p>
            )}
            
            {/* Phone Number */}
            {phoneNumber && (
              <p className="text-sm text-muted-foreground" dir="ltr">
                📱 {phoneNumber}
              </p>
            )}
          </div>
          
          {/* Main Badge */}
          <div className="flex gap-2 flex-wrap sm:self-start">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              اهرم من
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      {/* Roles Section */}
      {sortedRoles.length > 0 && (
        <CardContent className="pt-0 pb-4">
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">سمت‌ها و دسترسی‌ها</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sortedRoles.map((role, index) => (
                <Badge 
                  key={index}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border transition-all hover:scale-105 ${getRoleBadgeStyle(role)}`}
                >
                  {getRoleIcon(role)}
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
