import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Palette } from 'lucide-react';
import { getModuleIconByKey } from '@/components/module-shortcut/ModuleIcon';
import { Button } from '@/components/ui/button';
import { useModuleShortcuts } from '@/hooks/useModuleShortcuts';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SHORTCUT_COLORS = [
  { name: 'پیش‌فرض', value: null, bg: 'bg-white/10', text: 'text-white/90', icon: 'text-white/80', border: 'border-white/10' },
  { name: 'آبی', value: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-200', icon: 'text-blue-300', border: 'border-blue-400/30' },
  { name: 'سبز', value: 'green', bg: 'bg-emerald-500/20', text: 'text-emerald-200', icon: 'text-emerald-300', border: 'border-emerald-400/30' },
  { name: 'قرمز', value: 'red', bg: 'bg-red-500/20', text: 'text-red-200', icon: 'text-red-300', border: 'border-red-400/30' },
  { name: 'بنفش', value: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-200', icon: 'text-purple-300', border: 'border-purple-400/30' },
  { name: 'نارنجی', value: 'orange', bg: 'bg-orange-500/20', text: 'text-orange-200', icon: 'text-orange-300', border: 'border-orange-400/30' },
  { name: 'زرد', value: 'yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-200', icon: 'text-yellow-300', border: 'border-yellow-400/30' },
  { name: 'صورتی', value: 'pink', bg: 'bg-pink-500/20', text: 'text-pink-200', icon: 'text-pink-300', border: 'border-pink-400/30' },
];

function getColorClasses(color: string | null) {
  return SHORTCUT_COLORS.find((c) => c.value === color) || SHORTCUT_COLORS[0];
}

export function ModuleShortcuts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shortcuts, isLoading, removeShortcut, updateColor, reorderShortcuts } = useModuleShortcuts();
  const [colorPickerKey, setColorPickerKey] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const touchStartY = useRef(0);
  const touchStartIndex = useRef<number | null>(null);

  if (!user || isLoading || shortcuts.length === 0) return null;

  const handleNavigate = (shortcut: typeof shortcuts[0]) => {
    if (!shortcut.module_href) return;
    try {
      const url = new URL(shortcut.module_href, window.location.origin);
      url.searchParams.set('moduleKey', shortcut.module_key);
      navigate(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      const sep = shortcut.module_href.includes('?') ? '&' : '?';
      navigate(`${shortcut.module_href}${sep}moduleKey=${encodeURIComponent(shortcut.module_key)}`);
    }
  };

  const handleRemove = async (e: React.MouseEvent, moduleKey: string) => {
    e.stopPropagation();
    const ok = await removeShortcut(moduleKey);
    if (ok) toast.success('میانبر حذف شد');
  };

  const handleColorToggle = (e: React.MouseEvent, moduleKey: string) => {
    e.stopPropagation();
    setColorPickerKey((prev) => (prev === moduleKey ? null : moduleKey));
  };

  const handleColorSelect = async (e: React.MouseEvent, moduleKey: string, color: string | null) => {
    e.stopPropagation();
    await updateColor(moduleKey, color);
    setColorPickerKey(null);
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

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartIndex.current = index;
    dragItem.current = index;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const target = elements.find((el) => el.getAttribute('data-shortcut-index'));
    if (target) {
      dragOverItem.current = parseInt(target.getAttribute('data-shortcut-index')!, 10);
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
    touchStartIndex.current = null;
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
        <h3 className="text-white/90 text-sm font-medium mb-3 text-center">میانبرهای ماژول</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shortcuts.map((s, index) => {
            const colors = getColorClasses(s.color);
            const Icon = getModuleIconByKey(s.module_key, s.module_name);
            return (
              <div key={s.id} className="relative">
                <button
                  data-shortcut-index={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={() => handleNavigate(s)}
                  className={`group relative w-full flex flex-col items-center gap-2 p-3 rounded-xl ${colors.bg} hover:brightness-125 transition-all border ${colors.border} cursor-grab active:cursor-grabbing`}
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
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <Icon className={`h-5 w-5 ${colors.icon}`} />
                  </div>
                  <span className={`${colors.text} text-xs font-medium text-center leading-tight line-clamp-2`}>
                    {s.module_name}
                  </span>
                </button>

                {/* Color picker dropdown */}
                {colorPickerKey === s.module_key && (
                  <div
                    className="absolute top-full mt-1 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg rounded-lg p-2 border border-white/20 shadow-xl"
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
                                  }[c.value],
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
