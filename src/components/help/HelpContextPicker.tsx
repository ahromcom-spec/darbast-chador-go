import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, MonitorPlay, Move, Minus, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  HELP_VIDEO_PAGES,
  getContext,
  getContextLabel,
  isFreeContextKey,
  freeContextRoute,
  makeFreeContextKey,
  type HelpVideoContext,
  type HelpVideoPage,
} from '@/lib/helpVideoContexts';

export interface HelpPlacement {
  placement: 'anchor' | 'floating';
  page_route: string | null;
  pos_x: number | null;
  pos_y: number | null;
  box_size: number;
}

interface HelpContextPickerProps {
  value: string;
  onChange: (contextKey: string) => void;
  placement?: HelpPlacement;
  onPlacementChange?: (placement: HelpPlacement) => void;
}

/**
 * انتخاب تصویری محل نمایش راهنما:
 * ابتدا صفحه انتخاب می‌شود، شمایل واقعی همان صفحه در یک کادر پیش‌نمایش نشان داده می‌شود،
 * و سپس با علامت زدن محل مورد نظر، فیلم راهنما به همان قسمت متصل می‌شود.
 */
export const HelpContextPicker = ({
  value,
  onChange,
  placement,
  onPlacementChange,
}: HelpContextPickerProps) => {
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [frameLoading, setFrameLoading] = useState(true);
  const [marking, setMarking] = useState(true);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const initialPage = useMemo(() => {
    if (isFreeContextKey(value)) {
      const route = freeContextRoute(value);
      return HELP_VIDEO_PAGES.find((p) => p.route === route) || null;
    }
    const ctx = getContext(value);
    return HELP_VIDEO_PAGES.find((p) => p.spots.some((s) => s.key === ctx?.key)) || null;
  }, [value]);

  const isFree = placement?.placement === 'floating';
  const freePos = {
    x: placement?.pos_x ?? 85,
    y: placement?.pos_y ?? 80,
  };
  const freeSize = placement?.box_size ?? 56;
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

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

  const selectSpot = (spot: HelpVideoContext) => {
    onChange(spot.key);
    onPlacementChange?.({
      placement: 'anchor',
      page_route: activePage?.route ?? null,
      pos_x: null,
      pos_y: null,
      box_size: freeSize,
    });
  };

  const enableFreeMode = () => {
    if (!activePage) return;
    if (!isFreeContextKey(value)) onChange(makeFreeContextKey(activePage.route));
    onPlacementChange?.({
      placement: 'floating',
      page_route: activePage.route,
      pos_x: freePos.x,
      pos_y: freePos.y,
      box_size: freeSize,
    });
  };

  const setFreePoint = (clientX: number, clientY: number) => {
    const box = previewBoxRef.current;
    if (!box || !activePage) return;
    const rect = box.getBoundingClientRect();
    const x = Math.min(97, Math.max(0.5, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(97, Math.max(0.5, ((clientY - rect.top) / rect.height) * 100));
    onPlacementChange?.({
      placement: 'floating',
      page_route: activePage.route,
      pos_x: x,
      pos_y: y,
      box_size: freeSize,
    });
  };

  const setFreeSize = (size: number) => {
    if (!activePage) return;
    onPlacementChange?.({
      placement: 'floating',
      page_route: activePage.route,
      pos_x: freePos.x,
      pos_y: freePos.y,
      box_size: Math.min(120, Math.max(36, size)),
    });
  };

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

              <div
                ref={previewBoxRef}
                className="relative bg-background overflow-hidden"
                style={{ height: 220, cursor: isFree ? 'crosshair' : undefined }}
                onPointerDown={(e) => {
                  if (!isFree) return;
                  draggingRef.current = true;
                  setFreePoint(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (!isFree || !draggingRef.current) return;
                  setFreePoint(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                  draggingRef.current = false;
                }}
                onPointerLeave={() => {
                  draggingRef.current = false;
                }}
              >
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
                {isFree && (
                  <>
                    <div className="absolute inset-0" />
                    <div
                      className="absolute rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center ring-4 ring-primary/25 pointer-events-none"
                      style={{
                        top: `${freePos.y}%`,
                        left: `${freePos.x}%`,
                        width: Math.max(18, freeSize * 0.42),
                        height: Math.max(18, freeSize * 0.42),
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <Move className="h-3 w-3" />
                    </div>
                  </>
                )}
              </div>

              {/* حالت محل آزاد: کشیدن کادر به هر نقطه از صفحه */}
              <div className="border-t border-border p-2 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={isFree ? 'default' : 'outline'}
                    className="h-7 text-[11px] gap-1"
                    onClick={enableFreeMode}
                  >
                    <Move className="h-3 w-3" />
                    محل آزاد (کشیدن کادر روی صفحه)
                  </Button>
                  {isFree && (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        title="کوچک‌تر"
                        onClick={() => setFreeSize(freeSize - 6)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        title="بزرگ‌تر"
                        onClick={() => setFreeSize(freeSize + 6)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground">
                        اندازه: {freeSize}px — موقعیت: {Math.round(freePos.x)}٪ / {Math.round(freePos.y)}٪
                      </span>
                    </>
                  )}
                </div>
                {isFree && (
                  <p className="text-[11px] text-muted-foreground">
                    کادر را داخل پیش‌نمایش بکشید تا فیلم راهنما دقیقاً همان‌جای صفحه قرار بگیرد. بعد از ذخیره،
                    روی خود صفحه هم می‌توانید با دکمه «جابجایی» آن را حرکت دهید.
                  </p>
                )}
              </div>

              {/* علامت زدن محل دقیق */}
              <div className="border-t border-border p-2 space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  یا یکی از محل‌های آماده این صفحه را علامت بزنید:
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
          <span className="text-muted-foreground truncate">{getContextLabel(value)}</span>
        </div>
      )}
    </div>
  );
};

export default HelpContextPicker;
