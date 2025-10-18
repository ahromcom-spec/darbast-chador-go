import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Edit2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileFormProps {
  userId: string;
  initialFullName: string;
  phoneNumber?: string;
  onUpdate: (fullName: string) => void;
}

export function ProfileForm({ userId, initialFullName, phoneNumber, onUpdate }: ProfileFormProps) {
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState(initialFullName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', userId);

      if (error) throw error;

      onUpdate(fullName);
      setEditMode(false);
      toast.success('اطلاعات با موفقیت ذخیره شد');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('خطا در ذخیره اطلاعات');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(initialFullName);
    setEditMode(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>اطلاعات کاربری</CardTitle>
            <CardDescription>مشاهده و ویرایش اطلاعات شخصی</CardDescription>
          </div>
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant="outline" size="sm">
              <Edit2 className="h-4 w-4 ml-2" />
              ویرایش
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">نام و نام خانوادگی</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!editMode}
            placeholder="نام و نام خانوادگی خود را وارد کنید"
          />
        </div>

        {phoneNumber && (
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">شماره تماس</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              disabled
              className="bg-muted cursor-not-allowed"
              placeholder="شماره تماس"
            />
          </div>
        )}

        {editMode && (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              <Save className="h-4 w-4 ml-2" />
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </Button>
            <Button onClick={handleCancel} variant="outline" disabled={saving}>
              <X className="h-4 w-4 ml-2" />
              انصراف
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
