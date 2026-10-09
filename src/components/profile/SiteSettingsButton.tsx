import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getHelpVideosEnabled, setHelpVideosEnabled } from '@/lib/helpVideoPreference';

export function SiteSettingsButton() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(getHelpVideosEnabled());

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        تنظیمات سایت
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تنظیمات سایت</DialogTitle>
            <DialogDescription>این تنظیم روی همین دستگاه ذخیره می‌شود.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Checkbox
              id="help-videos-toggle"
              checked={enabled}
              onCheckedChange={(c) => {
                const v = c === true;
                setEnabled(v);
                setHelpVideosEnabled(v);
              }}
            />
            <Label htmlFor="help-videos-toggle" className="cursor-pointer">
              نمایش فیلم‌های راهنمای سایت
            </Label>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
