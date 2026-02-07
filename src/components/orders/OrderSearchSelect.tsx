import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Package, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { requestZoom100 } from '@/lib/zoom';

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
  /**
   * حالت فشرده برای لیست‌های پرتعداد (مثل گزارش روزانه)
   * تا تعداد بیشتری سفارش همزمان قابل مشاهده باشد.
   */
  dense?: boolean;
}

export function OrderSearchSelect({
  orders,
  value,
  onValueChange,
  placeholder = 'انتخاب سفارش',
  dense = false,
}: OrderSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ left: number; width: number; maxHeight: number; top?: number; bottom?: number }>({
    top: 0,
    bottom: undefined,
    left: 0,
    width: 0,
    maxHeight: dense ? 900 : 800,
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

    const isRTL =
      document.documentElement.dir === 'rtl' || !!triggerEl.closest('[dir="rtl"]');

    // Fixed to viewport: avoids clipping by containers and allows taller dropdowns.
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

    const MIN_PANEL_HEIGHT = dense ? 520 : 240;
    const MAX_PANEL_HEIGHT = dense ? 900 : 800;

    // Prefer the side that can show more items (especially in dense mode)
    const openBelow = spaceBelow >= MIN_PANEL_HEIGHT || spaceBelow >= spaceAbove;

    if (openBelow) {
      const maxHeight = Math.min(MAX_PANEL_HEIGHT, Math.max(180, spaceBelow));
      setPosition({
        top: rect.bottom + OFFSET,
        bottom: undefined,
        left,
        width,
        maxHeight,
      });
    } else {
      const maxHeight = Math.min(MAX_PANEL_HEIGHT, Math.max(180, spaceAbove));
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
        className="w-full justify-between bg-background hover:bg-accent/40 text-right min-w-[200px]"
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
            className="fixed bg-popover text-popover-foreground border rounded-lg shadow-xl overflow-hidden"
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              zIndex: 300000,
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
                  {filteredOrders.map((order) => {
                    const isSelected = value === order.id;

                    return (
                      <button
                        key={order.id}
                        onClick={() => handleSelect(order.id)}
                        className={
                          `w-full text-right rounded-md transition-colors hover:bg-accent ` +
                          (dense ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm') +
                          (isSelected ? ' bg-accent' : '')
                        }
                      >
                        <div className={dense ? 'flex items-center gap-2' : 'font-medium'}>
                          <span className="font-bold text-primary tabular-nums">{order.code}</span>
                          <span className={dense ? 'truncate font-medium' : ''}>
                            {dense ? (order.customer_name || 'بدون نام') : (
                              <>
                                {' - '}
                                {order.customer_name || 'بدون نام'}
                              </>
                            )}
                          </span>
                        </div>

                        <div className={dense ? 'text-[11px] text-muted-foreground mt-0.5 line-clamp-1' : 'text-xs text-muted-foreground mt-0.5 line-clamp-1'}>
                          {order.subcategory_name && (
                            <span className={dense ? 'text-foreground/80 ml-1' : 'text-foreground/80 ml-2'}>
                              {order.subcategory_name}
                              {dense ? ' • ' : ''}
                            </span>
                          )}
                          {order.address}
                        </div>

                        {dense ? (
                          <>
                            {order.activity_description && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {order.activity_description}
                              </div>
                            )}
                            {order.customer_phone && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {order.customer_phone}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {order.activity_description && (
                              <div className="text-xs text-muted-foreground mt-1 p-1.5 bg-muted rounded-md line-clamp-2 border">
                                <span className="font-medium">شرح محل و فعالیت:</span> {order.activity_description}
                              </div>
                            )}
                            {order.customer_phone && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {order.customer_phone}
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>,
          document.body,
        )}
    </div>
  );
}
