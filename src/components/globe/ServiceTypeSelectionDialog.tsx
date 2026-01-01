import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { Layers, Loader2 } from 'lucide-react';

interface ServiceTypeSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
}

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

  // ریست state وقتی دیالوگ باز می‌شود
  useEffect(() => {
    if (open) {
      setSelectedServiceType('');
      setSelectedSubcategory('');
      setIsNavigating(false);
    }
  }, [open]);

  // انتخاب خودکار اولین نوع خدمات بعد از بارگذاری
  useEffect(() => {
    if (open && serviceTypes.length > 0 && !selectedServiceType) {
      console.log('[ServiceTypeDialog] Auto-selecting first service type:', serviceTypes[0].id, serviceTypes[0].name);
      setSelectedServiceType(serviceTypes[0].id);
    }
  }, [open, serviceTypes, selectedServiceType]);

  // ریست زیرمجموعه وقتی نوع خدمات تغییر می‌کند
  const handleServiceTypeChange = useCallback((value: string) => {
    console.log('[ServiceTypeDialog] Service type changed to:', value);
    setSelectedServiceType(value);
    setSelectedSubcategory(''); // ریست زیرمجموعه
  }, []);

  const selectedServiceTypeData = serviceTypes.find(st => st.id === selectedServiceType);
  const subcategories = selectedServiceTypeData?.subcategories || [];

  console.log('[ServiceTypeDialog] Current state:', {
    open,
    loading,
    serviceTypesCount: serviceTypes.length,
    selectedServiceType,
    selectedSubcategory,
    subcategoriesCount: subcategories.length
  });

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
    
    // مسیریابی بر اساس کد زیرمجموعه
    const subcategoryCode = subcategoryData.code || '';
    
    if (subcategoryCode === '10') {
      navigate('/scaffolding/form', {
        state: {
          fromMap: true,
          locationId: locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: subcategoryId,
          subcategoryCode: subcategoryCode,
          returnToMap: true
        }
      });
    } else if (subcategoryCode === '20') {
      navigate('/scaffolding/rental-form', {
        state: {
          fromMap: true,
          locationId: locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: subcategoryId,
          subcategoryCode: subcategoryCode,
          returnToMap: true
        }
      });
    } else if (subcategoryCode === '30') {
      navigate('/scaffolding/facade', {
        state: {
          fromMap: true,
          locationId: locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: subcategoryId,
          subcategoryCode: subcategoryCode,
          returnToMap: true
        }
      });
    } else {
      navigate('/user/select-service', {
        state: {
          fromMap: true,
          locationId: locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: subcategoryId,
          subcategoryCode: subcategoryCode,
          returnToMap: true
        }
      });
    }
  }, [selectedServiceType, subcategories, isNavigating, onOpenChange, navigate, locationId]);

  // وقتی زیرشاخه انتخاب شد، مستقیماً به فرم برو
  const handleSubcategoryChange = useCallback((value: string) => {
    console.log('[ServiceTypeDialog] Subcategory selected:', value);
    setSelectedSubcategory(value);
    // با کمی تاخیر به فرم برو تا UI آپدیت شود
    setTimeout(() => {
      navigateToForm(value);
    }, 150);
  }, [navigateToForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md" 
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
          {/* نوع خدمات */}
          <div className="space-y-2">
            <Label htmlFor="service-type" className="text-right block">
              نوع خدمات *
            </Label>
            <Select
              value={selectedServiceType}
              onValueChange={handleServiceTypeChange}
              disabled={loading}
            >
              <SelectTrigger id="service-type" className="w-full text-right">
                <SelectValue placeholder={loading ? 'در حال بارگذاری...' : 'انتخاب نوع خدمات'} />
              </SelectTrigger>
              <SelectContent 
                className="bg-popover border shadow-lg max-h-60 overflow-y-auto"
                position="popper"
                side="bottom"
                align="end"
                sideOffset={4}
                style={{ zIndex: 200002 }}
              >
                {serviceTypes.map((type) => (
                  <SelectItem 
                    key={type.id} 
                    value={type.id}
                    className="text-right cursor-pointer"
                  >
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* زیرمجموعه خدمات */}
          <div className="space-y-2">
            <Label htmlFor="subcategory" className="text-right block">
              زیرمجموعه خدمات *
            </Label>
            <Select
              key={selectedServiceType} // Force re-render when service type changes
              value={selectedSubcategory}
              onValueChange={handleSubcategoryChange}
              disabled={!selectedServiceType || subcategories.length === 0}
            >
              <SelectTrigger id="subcategory" className="w-full text-right">
                <SelectValue placeholder={
                  !selectedServiceType 
                    ? 'ابتدا نوع خدمات را انتخاب کنید' 
                    : subcategories.length === 0 
                      ? 'زیرمجموعه‌ای موجود نیست' 
                      : 'انتخاب زیرمجموعه'
                } />
              </SelectTrigger>
              <SelectContent 
                className="bg-popover border shadow-lg max-h-60 overflow-y-auto"
                position="popper"
                side="bottom"
                align="end"
                sideOffset={4}
                style={{ zIndex: 200002 }}
              >
                {subcategories.map((sub) => (
                  <SelectItem 
                    key={sub.id} 
                    value={sub.id}
                    className="text-right cursor-pointer"
                  >
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
