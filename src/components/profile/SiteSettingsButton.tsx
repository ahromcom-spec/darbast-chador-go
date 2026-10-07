import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { setHelpVideosEnabled, useHelpVideosEnabled } from '@/hooks/useHelpVideosEnabled';

export const SiteSettingsButton = () => {
  const [open, setOpen] = useState(false);
  const enabled = useHelpVideosEnabled();

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        تنظیمات سایت
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تنظیمات سایت</DialogTitle>
            <DialogDescription>این تنظیمات روی همین دستگاه ذخیره می‌شود.</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer">
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => setHelpVideosEnabled(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <div className="font-medium">نمایش فیلم‌های راهنمای سایت</div>
              <div className="text-sm text-muted-foreground">
                با برداشتن تیک، فیلم‌های راهنما در هیچ صفحه‌ای نمایش داده نمی‌شوند.
              </div>
            </div>
          </label>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SiteSettingsButton;
