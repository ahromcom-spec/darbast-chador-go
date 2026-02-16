import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, X, Loader2, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { getCurrentZoom } from '@/lib/zoom';

// Staff list now only comes from HR employees and salary settings

interface StaffMember {
  code: string;
  name: string;
  fullCode: string;
  source?: 'hr' | 'salary';
  user_id?: string | null;
}

interface StaffSearchSelectProps {
  value: string;
  displayName?: string;
  onValueChange: (value: string, staffName: string, userId?: string | null) => void;
  placeholder?: string;
  excludeCodes?: string[];
}

// ---- Shared cache (prevents N instances from fetching the same data) ----
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000;
let staffCache:
  | {
      fetchedAt: number;
      hrStaff: StaffMember[];
      salaryStaff: StaffMember[];
    }
  | null = null;
let staffCachePromise: Promise<{
  hrStaff: StaffMember[];
  salaryStaff: StaffMember[];
}> | null = null;

const normalizeStaffName = (code: string, rawName: string) => {
  const name = (rawName || '').trim();
  if (!name) return '';

  // If stored as "{code} - {name}", remove the prefix.
  const prefix = `${code} -`;
  if (name.startsWith(prefix)) return name.slice(prefix.length).trim();

  // Sometimes phone appears at beginning without dash.
  if (name.startsWith(code)) return name.slice(code.length).trim().replace(/^[-–—]\s*/, '');

  return name;
};

const buildPhoneVariants = (phone: string) => {
  const p = (phone || '').trim();
  const variants = new Set<string>();
  if (!p) return variants;
  variants.add(p);
  if (p.startsWith('0')) variants.add(p.substring(1));
  return variants;
};

const loadStaffDirectoryCached = async () => {
  const now = Date.now();
  if (staffCache && now - staffCache.fetchedAt < STAFF_CACHE_TTL_MS) {
    return { hrStaff: staffCache.hrStaff, salaryStaff: staffCache.salaryStaff };
  }
  if (staffCachePromise) return staffCachePromise;

  staffCachePromise = (async () => {
    // 1) HR employees (best source for user_id)
    const { data: hrData, error: hrError } = await supabase
      .from('hr_employees')
      .select('id, phone_number, full_name, position, department, user_id')
      .order('full_name', { ascending: true });

    if (hrError) throw hrError;

    const phoneToUserMap = new Map<string, string>();
    (hrData || []).forEach((h: any) => {
      const phone = String(h.phone_number || '').trim();
      const userId = h.user_id ? String(h.user_id) : '';
      if (!phone || !userId) return;
      for (const v of buildPhoneVariants(phone)) phoneToUserMap.set(v, userId);
    });

    const hrStaff: StaffMember[] = (hrData || [])
      .map((h: any) => {
        const phone = String(h.phone_number || '').trim();
        const name = String(h.full_name || '').trim();
        // For employees without a phone number, use a short code derived from their DB id
        const code = phone || (h.id ? `HR-${String(h.id).slice(-6)}` : '');
        const fullCode = `${h.position || ''} - ${h.department || ''}`
          .trim()
          .replace(/^-\s*|\s*-$/g, '');
        const userId = h.user_id ? String(h.user_id) : null;
        return {
          code,
          name,
          fullCode,
          source: 'hr' as const,
          user_id: userId,
        };
      })
      .filter((s) => s.code && s.name);

    // 2) Salary settings (helps include staff even if not present in HR yet)
    const { data: salaryData, error: salaryError } = await supabase
      .from('staff_salary_settings')
      .select('staff_code, staff_name');

    if (salaryError) throw salaryError;

    const salaryStaff: StaffMember[] = (salaryData || [])
      .map((s: any) => {
        const code = String(s.staff_code || '').trim();
        const rawName = String(s.staff_name || '').trim();
        const name = normalizeStaffName(code, rawName);

        // Try to match a phone number inside staff_name to HR -> user_id
        const phoneMatch = rawName.match(/09\d{9}/);
        const matchedUserId = phoneMatch ? phoneToUserMap.get(phoneMatch[0]) : undefined;

        return {
          code,
          name: name || rawName,
          fullCode: code,
          source: 'salary' as const,
          user_id: matchedUserId || null,
        };
      })
      .filter((s) => s.code && s.name);

    staffCache = { fetchedAt: Date.now(), hrStaff, salaryStaff };
    return { hrStaff, salaryStaff };
  })()
    .finally(() => {
      staffCachePromise = null;
    });

  return staffCachePromise;
};

export function StaffSearchSelect({
  value,
  displayName,
  onValueChange,
  placeholder = 'انتخاب نیرو',
  excludeCodes = [],
}: StaffSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [hrStaff, setHrStaff] = useState<StaffMember[]>([]);
  const [salaryStaff, setSalaryStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRootRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ left: number; width: number; maxHeight: number; top?: number; bottom?: number }>({
    top: 0,
    bottom: undefined,
    left: 0,
    width: 0,
    maxHeight: 520,
  });

  // Fetch staff once (cached across all instances)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadStaffDirectoryCached()
      .then(({ hrStaff, salaryStaff }) => {
        if (cancelled) return;
        setHrStaff(hrStaff);
        setSalaryStaff(salaryStaff);
      })
      .catch((error) => {
        console.error('Error fetching staff:', error);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Combine HR and salary staff lists, removing duplicates by code
  const allStaff = useMemo(() => {
    // Prefer the entry linked to real user_id for wallet/accounting sync
    const combined = [...salaryStaff, ...hrStaff];

    const score = (s: StaffMember) => {
      const sourceScore = s.source === 'hr' ? 3 : 2;
      const hasUserScore = s.user_id ? 100 : 0;
      return hasUserScore + sourceScore;
    };

    const uniqueMap = new Map<string, StaffMember>();
    for (const staff of combined) {
      const existing = uniqueMap.get(staff.code);
      if (!existing || score(staff) > score(existing)) {
        uniqueMap.set(staff.code, staff);
      }
    }

    return Array.from(uniqueMap.values());
  }, [hrStaff, salaryStaff]);

  const selectedStaff = allStaff.find((s) => s.code === value);

  const filteredStaff = useMemo(() => {
    const availableStaff = allStaff.filter((staff) => staff.code === value || !excludeCodes.includes(staff.code));

    if (!search.trim()) return availableStaff;

    const searchLower = search.toLowerCase().trim();
    return availableStaff.filter((staff) => {
      const code = staff.code.toLowerCase();
      const name = staff.name.toLowerCase();
      const fullCode = staff.fullCode.toLowerCase();

      return code.includes(searchLower) || name.includes(searchLower) || fullCode.includes(searchLower);
    });
  }, [search, allStaff, excludeCodes, value]);

  // MRU: read recently-used codes from localStorage
  const MRU_KEY = 'staff_search_mru';
  const getMruList = (): string[] => {
    try { return JSON.parse(localStorage.getItem(MRU_KEY) || '[]'); } catch { return []; }
  };
  const pushMru = (code: string) => {
    const list = getMruList().filter(c => c !== code);
    list.unshift(code);
    localStorage.setItem(MRU_KEY, JSON.stringify(list.slice(0, 30)));
  };

  const sortedStaff = useMemo(() => {
    const mru = getMruList();
    const mruIndex = new Map(mru.map((c, i) => [c, i]));
    return [...filteredStaff].sort((a, b) => {
      const aIdx = mruIndex.has(a.code) ? mruIndex.get(a.code)! : 99999;
      const bIdx = mruIndex.has(b.code) ? mruIndex.get(b.code)! : 99999;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.code.localeCompare(b.code);
    });
  }, [filteredStaff]);

  const listRef = useRef<HTMLDivElement>(null);

  const handleSelect = (staff: StaffMember) => {
    pushMru(staff.code);
    onValueChange(staff.code, staff.name, staff.user_id);
    setOpen(false);
    setSearch('');
    setManualMode(false);
    setManualName('');
  };

  const handleManualSubmit = () => {
    const name = manualName.trim();
    if (!name) return;
    const code = `MANUAL-${Date.now()}`;
    onValueChange(code, name, null);
    setOpen(false);
    setSearch('');
    setManualMode(false);
    setManualName('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('', '');
  };

  const updatePosition = () => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    // Account for CSS zoom on documentElement
    const zoomLevel = getCurrentZoom();

    const rect = triggerEl.getBoundingClientRect();

    const VIEWPORT_MARGIN = 8;
    const OFFSET = 4;

    const boundaryEl = triggerEl.closest('[data-dropdown-boundary]') as HTMLElement | null;
    portalRootRef.current = boundaryEl;

    const isRTL = document.documentElement.dir === 'rtl' || !!triggerEl.closest('[dir="rtl"]');

    // Position inside boundary (Daily Report cards) to avoid coordinate issues.
    if (boundaryEl) {
      const b = boundaryEl.getBoundingClientRect();
      const adjustedRect = {
        left: rect.left / zoomLevel,
        right: rect.right / zoomLevel,
        top: rect.top / zoomLevel,
        bottom: rect.bottom / zoomLevel,
        width: rect.width / zoomLevel,
      };
      const adjustedBoundary = {
        left: b.left / zoomLevel,
        right: b.right / zoomLevel,
        top: b.top / zoomLevel,
        bottom: b.bottom / zoomLevel,
        width: b.width / zoomLevel,
        height: b.height / zoomLevel,
      };

      const availableWidth = Math.max(200, adjustedBoundary.width - VIEWPORT_MARGIN * 2);
      const width = Math.min(Math.max(adjustedRect.width, 320), availableWidth);

      let left = isRTL ? adjustedRect.right - adjustedBoundary.left - width : adjustedRect.left - adjustedBoundary.left;
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, adjustedBoundary.width - VIEWPORT_MARGIN - width));

      const spaceAbove = adjustedRect.top - adjustedBoundary.top - OFFSET - VIEWPORT_MARGIN;
      const spaceBelow = adjustedBoundary.bottom - adjustedRect.bottom - OFFSET - VIEWPORT_MARGIN;
      const openBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;

      if (openBelow) {
        const maxHeight = Math.min(520, Math.max(180, spaceBelow));
        setPosition({
          top: adjustedRect.bottom - adjustedBoundary.top + OFFSET,
          bottom: undefined,
          left,
          width,
          maxHeight,
        });
      } else {
        const maxHeight = Math.min(520, Math.max(180, spaceAbove));
        setPosition({
          top: undefined,
          bottom: adjustedBoundary.bottom - adjustedRect.top + OFFSET,
          left,
          width,
          maxHeight,
        });
      }

      return;
    }

    // Fallback: fixed to viewport (divide by zoom for CSS coords)
    const viewportWidth = window.innerWidth / zoomLevel;
    const viewportHeight = window.innerHeight / zoomLevel;

    const adjustedRect = {
      left: rect.left / zoomLevel,
      right: rect.right / zoomLevel,
      top: rect.top / zoomLevel,
      bottom: rect.bottom / zoomLevel,
      width: rect.width / zoomLevel,
    };

    const boundLeft = VIEWPORT_MARGIN;
    const boundRight = viewportWidth - VIEWPORT_MARGIN;
    const boundTop = VIEWPORT_MARGIN;
    const boundBottom = viewportHeight - VIEWPORT_MARGIN;

    const availableWidth = Math.max(200, boundRight - boundLeft);
    const width = Math.min(Math.max(adjustedRect.width, 320), availableWidth);

    let left = isRTL ? adjustedRect.right - width : adjustedRect.left;
    left = Math.max(boundLeft, Math.min(left, boundRight - width));

    const spaceAbove = adjustedRect.top - boundTop - OFFSET;
    const spaceBelow = boundBottom - adjustedRect.bottom - OFFSET;

    const openBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;

    if (openBelow) {
      const maxHeight = Math.min(520, Math.max(180, spaceBelow));
      setPosition({
        top: adjustedRect.bottom + OFFSET,
        bottom: undefined,
        left,
        width,
        maxHeight,
      });
    } else {
      const maxHeight = Math.min(520, Math.max(180, spaceAbove));
      setPosition({
        top: undefined,
        bottom: viewportHeight - adjustedRect.top + OFFSET,
        left,
        width,
        maxHeight,
      });
    }
  };

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }

    requestAnimationFrame(() => {
      updatePosition();
      setOpen(true);
    });
  };

  // On mobile we don't auto-focus the search input (prevents keyboard covering the screen)
  useEffect(() => {
    if (!open || isMobile) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, isMobile]);

  // Keep dropdown anchored when outer scroll happens (table/page) and on resize.
  // We ignore scroll events that originate from inside the dropdown itself so the list can scroll smoothly.
  useEffect(() => {
    if (!open) return;

    const onResize = () => updatePosition();
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && dropdownRef.current?.contains(target)) return;
      updatePosition();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Handle click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={handleToggle}
        className="w-full justify-between bg-white/50 hover:bg-white/70 text-right min-w-[100px] h-auto min-h-[36px] py-1"
      >
        <span className="truncate flex-1 text-right text-xs leading-snug whitespace-normal line-clamp-2">
          {selectedStaff
            ? selectedStaff.code.length > 20 ? selectedStaff.name : `${selectedStaff.name} - ${selectedStaff.code}`
            : value
              ? (displayName || value)
              : placeholder}
        </span>
        {selectedStaff || value ? (
          <X className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" onClick={handleClear} />
        ) : (
          <User className="h-4 w-4 shrink-0 opacity-50" />
        )}
      </Button>

      {open && position.width > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className={(portalRootRef.current ? 'absolute' : 'fixed') + ' bg-background border rounded-lg shadow-xl overflow-hidden'}
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              zIndex: 99999,
              maxHeight: position.maxHeight,
            }}
            dir="rtl"
          >
            <div className="p-3 border-b bg-background">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const firstBtn = listRef.current?.querySelector('button') as HTMLElement | null;
                      firstBtn?.focus();
                    }
                  }}
                  placeholder="جستجو با نام یا کد پرسنل..."
                  compactFocus
                  className="pr-10 text-sm h-10"
                />
              </div>
            </div>
            <ScrollArea style={{ height: Math.max(140, position.maxHeight - 64) }}>
              {loading ? (
                <div className="py-6 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin ml-2" />
                  <span>در حال بارگذاری...</span>
                </div>
              ) : sortedStaff.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">پرسنلی یافت نشد</div>
              ) : (
                <div ref={listRef} className="p-1 bg-background">
                  {sortedStaff.map((staff, idx) => (
                    <button
                      key={staff.code}
                      type="button"
                      onClick={() => handleSelect(staff)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const next = (e.currentTarget.nextElementSibling as HTMLElement | null);
                          next?.focus();
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prev = (e.currentTarget.previousElementSibling as HTMLElement | null);
                          if (prev) prev.focus();
                          else searchInputRef.current?.focus();
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSelect(staff);
                        }
                      }}
                      className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer focus:bg-accent focus:outline-none ${
                        value === staff.code ? 'bg-amber-100 dark:bg-amber-900/30' : ''
                      }`}
                    >
                      <div className="font-medium flex items-center gap-2">
                        <span
                          className={`font-bold text-xs px-1.5 py-0.5 rounded ${
                            staff.source === 'salary'
                              ? 'text-green-600 bg-green-100 dark:bg-green-900/30'
                              : 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
                          }`}
                        >
                          {staff.code}
                        </span>
                        <span>{staff.name}</span>
                        {staff.fullCode && staff.fullCode !== staff.code && (
                          <span className="text-xs text-muted-foreground">({staff.fullCode})</span>
                        )}
                      </div>
                    </button>
                  ))}
                  
                  {/* Manual entry section */}
                  <div className="border-t mt-1 pt-1">
                    {manualMode ? (
                      <div className="px-2 py-2 flex items-center gap-2">
                        <Input
                          ref={manualInputRef}
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleManualSubmit(); }
                            if (e.key === 'Escape') { setManualMode(false); setManualName(''); }
                          }}
                          placeholder="نام نیرو را وارد کنید..."
                          className="text-sm h-9 flex-1"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleManualSubmit}
                          disabled={!manualName.trim()}
                          className="shrink-0 h-9"
                        >
                          تایید
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setManualMode(true); setTimeout(() => manualInputRef.current?.focus(), 50); }}
                        className="w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer focus:bg-accent focus:outline-none text-muted-foreground flex items-center gap-2"
                      >
                        <PenLine className="h-4 w-4" />
                        <span>ورود دستی نام نیرو...</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>,
          portalRootRef.current ?? document.body,
        )}
    </div>
  );
}
