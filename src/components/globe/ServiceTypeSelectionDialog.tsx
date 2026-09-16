import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useServiceTypesWithSubcategories, Subcategory } from '@/hooks/useServiceTypesWithSubcategories';
import { Layers, Loader2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface ServiceTypeSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
}

// Fallback mapping by subcategory code for legacy items without form_path
const SUBCATEGORY_FORM_ROUTES: Record<string, string> = {
  '10': '/scaffolding/form',
  '15': '/scaffolding/form',
  '20': '/scaffolding/form',
  '30': '/scaffolding/rental-form',
};

export function ServiceTypeSelectionDialog({
  open,
  onOpenChange,
  locationId,
}: ServiceTypeSelectionDialogProps) {
  const navigate = useNavigate();
  const { serviceTypes, loading } = useServiceTypesWithSubcategories();
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  // path of selected subcategory ids from top-level down
  const [subPath, setSubPath] = useState<string[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [locationInfo, setLocationInfo] = useState<any>(null);

  // بارگذاری اطلاعات آدرس لوکیشن برای پیش‌پر کردن فرم
  useEffect(() => {
    if (!open || !locationId) {
      setLocationInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('locations')
        .select('id, address_line, lat, lng, province_id, district_id, provinces(name), districts(name)')
        .eq('id', locationId)
        .maybeSingle();
      if (!cancelled) setLocationInfo(data || null);
    })();
    return () => { cancelled = true; };
  }, [open, locationId]);


  useEffect(() => {
    if (open) {
      setSelectedServiceType('');
      setSubPath([]);
      setIsNavigating(false);
      setTypeOpen(false);
      setOpenLevel(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && serviceTypes.length > 0 && !selectedServiceType) {
      setSelectedServiceType(serviceTypes[0].id);
    }
  }, [open, serviceTypes, selectedServiceType]);

  const selectedServiceTypeData = serviceTypes.find(st => st.id === selectedServiceType);
  const rootSubcategories: Subcategory[] = selectedServiceTypeData?.subcategories || [];

  // Compute the list at each drill-down level based on current subPath
  const levels = useMemo(() => {
    const arr: Subcategory[][] = [rootSubcategories];
    for (const id of subPath) {
      const last = arr[arr.length - 1];
      const node = last.find(n => n.id === id);
      if (node && node.children && node.children.length > 0) {
        arr.push(node.children);
      } else {
        break;
      }
    }
    return arr;
  }, [rootSubcategories, subPath]);

  const findNode = (items: Subcategory[], id: string): Subcategory | undefined => {
    for (const it of items) {
      if (it.id === id) return it;
      if (it.children) {
        const f = findNode(it.children, id);
        if (f) return f;
      }
    }
    return undefined;
  };

  const navigateToForm = useCallback((leaf: Subcategory) => {
    if (isNavigating) return;
    setIsNavigating(true);
    const serviceType = serviceTypes.find(st => st.id === selectedServiceType);
    // فقط برای «داربست فلزی» (کد ۱۰) از نقشه فرم‌های قدیمی استفاده می‌شود
    const legacyRoute = serviceType?.code === '10'
      ? SUBCATEGORY_FORM_ROUTES[leaf.code || '']
      : undefined;
    const formRoute = leaf.form_path || legacyRoute || '/form-not-available';
    onOpenChange(false);
    navigate(formRoute, {
      state: {
        fromMap: true,
        locationId,
        serviceTypeId: selectedServiceType,
        serviceName: serviceType?.name || '',
        subcategoryId: leaf.id,
        subcategoryName: leaf.name,
        subcategoryCode: leaf.code || '',
        returnToMap: true,
        locationAddress: locationInfo?.address_line || '',
        lat: locationInfo?.lat ?? null,
        lng: locationInfo?.lng ?? null,
        provinceId: locationInfo?.province_id ?? null,
        districtId: locationInfo?.district_id ?? null,
        provinceName: locationInfo?.provinces?.name || '',
        districtName: locationInfo?.districts?.name || '',
      },
    });
  }, [isNavigating, navigate, onOpenChange, locationId, selectedServiceType, serviceTypes, locationInfo]);


  const handleSelectServiceType = useCallback((typeId: string) => {
    setSelectedServiceType(typeId);
    setSubPath([]);
    setTypeOpen(false);
    setOpenLevel(null);
  }, []);

  const handleSelectAtLevel = useCallback((level: number, id: string) => {
    const list = levels[level];
    const node = list?.find(n => n.id === id);
    setOpenLevel(null);
    if (!node) return;
    const newPath = [...subPath.slice(0, level), id];
    setSubPath(newPath);
    if (!node.children || node.children.length === 0) {
      setTimeout(() => navigateToForm(node), 120);
    }
  }, [levels, subPath, navigateToForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden"
        dir="rtl"
        style={{ zIndex: 200001 }}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-right">
            <Layers className="h-5 w-5 text-primary" />
            انتخاب نوع خدمات
          </DialogTitle>
          <DialogDescription className="text-right">
            لطفاً نوع خدمات و زیرمجموعه مورد نظر خود را انتخاب کنید
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Service type dropdown */}
          <div className="space-y-2">
            <Label className="text-right block">نوع خدمات *</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setTypeOpen(!typeOpen); setOpenLevel(null); }}
                disabled={loading}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50 shadow-sm hover:border-primary/50"
                )}
              >
                <span className={cn(!selectedServiceTypeData && "text-muted-foreground")}>
                  {loading ? 'در حال بارگذاری...' : (selectedServiceTypeData?.name || 'انتخاب نوع خدمات')}
                </span>
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", typeOpen && "rotate-180")} />
              </button>
              {typeOpen && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden" style={{ zIndex: 300001 }}>
                  <ScrollArea className="max-h-80">
                    <div className="p-1">
                      {serviceTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => handleSelectServiceType(type.id)}
                          className={cn(
                            "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1 px-2 text-xs outline-none",
                            "hover:bg-accent hover:text-accent-foreground",
                            selectedServiceType === type.id && "bg-accent text-accent-foreground"
                          )}
                        >
                          {selectedServiceType === type.id && (<Check className="h-3 w-3 ml-1.5 text-primary" />)}
                          <span className="text-right flex-1 leading-tight">{type.name}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Nested subcategory drill-down levels */}
          {levels.map((list, idx) => {
            const currentId = subPath[idx] || '';
            const currentNode = list.find(n => n.id === currentId);
            const label = idx === 0 ? 'زیرمجموعه خدمات *' : `زیرمجموعه سطح ${idx + 1}`;
            return (
              <div key={idx} className="space-y-2">
                <Label className="text-right block">{label}</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (list.length > 0) {
                        setOpenLevel(openLevel === idx ? null : idx);
                        setTypeOpen(false);
                      }
                    }}
                    disabled={list.length === 0}
                    className={cn(
                      "flex h-10 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-50 shadow-sm hover:border-primary/50"
                    )}
                  >
                    <span className={cn(!currentNode && "text-muted-foreground")}>
                      {list.length === 0 ? 'موجود نیست' : (currentNode?.name || 'انتخاب کنید')}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", openLevel === idx && "rotate-180")} />
                  </button>
                  {openLevel === idx && list.length > 0 && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden" style={{ zIndex: 300001 }}>
                      <ScrollArea className="max-h-80">
                        <div className="p-1">
                          {list.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleSelectAtLevel(idx, sub.id)}
                              className={cn(
                                "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1 px-2 text-xs outline-none",
                                "hover:bg-accent hover:text-accent-foreground",
                                currentId === sub.id && "bg-accent text-accent-foreground"
                              )}
                            >
                              {currentId === sub.id && (<Check className="h-3 w-3 ml-1.5 text-primary" />)}
                              <span className="text-right flex-1 leading-tight">{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isNavigating && (
          <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>در حال انتقال به فرم ثبت سفارش...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
