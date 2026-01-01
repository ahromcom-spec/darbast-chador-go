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

  // تغییر زیرمجموعه
  const handleSubcategoryChange = useCallback((value: string) => {
    console.log('[ServiceTypeDialog] Subcategory changed to:', value);
    setSelectedSubcategory(value);
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

  const handleContinue = useCallback(() => {
    if (!selectedServiceType || !selectedSubcategory || isNavigating) return;

    setIsNavigating(true);
    const subcategoryData = subcategories.find(sub => sub.id === selectedSubcategory);
    
    console.log('[ServiceTypeDialog] Continue clicked:', {
      serviceType: selectedServiceType,
      subcategory: selectedSubcategory,
      subcategoryCode: subcategoryData?.code
    });
    
    onOpenChange(false);
    
    // هدایت به فرم مناسب بر اساس کد زیرمجموعه
    const subcategoryCode = subcategoryData?.code || '';
    
    // مسیریابی بر اساس کد زیرمجموعه
    if (subcategoryCode === '10') {
      navigate('/scaffolding/form', {
        state: {
          fromMap: true,
          locationId: locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: selectedSubcategory,
          subcategoryCode: subcategoryCode,
          returnToMap: true
        }
      });
    } else if (subcategoryCode === '20') {
      navigate('/scaffolding/rental', {
        state: {
          fromMap: true,
          locationId: locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: selectedSubcategory,
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
          subcategoryId: selectedSubcategory,
          subcategoryCode: subcategoryCode,
          returnToMap: true
        }
      });
    } else {
      navigate('/user/service-selection', {
        state: {
          fromMap: true,
          locationId: locationId,
          serviceTypeId: selectedServiceType,
          subcategoryId: selectedSubcategory,
          subcategoryCode: subcategoryCode,
          returnToMap: true
        }
      });
    }
  }, [selectedServiceType, selectedSubcategory, subcategories, isNavigating, onOpenChange, navigate, locationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md z-[100001]" 
        dir="rtl"
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
                className="z-[100002] bg-popover"
                position="popper"
                side="bottom"
                sideOffset={4}
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
                className="z-[100002] bg-popover"
                position="popper"
                side="bottom"
                sideOffset={4}
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

        <Button
          onClick={handleContinue}
          disabled={!selectedServiceType || !selectedSubcategory || isNavigating}
          className="w-full"
        >
          {isNavigating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
              در حال انتقال...
            </>
          ) : (
            'ادامه و ثبت سفارش'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
