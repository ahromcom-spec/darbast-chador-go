import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Package, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface Order {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone?: string | null;
  address: string;
  subcategory_name?: string;
  activity_description?: string;
}

interface OrderSearchSelectProps {
  orders: Order[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function OrderSearchSelect({
  orders,
  value,
  onValueChange,
  placeholder = 'انتخاب سفارش'
}: OrderSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const selectedOrder = orders.find(o => o.id === value);

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;

    const searchLower = search.toLowerCase().trim();
    return orders.filter(order => {
      const code = order.code?.toLowerCase() || '';
      const customerName = order.customer_name?.toLowerCase() || '';
      const customerPhone = order.customer_phone?.toLowerCase() || '';
      const address = order.address?.toLowerCase() || '';
      const subcategory = order.subcategory_name?.toLowerCase() || '';
      const activityDesc = order.activity_description?.toLowerCase() || '';

      return (
        code.includes(searchLower) ||
        customerName.includes(searchLower) ||
        customerPhone.includes(searchLower) ||
        address.includes(searchLower) ||
        subcategory.includes(searchLower) ||
        activityDesc.includes(searchLower)
      );
    });
  }, [orders, search]);

  const handleSelect = (orderId: string) => {
    onValueChange(orderId);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('');
  };

  const updatePosition = () => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();

    const VIEWPORT_MARGIN = 8;
    const OFFSET = 4;

    const boundaryEl = triggerEl.closest('[data-dropdown-boundary]') as HTMLElement | null;
    portalRootRef.current = boundaryEl;

    const isRTL =
      document.documentElement.dir === 'rtl' || !!triggerEl.closest('[dir="rtl"]');

    // If we're inside a Daily Report "side box" (boundary), position *inside that box*.
    // This avoids CSS `zoom` coordinate issues at 115%.
    if (boundaryEl) {
      const b = boundaryEl.getBoundingClientRect();

      const availableWidth = Math.max(220, b.width - VIEWPORT_MARGIN * 2);
      const width = Math.min(Math.max(rect.width, 350), availableWidth);

      let left = isRTL ? rect.right - b.left - width : rect.left - b.left;
      left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(left, b.width - VIEWPORT_MARGIN - width),
      );

      const spaceAbove = rect.top - b.top - OFFSET - VIEWPORT_MARGIN;
      const spaceBelow = b.bottom - rect.bottom - OFFSET - VIEWPORT_MARGIN;
      const openBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove;

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

    // Fallback: fixed to viewport (other pages)
    const boundLeft = VIEWPORT_MARGIN;
    const boundRight = window.innerWidth - VIEWPORT_MARGIN;
    const boundTop = VIEWPORT_MARGIN;
    const boundBottom = window.innerHeight - VIEWPORT_MARGIN;

    const availableWidth = Math.max(220, boundRight - boundLeft);
    const width = Math.min(Math.max(rect.width, 350), availableWidth);

    let left = isRTL ? rect.right - width : rect.left;
    left = Math.max(boundLeft, Math.min(left, boundRight - width));

    const spaceAbove = rect.top - boundTop - OFFSET;
    const spaceBelow = boundBottom - rect.bottom - OFFSET;
    const openBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove;

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

  // Temporary zoom reset to 100% while dropdown is open (for correct positioning)
  const originalZoomRef = useRef<{ rootZoom: string; bodyZoom: string } | null>(null);

  const applyZoomReset = () => {
    if (originalZoomRef.current) return;
    originalZoomRef.current = {
      rootZoom: document.documentElement.style.zoom,
      bodyZoom: document.body.style.zoom,
    };
    document.documentElement.style.zoom = "1";
    document.body.style.zoom = "1";
  };

  const restoreZoom = () => {
    const z = originalZoomRef.current;
    if (!z) return;

    if (z.rootZoom) document.documentElement.style.zoom = z.rootZoom;
    else document.documentElement.style.removeProperty("zoom");

    if (z.bodyZoom) document.body.style.zoom = z.bodyZoom;
    else document.body.style.removeProperty("zoom");

    originalZoomRef.current = null;
  };

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }

    applyZoomReset();
    requestAnimationFrame(() => {
      updatePosition();
      setOpen(true);
    });
  };

  useEffect(() => {
    if (!open) restoreZoom();
  }, [open]);

  useEffect(() => {
    return () => restoreZoom();
  }, []);


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
        className="w-full justify-between bg-white/50 hover:bg-white/70 text-right min-w-[200px]"
      >
        <span className="truncate flex-1 text-right">
          {selectedOrder
            ? `${selectedOrder.code} - ${selectedOrder.customer_name || selectedOrder.address}`
            : placeholder}
        </span>
        {selectedOrder ? (
          <X
            className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
            onClick={handleClear}
          />
        ) : (
          <Package className="h-4 w-4 shrink-0 opacity-50" />
        )}
      </Button>

      {open && position.width > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className={(portalRootRef.current
              ? 'absolute'
              : 'fixed') + ' bg-background border rounded-lg shadow-xl overflow-hidden'}
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
                  placeholder="جستجو با نام مشتری، کد، آدرس، شرح محل..."
                  compactFocus
                  className="pr-10 text-sm h-10"
                />
              </div>
            </div>
            <ScrollArea style={{ height: Math.max(140, position.maxHeight - 64) }}>
              {filteredOrders.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  سفارشی یافت نشد
                </div>
              ) : (
                <div className="p-1 bg-background">
                  {filteredOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleSelect(order.id)}
                      className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                        value === order.id ? 'bg-amber-100 dark:bg-amber-900/30' : ''
                      }`}
                    >
                      <div className="font-medium">
                        <span className="text-amber-600 font-bold">{order.code}</span>
                        {' - '}
                        {order.customer_name || 'بدون نام'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {order.subcategory_name && (
                          <span className="text-blue-600 ml-2">{order.subcategory_name}</span>
                        )}
                        {order.address}
                      </div>
                      {order.activity_description && (
                        <div className="text-xs text-green-700 dark:text-green-400 mt-1 p-1.5 bg-green-50 dark:bg-green-900/30 rounded-md line-clamp-2 border border-green-200 dark:border-green-800">
                          <span className="font-medium">شرح محل و فعالیت:</span> {order.activity_description}
                        </div>
                      )}
                      {order.customer_phone && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {order.customer_phone}
                        </div>
                      )}
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
