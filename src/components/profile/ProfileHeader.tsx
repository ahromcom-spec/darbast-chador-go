import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileHeaderProps {
  user: SupabaseUser;
  fullName: string;
  roles?: string[];
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

export function ProfileHeader({ user, fullName, roles = [] }: ProfileHeaderProps) {
  const username = generateUsername(fullName);
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl">{fullName || 'کاربر'}</CardTitle>
            {username && (
              <p className="text-sm text-muted-foreground mt-1" dir="ltr">
                {username}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">
              اهرم من
            </Badge>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
