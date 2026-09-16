import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, MonitorPlay, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  HELP_VIDEO_PAGES,
  getContext,
  type HelpVideoContext,
  type HelpVideoPage,
} from '@/lib/helpVideoContexts';

interface HelpContextPickerProps {
  value: string;
  onChange: (contextKey: string) => void;
}

/**
 * انتخاب تصویری محل نمایش راهنما:
 * ابتدا صفحه انتخاب می‌شود، شمایل واقعی همان صفحه در یک کادر پیش‌نمایش نشان داده می‌شود،
 * و سپس با علامت زدن محل مورد نظر، فیلم راهنما به همان قسمت متصل می‌شود.
 */
export const HelpContextPicker = ({ value, onChange }: HelpContextPickerProps) => {
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [frameLoading, setFrameLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const initialPage = useMemo(() => {
    const ctx = getContext(value);
    return HELP_VIDEO_PAGES.find((p) => p.spots.some((s) => s.key === ctx?.key)) || null;
  }, [value]);

  const [activePage, setActivePage] = useState<HelpVideoPage | null>(initialPage);

  useEffect(() => {
    if (initialPage) setActivePage(initialPage);
  }, [initialPage]);

  const pages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return HELP_VIDEO_PAGES;
    return HELP_VIDEO_PAGES.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q) ||
        p.route.toLowerCase().includes(q) ||
        p.spots.some((s) => s.label.toLowerCase().includes(q))
    );
  }, [search]);

  const previewUrl = activePage
    ? `${activePage.route}${activePage.route.includes('?') ? '&' : '?'}helpPreview=1`
    : '';

  const selectSpot = (spot: HelpVideoContext) => onChange(spot.key);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی صفحه یا بخش..."
          className="pr-9 h-9"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,190px)_1fr]">
        {/* فهرست صفحات */}
        <div className="max-h-64 md:max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {pages.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground text-center">صفحه‌ای یافت نشد</p>
          )}
          {pages.map((p) => {
            const isActive = activePage?.route === p.route;
            const hasSelected = p.spots.some((s) => s.key === value);
            return (
              <button
                key={p.route}
                type="button"
                onClick={() => {
                  setActivePage(p);
                  setFrameLoading(true);
                }}
                className={cn(
                  'w-full text-right px-3 py-2 text-xs transition-colors hover:bg-accent/50',
                  isActive && 'bg-primary/10 text-primary font-semibold'
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{p.title}</span>
                  {hasSelected && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                </span>
                <span className="block text-[10px] text-muted-foreground truncate" dir="ltr">
                  {p.route}
                </span>
              </button>
            );
          })}
        </div>

        {/* پیش‌نمایش صفحه انتخاب‌شده */}
        <div className="rounded-lg border border-border overflow-hidden">
          {!activePage ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <MonitorPlay className="h-6 w-6" />
              یک صفحه را از فهرست انتخاب کنید تا شمایل آن را ببینید
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
                <span className="text-[11px] font-semibold truncate">{activePage.title}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="بارگذاری مجدد پیش‌نمایش"
                    onClick={() => {
                      setFrameLoading(true);
                      setReloadKey((k) => k + 1);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="باز کردن صفحه در تب جدید"
                    onClick={() => window.open(activePage.route, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>

              <div className="relative bg-background" style={{ height: 220 }}>
                <iframe
                  key={`${activePage.route}-${reloadKey}`}
                  ref={frameRef}
                  src={previewUrl}
                  title={`پیش‌نمایش ${activePage.title}`}
                  onLoad={() => setFrameLoading(false)}
                  className="absolute top-0 right-0 origin-top-right border-0"
                  style={{ width: '250%', height: '550px', transform: 'scale(0.4)' }}
                />
                {frameLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {/* علامت زدن محل دقیق */}
              <div className="border-t border-border p-2 space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  محل قرار گرفتن فیلم راهنما را در این صفحه علامت بزنید:
                </p>
                {activePage.spots.map((spot) => {
                  const selected = spot.key === value;
                  return (
                    <button
                      key={spot.key}
                      type="button"
                      onClick={() => selectSpot(spot)}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-right text-xs transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border hover:bg-accent/50'
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{spot.label}</span>
                        {spot.spot && (
                          <span className="block text-[10px] text-muted-foreground truncate">
                            {spot.spot}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'h-4 w-4 rounded border shrink-0 flex items-center justify-center',
                          selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                        )}
                      >
                        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {value && (
        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-green-600 hover:bg-green-600 text-[11px]">انتخاب شد</Badge>
          <span className="text-muted-foreground truncate">{getContext(value)?.label || value}</span>
        </div>
      )}
    </div>
  );
};

export default HelpContextPicker;
