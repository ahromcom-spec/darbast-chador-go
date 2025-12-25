import { useState, useEffect } from 'react';
import { Edit2, Save, X, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileBioProps {
  userId: string;
  initialBio: string | null;
  onUpdate?: (bio: string) => void;
}

const MAX_BIO_LENGTH = 500;

export function ProfileBio({ userId, initialBio, onUpdate }: ProfileBioProps) {
  const [bio, setBio] = useState(initialBio || '');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [originalBio, setOriginalBio] = useState(initialBio || '');

  useEffect(() => {
    setBio(initialBio || '');
    setOriginalBio(initialBio || '');
  }, [initialBio]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio: bio.trim() || null })
        .eq('user_id', userId);

      if (error) throw error;

      setOriginalBio(bio);
      setEditMode(false);
      onUpdate?.(bio);
      toast.success('بیوگرافی با موفقیت ذخیره شد');
    } catch (error) {
      console.error('Error saving bio:', error);
      toast.error('خطا در ذخیره بیوگرافی');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setBio(originalBio);
    setEditMode(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              بیوگرافی
            </CardTitle>
            <CardDescription>
              درباره خودتان بنویسید
            </CardDescription>
          </div>
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant="outline" size="sm">
              <Edit2 className="h-4 w-4 ml-1" />
              ویرایش
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editMode ? (
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                placeholder="درباره خودتان، تجربیات، علایق و تخصص‌هایتان بنویسید..."
                className="min-h-[120px] resize-none"
                dir="rtl"
              />
              <span className="absolute bottom-2 left-2 text-xs text-muted-foreground">
                {bio.length}/{MAX_BIO_LENGTH}
              </span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 ml-1" />
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
              <Button onClick={handleCancel} variant="outline" disabled={saving}>
                <X className="h-4 w-4 ml-1" />
                انصراف
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-h-[60px]">
            {bio ? (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {bio}
              </p>
            ) : (
              <p className="text-muted-foreground italic">
                هنوز بیوگرافی ننوشته‌اید. روی دکمه ویرایش کلیک کنید تا درباره خودتان بنویسید.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
