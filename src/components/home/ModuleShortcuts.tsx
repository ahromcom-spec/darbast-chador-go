import { useNavigate } from 'react-router-dom';
import { Building2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModuleShortcuts } from '@/hooks/useModuleShortcuts';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function ModuleShortcuts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { shortcuts, isLoading, removeShortcut } = useModuleShortcuts();

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

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
        <h3 className="text-white/90 text-sm font-medium mb-3 text-center">میانبرهای ماژول</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shortcuts.map((s) => (
            <button
              key={s.id}
              onClick={() => handleNavigate(s)}
              className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 hover:border-white/30"
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 left-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-red-400 hover:bg-red-400/20"
                onClick={(e) => handleRemove(e, s.module_key)}
              >
                <X className="h-3 w-3" />
              </Button>
              <div className="p-2 rounded-lg bg-white/10">
                <Building2 className="h-5 w-5 text-white/80" />
              </div>
              <span className="text-white/90 text-xs font-medium text-center leading-tight line-clamp-2">
                {s.module_name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
