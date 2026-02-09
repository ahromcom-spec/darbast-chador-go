import { Lock, LockOpen, Users, RefreshCw, History } from 'lucide-react';
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
}: ModuleLockStatusBarProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-4 py-2 rounded-lg border text-sm',
        isReadOnly
          ? 'bg-destructive/10 border-destructive/30'
          : 'bg-primary/10 border-primary/30'
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
        ) : (
          <>
            <Users className="h-4 w-4 text-primary" />
            <span className="text-primary">
              شما در حال ویرایش هستید
            </span>
            <Badge variant="default">
              <Lock className="h-3 w-3 ml-1" />
              حالت ویرایش
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
        {isReadOnly ? (
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
          <Button
            variant="outline"
            size="sm"
            onClick={onReleaseControl}
            disabled={isLoading}
            className="gap-1"
          >
            <Lock className="h-4 w-4" />
            آزاد کردن کنترل
          </Button>
        ) : null}
      </div>
    </div>
  );
}
