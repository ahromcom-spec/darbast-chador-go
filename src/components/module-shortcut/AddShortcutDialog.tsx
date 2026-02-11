import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

interface AddShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleName: string;
  onConfirm: () => void;
}

export function AddShortcutDialog({ open, onOpenChange, moduleName, onConfirm }: AddShortcutDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            افزودن میانبر
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            آیا می‌خواهید ماژول <strong>«{moduleName}»</strong> را به صفحه نخست اضافه کنید؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <Button onClick={onConfirm} className="gap-2">
            <Home className="h-4 w-4" />
            بله، اضافه شود
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
