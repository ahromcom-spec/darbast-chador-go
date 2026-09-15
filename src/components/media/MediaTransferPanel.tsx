import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronUp, AlertCircle, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useMediaTransfers, formatBytes } from '@/lib/mediaTransfers';
import { cn } from '@/lib/utils';

/**
 * Floating panel showing live progress of every media upload/download
 * happening anywhere in the app (managers and customers alike).
 */
export const MediaTransferPanel = () => {
  const transfers = useMediaTransfers();
  const [collapsed, setCollapsed] = useState(false);

  if (transfers.length === 0) return null;

  const active = transfers.filter((t) => t.status === 'active');
  const overall = active.length
    ? Math.round(active.reduce((s, t) => s + t.percentage, 0) / active.length)
    : 100;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 z-[9999] w-[min(92vw,320px)] rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-accent/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold">
          <ArrowUpFromLine className="h-4 w-4 text-primary" />
          انتقال فایل‌ها ({transfers.length}) — {overall}%
        </span>
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-2.5">
          {transfers.map((t) => (
            <div key={t.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  {t.kind === 'upload' ? (
                    <ArrowUpFromLine className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  )}
                  <span className="text-[11px] truncate">{t.label}</span>
                </span>
                <span className="text-[11px] font-medium shrink-0 flex items-center gap-1">
                  {t.status === 'error' ? (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-destructive">خطا</span>
                    </>
                  ) : t.status === 'done' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-green-600">۱۰۰٪</span>
                    </>
                  ) : (
                    `${t.percentage}%`
                  )}
                </span>
              </div>
              <Progress
                value={t.status === 'done' ? 100 : t.percentage}
                className={cn('h-1.5', t.status === 'error' && 'opacity-50')}
              />
              {t.kind === 'upload' && t.total > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(t.loaded)} از {formatBytes(t.total)}
                </p>
              )}
              {t.status === 'error' && t.error && (
                <p className="text-[10px] text-destructive line-clamp-2">{t.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaTransferPanel;
