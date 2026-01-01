import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { Layers } from 'lucide-react';

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

  // انتخاب خودکار اولین نوع خدمات
  useEffect(() => {
    if (serviceTypes.length > 0 && !selectedServiceType) {
      setSelectedServiceType(serviceTypes[0].id);
    }
  }, [serviceTypes, selectedServiceType]);

  // ریست زیرمجموعه وقتی نوع خدمات تغییر می‌کند
  useEffect(() => {
    setSelectedSubcategory('');
  }, [selectedServiceType]);

  const selectedServiceTypeData = serviceTypes.find(st => st.id === selectedServiceType);
  const subcategories = selectedServiceTypeData?.subcategories || [];

  const handleContinue = () => {
    if (!selectedServiceType || !selectedSubcategory) return;

    const subcategoryData = subcategories.find(sub => sub.id === selectedSubcategory);
    
    onOpenChange(false);
    
    // هدایت به فرم مناسب بر اساس کد زیرمجموعه
    const subcategoryCode = subcategoryData?.code || '';
    
    // مسیریابی بر اساس کد زیرمجموعه
    if (subcategoryCode === '10') {
      // خدمات اجرای داربست به همراه اجناس
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
      // اجاره داربست
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
      // نما کاری
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
      // سایر فرم‌ها - به صفحه عمومی سرویس
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[100001]" dir="rtl">
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
              onValueChange={setSelectedServiceType}
              disabled={loading}
            >
              <SelectTrigger id="service-type" className="w-full">
                <SelectValue placeholder={loading ? 'در حال بارگذاری...' : 'انتخاب نوع خدمات'} />
              </SelectTrigger>
              <SelectContent className="z-[100002]">
                {serviceTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
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
              value={selectedSubcategory}
              onValueChange={setSelectedSubcategory}
              disabled={!selectedServiceType || subcategories.length === 0}
            >
              <SelectTrigger id="subcategory" className="w-full">
                <SelectValue placeholder="انتخاب زیرمجموعه" />
              </SelectTrigger>
              <SelectContent className="z-[100002]">
                {subcategories.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selectedServiceType || !selectedSubcategory}
          className="w-full"
        >
          ادامه و ثبت سفارش
        </Button>
      </DialogContent>
    </Dialog>
  );
}
