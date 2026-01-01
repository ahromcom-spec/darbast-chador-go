import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { Layers, Loader2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ServiceTypeSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
}

// ✅ مپ مسیرهای فرم بر اساس کد زیرشاخه
const SUBCATEGORY_FORM_ROUTES: Record<string, string> = {
  '10': '/scaffolding/form',        // خدمات اجراء داربست به همراه اجناس داربست و حمل و نقل
  '15': '/scaffolding/form',        // داربست حجمی کفراژ
  '20': '/scaffolding/facade',      // خدمات اجراء داربست بدون اجناس داربست
  '30': '/scaffolding/rental-form', // خدمات کرایه اجناس داربست فلزی
};

export function ServiceTypeSelectionDialog({
  open,
  onOpenChange,
  locationId,
}: ServiceTypeSelectionDialogProps) {
  const navigate = useNavigate();
  const { serviceTypes, loading } = useServiceTypesWithSubcategories();
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [serviceTypeDropdownOpen, setServiceTypeDropdownOpen] = useState(false);
  const [subcategoryDropdownOpen, setSubcategoryDropdownOpen] = useState(false);

  // ریست state وقتی دیالوگ باز می‌شود
  useEffect(() => {
    if (open) {
      setSelectedServiceType('');
      setSelectedSubcategory('');
      setIsNavigating(false);
      setServiceTypeDropdownOpen(false);
      setSubcategoryDropdownOpen(false);
    }
  }, [open]);

  // انتخاب خودکار اولین نوع خدمات بعد از بارگذاری
  useEffect(() => {
    if (open && serviceTypes.length > 0 && !selectedServiceType) {
      console.log('[ServiceTypeDialog] Auto-selecting first service type:', serviceTypes[0].id, serviceTypes[0].name);
      setSelectedServiceType(serviceTypes[0].id);
    }
  }, [open, serviceTypes, selectedServiceType]);

  const selectedServiceTypeData = serviceTypes.find(st => st.id === selectedServiceType);
  const subcategories = selectedServiceTypeData?.subcategories || [];
  const selectedServiceTypeName = selectedServiceTypeData?.name || '';
  const selectedSubcategoryData = subcategories.find(sub => sub.id === selectedSubcategory);
  const selectedSubcategoryName = selectedSubcategoryData?.name || '';

  // هدایت به فرم مناسب
  const navigateToForm = useCallback((subcategoryId: string) => {
    if (!selectedServiceType || isNavigating) return;

    const subcategoryData = subcategories.find(sub => sub.id === subcategoryId);
    if (!subcategoryData) return;

    setIsNavigating(true);
    
    console.log('[ServiceTypeDialog] Navigating to form:', {
      serviceType: selectedServiceType,
      subcategory: subcategoryId,
      subcategoryCode: subcategoryData.code
    });
    
    onOpenChange(false);
    
    // ✅ مسیریابی بر اساس کد زیرمجموعه با استفاده از مپ
    const subcategoryCode = subcategoryData.code || '';
    const formRoute = SUBCATEGORY_FORM_ROUTES[subcategoryCode] || '/user/select-service';
    
    navigate(formRoute, {
      state: {
        fromMap: true,
        locationId: locationId,
        serviceTypeId: selectedServiceType,
        subcategoryId: subcategoryId,
        subcategoryCode: subcategoryCode,
        returnToMap: true
      }
    });
  }, [selectedServiceType, subcategories, isNavigating, onOpenChange, navigate, locationId]);

  // انتخاب نوع خدمات
  const handleSelectServiceType = useCallback((typeId: string) => {
    console.log('[ServiceTypeDialog] Service type selected:', typeId);
    setSelectedServiceType(typeId);
    setSelectedSubcategory('');
    setServiceTypeDropdownOpen(false);
  }, []);

  // انتخاب زیرشاخه و رفتن به فرم
  const handleSelectSubcategory = useCallback((subId: string) => {
    console.log('[ServiceTypeDialog] Subcategory selected:', subId);
    setSelectedSubcategory(subId);
    setSubcategoryDropdownOpen(false);
    // با کمی تاخیر به فرم برو تا UI آپدیت شود
    setTimeout(() => {
      navigateToForm(subId);
    }, 150);
  }, [navigateToForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md max-h-[90vh] overflow-visible" 
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
          {/* ✅ نوع خدمات - Custom Dropdown */}
          <div className="space-y-2">
            <Label className="text-right block">نوع خدمات *</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setServiceTypeDropdownOpen(!serviceTypeDropdownOpen);
                  setSubcategoryDropdownOpen(false);
                }}
                disabled={loading}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "shadow-sm transition-colors hover:border-primary/50"
                )}
              >
                <span className={cn(!selectedServiceTypeName && "text-muted-foreground")}>
                  {loading ? 'در حال بارگذاری...' : (selectedServiceTypeName || 'انتخاب نوع خدمات')}
                </span>
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", serviceTypeDropdownOpen && "rotate-180")} />
              </button>
              
              {serviceTypeDropdownOpen && (
                <div 
                  className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden"
                  style={{ zIndex: 300001 }}
                >
                  <ScrollArea className="max-h-60">
                    <div className="p-1">
                      {serviceTypes.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => handleSelectServiceType(type.id)}
                          className={cn(
                            "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none",
                            "hover:bg-accent hover:text-accent-foreground",
                            selectedServiceType === type.id && "bg-accent text-accent-foreground"
                          )}
                        >
                          {selectedServiceType === type.id && (
                            <Check className="h-4 w-4 ml-2 text-primary" />
                          )}
                          <span className="text-right flex-1">{type.name}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* ✅ زیرمجموعه خدمات - Custom Dropdown */}
          <div className="space-y-2">
            <Label className="text-right block">زیرمجموعه خدمات *</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (selectedServiceType && subcategories.length > 0) {
                    setSubcategoryDropdownOpen(!subcategoryDropdownOpen);
                    setServiceTypeDropdownOpen(false);
                  }
                }}
                disabled={!selectedServiceType || subcategories.length === 0}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "shadow-sm transition-colors hover:border-primary/50"
                )}
              >
                <span className={cn(!selectedSubcategoryName && "text-muted-foreground")}>
                  {!selectedServiceType 
                    ? 'ابتدا نوع خدمات را انتخاب کنید' 
                    : subcategories.length === 0 
                      ? 'زیرمجموعه‌ای موجود نیست' 
                      : (selectedSubcategoryName || 'انتخاب زیرمجموعه')}
                </span>
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", subcategoryDropdownOpen && "rotate-180")} />
              </button>
              
              {subcategoryDropdownOpen && subcategories.length > 0 && (
                <div 
                  className="absolute top-full right-0 left-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden"
                  style={{ zIndex: 300001 }}
                >
                  <ScrollArea className="max-h-60">
                    <div className="p-1">
                      {subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelectSubcategory(sub.id)}
                          className={cn(
                            "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none",
                            "hover:bg-accent hover:text-accent-foreground",
                            selectedSubcategory === sub.id && "bg-accent text-accent-foreground"
                          )}
                        >
                          {selectedSubcategory === sub.id && (
                            <Check className="h-4 w-4 ml-2 text-primary" />
                          )}
                          <span className="text-right flex-1">{sub.name}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
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
