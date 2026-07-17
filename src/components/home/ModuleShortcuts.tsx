import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Palette, ExternalLink, Smartphone, Copy } from 'lucide-react';
import { getModuleIconByKey } from '@/components/module-shortcut/ModuleIcon';
import { Button } from '@/components/ui/button';
import { useModuleShortcuts } from '@/hooks/useModuleShortcuts';
import { useAuth } from '@/contexts/AuthContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const SHORTCUT_COLORS = [
  { name: 'پیش‌فرض', value: null, bg: 'bg-white/10', text: 'text-white/90', icon: 'text-white/80', border: 'border-white/10' },
  { name: 'آبی', value: 'blue', bg: 'bg-blue-600', text: 'text-white', icon: 'text-white', border: 'border-blue-400' },
  { name: 'سبز', value: 'green', bg: 'bg-emerald-600', text: 'text-white', icon: 'text-white', border: 'border-emerald-400' },
  { name: 'قرمز', value: 'red', bg: 'bg-red-600', text: 'text-white', icon: 'text-white', border: 'border-red-400' },
  { name: 'بنفش', value: 'purple', bg: 'bg-purple-600', text: 'text-white', icon: 'text-white', border: 'border-purple-400' },
  { name: 'نارنجی', value: 'orange', bg: 'bg-orange-600', text: 'text-white', icon: 'text-white', border: 'border-orange-400' },
  { name: 'زرد', value: 'yellow', bg: 'bg-yellow-500', text: 'text-black', icon: 'text-black', border: 'border-yellow-300' },
  { name: 'صورتی', value: 'pink', bg: 'bg-pink-600', text: 'text-white', icon: 'text-white', border: 'border-pink-400' },
  { name: 'سفید', value: 'white', bg: 'bg-white', text: 'text-black', icon: 'text-black', border: 'border-gray-300' },
  { name: 'سیاه', value: 'black', bg: 'bg-gray-900', text: 'text-white', icon: 'text-white', border: 'border-gray-600' },
  { name: 'سرمه‌ای', value: 'navy', bg: 'bg-slate-800', text: 'text-white', icon: 'text-white', border: 'border-slate-500' },
  { name: 'قهوه‌ای', value: 'brown', bg: 'bg-amber-900', text: 'text-white', icon: 'text-white', border: 'border-amber-600' },
  { name: 'فیروزه‌ای', value: 'teal', bg: 'bg-teal-600', text: 'text-white', icon: 'text-white', border: 'border-teal-400' },
];

function getColorClasses(color: string | null) {
  return SHORTCUT_COLORS.find((c) => c.value === color) || SHORTCUT_COLORS[0];
}

export function ModuleShortcuts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shortcuts, isLoading, removeShortcut, updateColor, reorderShortcuts } = useModuleShortcuts();
  const { canInstall, isIOS, promptInstall } = usePWAInstall();
  const [colorPickerKey, setColorPickerKey] = useState<string | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ shortcut: typeof shortcuts[0]; top: number; left: number } | null>(null);
  const [installDialog, setInstallDialog] = useState<{ url: string; name: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const touchStartY = useRef(0);
  const touchStartIndex = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!colorPickerKey) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colorPickerKey]);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  if (!user || isLoading || shortcuts.length === 0) return null;

  const buildModuleUrl = (shortcut: typeof shortcuts[0]) => {
    if (!shortcut.module_href) return '';
    try {
      const url = new URL(shortcut.module_href, window.location.origin);
      url.searchParams.set('moduleKey', shortcut.module_key);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      const sep = shortcut.module_href.includes('?') ? '&' : '?';
      return `${shortcut.module_href}${sep}moduleKey=${encodeURIComponent(shortcut.module_key)}`;
    }
  };

  const handleNavigate = (shortcut: typeof shortcuts[0]) => {
    const path = buildModuleUrl(shortcut);
    if (path) navigate(path);
  };

  const openContextMenu = (shortcut: typeof shortcuts[0], clientX: number, clientY: number) => {
    const menuWidth = 240;
    const menuHeight = 130;
    const left = Math.min(clientX, window.innerWidth - menuWidth - 8);
    const top = Math.min(clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ shortcut, top, left });
  };

  const handleOpenInNewTab = (shortcut: typeof shortcuts[0]) => {
    const path = buildModuleUrl(shortcut);
    if (path) window.open(path, '_blank', 'noopener,noreferrer');
    setContextMenu(null);
  };

  const handleAddToHomeScreen = async (shortcut: typeof shortcuts[0]) => {
    setContextMenu(null);
    if (canInstall) {
      const result = await promptInstall();
      if (result.outcome === 'accepted') {
        toast.success('برنامه به صفحه نخست اضافه شد');
        return;
      }
    }
    const path = buildModuleUrl(shortcut);
    const fullUrl = `${window.location.origin}${path}`;
    setInstallDialog({ url: fullUrl, name: shortcut.module_name });
  };


  const handleRemove = async (e: React.MouseEvent, moduleKey: string) => {
    e.stopPropagation();
    const ok = await removeShortcut(moduleKey);
    if (ok) toast.success('میانبر حذف شد');
  };

  const handleColorToggle = (e: React.MouseEvent, moduleKey: string) => {
    e.stopPropagation();
    const card = (e.currentTarget as HTMLElement).closest('[data-shortcut-card]') as HTMLElement | null;
    const rect = (card || e.currentTarget).getBoundingClientRect();
    setColorPickerPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setColorPickerKey((prev) => {
      const next = prev === moduleKey ? null : moduleKey;
      if (!next) setColorPickerPosition(null);
      return next;
    });
  };

  const handleColorSelect = async (e: React.MouseEvent, moduleKey: string, color: string | null) => {
    e.stopPropagation();
    await updateColor(moduleKey, color);
    setColorPickerKey(null);
    setColorPickerPosition(null);
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const reordered = [...shortcuts];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    dragItem.current = null;
    dragOverItem.current = null;
    reorderShortcuts(reordered);
  };

  // Touch drag support

  const handleTouchStart = (index: number, e: React.TouchEvent, shortcut: typeof shortcuts[0]) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartIndex.current = index;
    dragItem.current = index;
    longPressFired.current = false;
    const tx = e.touches[0].clientX;
    const ty = e.touches[0].clientY;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      openContextMenu(shortcut, tx, ty);
    }, 600);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const target = elements.find((el) => el.getAttribute('data-shortcut-index'));
    if (target) {
      dragOverItem.current = parseInt(target.getAttribute('data-shortcut-index')!, 10);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    handleDragEnd();
    touchStartIndex.current = null;
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
        <h3 className="text-white/90 text-sm font-medium mb-3 text-center">میانبرهای ماژول</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-fr">
          {shortcuts.map((s, index) => {
            const colors = getColorClasses(s.color);
            const Icon = getModuleIconByKey(s.module_key, s.module_name);
            return (
              <div key={s.id} data-shortcut-card className="relative h-full">
                <button
                  data-shortcut-index={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onTouchStart={(e) => handleTouchStart(index, e, s)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu(s, e.clientX, e.clientY);
                  }}
                  onClick={(e) => {
                    if (longPressFired.current) {
                      e.preventDefault();
                      longPressFired.current = false;
                      return;
                    }
                    handleNavigate(s);
                  }}
                  className={`group relative w-full h-full min-h-[100px] flex flex-col items-center justify-center gap-2 p-3 rounded-xl ${colors.bg} hover:brightness-125 transition-all border ${colors.border} cursor-grab active:cursor-grabbing`}
                >
                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 left-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-red-400 hover:bg-red-400/20"
                    onClick={(e) => handleRemove(e, s.module_key)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  {/* Color picker button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-white hover:bg-white/20"
                    onClick={(e) => handleColorToggle(e, s.module_key)}
                  >
                    <Palette className="h-3 w-3" />
                  </Button>
                  <Icon className={`h-10 w-10 ${colors.icon}`} />
                  <span className={`${colors.text} text-xs font-medium text-center leading-tight min-h-[2.5em] flex items-center justify-center line-clamp-2`}>
                    {s.module_name}
                  </span>
                </button>

                {/* Color picker dropdown */}
                {colorPickerKey === s.module_key && colorPickerPosition && createPortal(
                  <div
                    ref={colorPickerRef}
                    className="fixed z-[300000] bg-gray-900/95 backdrop-blur-lg rounded-lg p-2 border border-white/20 shadow-2xl"
                    style={{ top: colorPickerPosition.top, left: colorPickerPosition.left, width: colorPickerPosition.width }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {SHORTCUT_COLORS.map((c) => (
                        <button
                          key={c.value ?? 'default'}
                          title={c.name}
                          onClick={(e) => handleColorSelect(e, s.module_key, c.value)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                            s.color === c.value ? 'border-white scale-110' : 'border-white/30'
                          } ${c.value === null ? 'bg-white/20' : ''}`}
                          style={
                            c.value
                              ? {
                                  backgroundColor: {
                                    blue: '#3b82f6',
                                    green: '#10b981',
                                    red: '#ef4444',
                                    purple: '#a855f7',
                                    orange: '#f97316',
                                    yellow: '#eab308',
                                    pink: '#ec4899',
                                    white: '#ffffff',
                                    black: '#111827',
                                    navy: '#1e293b',
                                    brown: '#78350f',
                                    teal: '#0d9488',
                                  }[c.value],
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context menu (right-click / long-press) */}
      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-[300001] bg-gray-900/95 backdrop-blur-lg rounded-lg border border-white/20 shadow-2xl py-1 min-w-[220px]"
          style={{ top: contextMenu.top, left: contextMenu.left }}
        >
          <button
            onClick={() => handleOpenInNewTab(contextMenu.shortcut)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 text-right"
          >
            <ExternalLink className="h-4 w-4 text-white/70" />
            <span>باز کردن در تب جدید</span>
          </button>
          <button
            onClick={() => handleAddToHomeScreen(contextMenu.shortcut)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 text-right"
          >
            <Smartphone className="h-4 w-4 text-white/70" />
            <span>افزودن به صفحه نخست گوشی/ویندوز</span>
          </button>
        </div>,
        document.body
      )}

      {/* Add to home screen instructions dialog */}
      <Dialog open={!!installDialog} onOpenChange={(open) => !open && setInstallDialog(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن «{installDialog?.name}» به صفحه نخست</DialogTitle>
            <DialogDescription>
              برای دسترسی سریع به این ماژول، آن را به صفحه نخست گوشی یا دسکتاپ خود اضافه کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-muted/40 rounded p-2 flex items-center justify-between gap-2">
              <code className="text-xs break-all flex-1">{installDialog?.url}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (installDialog) {
                    navigator.clipboard.writeText(installDialog.url);
                    toast.success('لینک کپی شد');
                  }
                }}
              >
                <Copy className="h-3 w-3 ml-1" />
                کپی
              </Button>
            </div>
            {isIOS ? (
              <div className="space-y-1">
                <p className="font-semibold">آیفون / آیپد (Safari):</p>
                <ol className="list-decimal mr-5 space-y-1 text-muted-foreground">
                  <li>دکمه «اشتراک‌گذاری» را در پایین مرورگر بزنید</li>
                  <li>گزینه «Add to Home Screen» را انتخاب کنید</li>
                  <li>نام را تایید کرده و Add را بزنید</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold">اندروید (Chrome) / دسکتاپ:</p>
                <ol className="list-decimal mr-5 space-y-1 text-muted-foreground">
                  <li>روی دکمه زیر بزنید تا صفحه ماژول در تب جدید باز شود</li>
                  <li>از منوی مرورگر (سه‌نقطه) گزینه «Add to Home screen» یا «Install app» را بزنید</li>
                  <li>نام میانبر را تایید کنید</li>
                </ol>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="default"
              onClick={() => {
                if (installDialog) {
                  window.open(installDialog.url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <ExternalLink className="h-4 w-4 ml-1" />
              باز کردن صفحه ماژول
            </Button>
            <Button variant="outline" onClick={() => setInstallDialog(null)}>بستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
