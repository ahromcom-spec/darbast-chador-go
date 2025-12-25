import { useState, useEffect } from 'react';
import { User, Shield, Crown, Briefcase, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { ProfileAvatar } from './ProfileAvatar';
import { supabase } from '@/integrations/supabase/client';

interface ProfileHeaderProps {
  user: SupabaseUser;
  fullName: string;
  roles?: string[];
  phoneNumber?: string;
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

export function ProfileHeader({ user, fullName, roles = [], phoneNumber }: ProfileHeaderProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const username = generateUsername(fullName);
  
  // Sort roles to show مدیر عامل first
  const sortedRoles = [...roles].sort((a, b) => {
    if (a === 'مدیر عامل') return -1;
    if (b === 'مدیر عامل') return 1;
    return 0;
  });

  useEffect(() => {
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
    fetchAvatarUrl();
  }, [user.id]);

  const handleAvatarUpdate = (url: string | null) => {
    setAvatarUrl(url);
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
          <ProfileAvatar 
            userId={user.id}
            avatarUrl={avatarUrl}
            fullName={fullName}
            onAvatarUpdate={handleAvatarUpdate}
          />
          
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
