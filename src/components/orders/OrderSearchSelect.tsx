import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Package, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createPortal } from 'react-dom';

interface Order {
  id: string;
  code: string;
  customer_name: string | null;
  customer_phone?: string | null;
  address: string;
  subcategory_name?: string;
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

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
      
      return (
        code.includes(searchLower) ||
        customerName.includes(searchLower) ||
        customerPhone.includes(searchLower) ||
        address.includes(searchLower) ||
        subcategory.includes(searchLower)
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

  // Update position when opening
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 350; // Approximate height
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // Prefer showing above if there's more space or not enough space below
      const showAbove = spaceAbove > spaceBelow || spaceBelow < dropdownHeight;
      
      setPosition({
        top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 350)
      });
      
      // Focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }
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
        onClick={() => setOpen(!open)}
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
      
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-background border rounded-lg shadow-xl overflow-hidden"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 99999,
            maxHeight: '350px'
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
                placeholder="جستجو با نام مشتری، کد، آدرس..."
                className="pr-10 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="max-h-[280px]">
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
                    {order.customer_phone && (
                      <div className="text-xs text-muted-foreground">
                        {order.customer_phone}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>,
        document.body
      )}
    </div>
  );
}
