import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, User, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { requestZoom100 } from '@/lib/zoom';

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
      .select('phone_number, full_name, position, department, user_id')
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
        const code = String(h.phone_number || '').trim();
        const name = String(h.full_name || '').trim();
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
  onValueChange,
  placeholder = 'انتخاب نیرو',
  excludeCodes = [],
}: StaffSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredStaff]);

  const handleSelect = (staff: StaffMember) => {
    onValueChange(staff.code, staff.name, staff.user_id);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('', '');
  };

  const updatePosition = () => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();

    const VIEWPORT_MARGIN = 8;
    const OFFSET = 4;

    const boundaryEl = triggerEl.closest('[data-dropdown-boundary]') as HTMLElement | null;
    portalRootRef.current = boundaryEl;

    const isRTL = document.documentElement.dir === 'rtl' || !!triggerEl.closest('[dir="rtl"]');

    // Position inside boundary (Daily Report cards) to avoid CSS `zoom` coordinate issues.
    if (boundaryEl) {
      const b = boundaryEl.getBoundingClientRect();

      const availableWidth = Math.max(200, b.width - VIEWPORT_MARGIN * 2);
      const width = Math.min(Math.max(rect.width, 320), availableWidth);

      let left = isRTL ? rect.right - b.left - width : rect.left - b.left;
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, b.width - VIEWPORT_MARGIN - width));

      const spaceAbove = rect.top - b.top - OFFSET - VIEWPORT_MARGIN;
      const spaceBelow = b.bottom - rect.bottom - OFFSET - VIEWPORT_MARGIN;
      const openBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;

      if (openBelow) {
        const maxHeight = Math.min(520, Math.max(180, spaceBelow));
        setPosition({
          top: rect.bottom - b.top + OFFSET,
          bottom: undefined,
          left,
          width,
          maxHeight,
        });
      } else {
        const maxHeight = Math.min(520, Math.max(180, spaceAbove));
        setPosition({
          top: undefined,
          bottom: b.bottom - rect.top + OFFSET,
          left,
          width,
          maxHeight,
        });
      }

      return;
    }

    // Fallback: fixed to viewport
    const boundLeft = VIEWPORT_MARGIN;
    const boundRight = window.innerWidth - VIEWPORT_MARGIN;
    const boundTop = VIEWPORT_MARGIN;
    const boundBottom = window.innerHeight - VIEWPORT_MARGIN;

    const availableWidth = Math.max(200, boundRight - boundLeft);
    const width = Math.min(Math.max(rect.width, 320), availableWidth);

    let left = isRTL ? rect.right - width : rect.left;
    left = Math.max(boundLeft, Math.min(left, boundRight - width));

    const spaceAbove = rect.top - boundTop - OFFSET;
    const spaceBelow = boundBottom - rect.bottom - OFFSET;

    const openBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;

    if (openBelow) {
      const maxHeight = Math.min(520, Math.max(180, spaceBelow));
      setPosition({
        top: rect.bottom + OFFSET,
        bottom: undefined,
        left,
        width,
        maxHeight,
      });
    } else {
      const maxHeight = Math.min(520, Math.max(180, spaceAbove));
      setPosition({
        top: undefined,
        bottom: window.innerHeight - rect.top + OFFSET,
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

    // Force 100% zoom (and keep it) so portal positioning stays correct
    requestZoom100({ preserveScroll: true });

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
        className="w-full justify-between bg-white/50 hover:bg-white/70 text-right min-w-[180px]"
      >
        <span className="truncate flex-1 text-right">
          {selectedStaff
            ? `${selectedStaff.name} - ${selectedStaff.code}`
            : value
              ? value
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
                <div className="p-1 bg-background">
                  {sortedStaff.map((staff) => (
                    <button
                      key={staff.code}
                      type="button"
                      onClick={() => handleSelect(staff)}
                      className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer ${
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
                </div>
              )}
            </ScrollArea>
          </div>,
          portalRootRef.current ?? document.body,
        )}
    </div>
  );
}
