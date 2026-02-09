import { useState } from 'react';
import { Lock, LockOpen, Users, RefreshCw, History, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface VersionRecord {
  id: string;
  versionNumber: number;
  createdAt: string;
}

interface ModuleLockStatusBarProps {
  isReadOnly: boolean;
  isLoading: boolean;
  isMine: boolean;
  lockedByName: string | null;
  onTakeControl: () => void;
  onReleaseControl?: () => void;
  versions?: VersionRecord[];
  onRestoreVersion?: (versionNumber: number) => void;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Callback to save changes before releasing control */
  onSaveBeforeRelease?: () => Promise<boolean>;
  /** Whether save is in progress */
  isSaving?: boolean;
}

export function ModuleLockStatusBar({
  isReadOnly,
  isLoading,
  isMine,
  lockedByName,
  onTakeControl,
  onReleaseControl,
  versions = [],
  onRestoreVersion,
  hasUnsavedChanges = false,
  onSaveBeforeRelease,
  isSaving = false,
}: ModuleLockStatusBarProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savingBeforeRelease, setSavingBeforeRelease] = useState(false);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle release control with optional save
  const handleReleaseClick = () => {
    if (hasUnsavedChanges && onSaveBeforeRelease) {
      setShowSaveDialog(true);
    } else {
      onReleaseControl?.();
    }
  };

  // Save and then release
  const handleSaveAndRelease = async () => {
    if (!onSaveBeforeRelease || !onReleaseControl) return;
    
    setSavingBeforeRelease(true);
    try {
      const success = await onSaveBeforeRelease();
      if (success) {
        setShowSaveDialog(false);
        onReleaseControl();
      }
    } finally {
      setSavingBeforeRelease(false);
    }
  };

  // Release without saving
  const handleReleaseWithoutSaving = () => {
    setShowSaveDialog(false);
    onReleaseControl?.();
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-4 py-2 rounded-lg border text-sm',
          isReadOnly
            ? 'bg-destructive/10 border-destructive/30'
            : isMine 
              ? 'bg-primary/10 border-primary/30'
              : 'bg-amber-50 border-amber-200'
        )}
      >
        <div className="flex items-center gap-2">
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isReadOnly ? (
            <>
              <Lock className="h-4 w-4 text-destructive" />
              <span className="text-destructive">
                {lockedByName ? (
                  <>
                    در حال ویرایش توسط:{' '}
                    <strong className="font-semibold">{lockedByName}</strong>
                  </>
                ) : (
                  'این ماژول فقط خواندنی است'
                )}
              </span>
              <Badge variant="secondary">
                <LockOpen className="h-3 w-3 ml-1" />
                فقط خواندنی
              </Badge>
            </>
          ) : isMine ? (
            <>
              <Users className="h-4 w-4 text-primary" />
              <span className="text-primary">
                شما در حال ویرایش هستید
              </span>
              <Badge variant="default">
                <Lock className="h-3 w-3 ml-1" />
                حالت ویرایش
              </Badge>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
                  تغییرات ذخیره نشده
                </Badge>
              )}
            </>
          ) : (
            <>
              <LockOpen className="h-4 w-4 text-amber-600" />
              <span className="text-amber-700">
                برای ویرایش، کنترل را بگیرید
              </span>
              <Badge variant="outline" className="border-amber-400 text-amber-700">
                <LockOpen className="h-3 w-3 ml-1" />
                آماده ویرایش
              </Badge>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Version History Dropdown */}
          {versions.length > 0 && onRestoreVersion && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">تاریخچه</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>نسخه‌های ذخیره شده</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {versions.slice(0, 10).map((version) => (
                  <DropdownMenuItem
                    key={version.id}
                    onClick={() => onRestoreVersion(version.versionNumber)}
                    className="flex justify-between"
                  >
                    <span>نسخه {version.versionNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(version.createdAt)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Take/Release Control Button */}
          {isReadOnly || !isMine ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onTakeControl}
                    disabled={isLoading}
                    className="gap-1"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <LockOpen className="h-4 w-4" />
                    )}
                    گرفتن کنترل
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>کنترل ویرایش را بگیرید</p>
                  {lockedByName && (
                    <p className="text-xs text-muted-foreground">
                      داده‌های {lockedByName} ذخیره خواهند شد
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : isMine && onReleaseControl ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReleaseClick}
                    disabled={isLoading || isSaving}
                    className="gap-1"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    تغییر به فقط خواندنی
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>کنترل ویرایش را آزاد کنید و به حالت فقط خواندنی بروید</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>

      {/* Save Before Release Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-primary" />
              تغییرات ذخیره نشده
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              شما تغییراتی دارید که هنوز ذخیره نشده‌اند.
              <br />
              آیا می‌خواهید قبل از تغییر به حالت فقط خواندنی، آن‌ها را ذخیره کنید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={savingBeforeRelease}
              className="w-full sm:w-auto"
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={handleReleaseWithoutSaving}
              disabled={savingBeforeRelease}
              className="w-full sm:w-auto gap-2"
            >
              <LockOpen className="h-4 w-4" />
              بدون ذخیره
            </Button>
            <Button
              onClick={handleSaveAndRelease}
              disabled={savingBeforeRelease}
              className="w-full sm:w-auto gap-2"
            >
              {savingBeforeRelease ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              ذخیره و تغییر
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
