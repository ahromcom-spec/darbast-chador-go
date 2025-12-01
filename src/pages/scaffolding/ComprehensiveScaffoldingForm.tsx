import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, AlertCircle, ChevronDown, ClipboardList, HelpCircle, FileText, Box } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCustomer } from '@/hooks/useCustomer';
import { useProvinces } from '@/hooks/useProvinces';
import { useDistricts } from '@/hooks/useDistricts';
import { sanitizeHtml } from '@/lib/security';
import { scaffoldingFormSchema } from '@/lib/validations';
import { MediaUploader } from '@/components/orders/MediaUploader';
import { Textarea } from '@/components/ui/textarea';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { getOrCreateProjectSchema, createProjectV3Schema } from '@/lib/rpcValidation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface Dimension {
  id: string;
  length: string;
  width: string;
  height: string;
  useTwoMeterTemplate?: boolean; // For facade scaffolding 2m template
}

interface ServiceConditions {
  totalMonths: number;
  currentMonth: number;
  distanceRange: '0-15' | '15-25' | '25-50' | '50-85';
  platformHeight: number | null;
  scaffoldHeightFromPlatform: number | null;
  vehicleDistance: number | null;
  rentalMonthsPlan?: '1' | '2' | '3+'; // برای اجاره چند ماهه
}

interface ComprehensiveScaffoldingFormProps {
  editOrderId?: string;
  existingOrderData?: any;
  hierarchyProjectId?: string;
  projectId?: string;
  locationId?: string;
  provinceId?: string;
  districtId?: string;
  serviceTypeId?: string;
  subcategoryId?: string;
  subcategoryCode?: string;
  hideAddressField?: boolean;
  prefilledAddress?: string;
  prefilledProvince?: string;
  prefilledDistrict?: string;
}

export default function ComprehensiveScaffoldingForm({
  editOrderId: propEditOrderId,
  existingOrderData,
  hierarchyProjectId: propHierarchyProjectId,
  projectId: propProjectId,
  locationId: propLocationId,
  provinceId: propProvinceId,
  districtId: propDistrictId,
  serviceTypeId: propServiceTypeId,
  subcategoryId: propSubcategoryId,
  subcategoryCode: propSubcategoryCode,
  prefilledAddress = '',
  prefilledProvince = '',
  prefilledDistrict = '',
}: ComprehensiveScaffoldingFormProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navState = (location?.state || {}) as any;
  const { toast } = useToast();
  const { user } = useAuth();
  const { customerId } = useCustomer();
  const { provinces } = useProvinces();
  
  // دریافت editOrderId از query parameter یا prop
  const editOrderId = searchParams.get('edit') || propEditOrderId;
  
  // دریافت hierarchyProjectId از props یا state برای لینک کردن سفارش
  const hierarchyProjectId = propHierarchyProjectId || navState?.hierarchyProjectId || null;
  const locationId = propLocationId || navState?.locationId;
  const provinceId = propProvinceId || navState?.provinceId || null;
  const districtId = propDistrictId || navState?.districtId || null;
  const serviceTypeId = propServiceTypeId || navState?.serviceTypeId;
  const subcategoryId = propSubcategoryId || navState?.subcategoryId;

  const [scaffoldType, setScaffoldType] = useState<'formwork' | 'ceiling' | 'facade' | 'column' | 'pipe-length' | ''>('');
  const [activeService, setActiveService] = useState<'facade' | 'formwork' | 'ceiling-beam-yonolit' | 'ceiling-beam-ceramic' | 'ceiling-slab' | 'column' | 'pipe-length' | ''>('');
  const [ceilingSubType, setCeilingSubType] = useState<'ceiling-beam-yonolit' | 'ceiling-beam-ceramic' | 'ceiling-slab' | ''>('');
  const address = prefilledAddress || navState?.locationAddress || '';
  const [dimensions, setDimensions] = useState<Dimension[]>([{ id: '1', length: '', width: '', height: '', useTwoMeterTemplate: false }]);
  const [isFacadeWidth2m, setIsFacadeWidth2m] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [columnHeight, setColumnHeight] = useState<string>(''); // ارتفاع به متر برای داربست ستونی
  
  // Check if this is facade scaffolding type (داربست سطحی نما)
  const isFacadeScaffolding = activeService === 'facade' || scaffoldType === 'facade';
  
  // Check if this is column scaffolding type (داربست ستونی)
  const isColumnScaffolding = scaffoldType === 'column' || activeService === 'column';
  
  // Check if this is pipe-length scaffolding type (داربست به طول لوله مصرفی)
  const isPipeLengthScaffolding = scaffoldType === 'pipe-length' || activeService === 'pipe-length';

  // Check if this is formwork scaffolding type (داربست حجمی کفراژ)
  const isFormworkScaffolding = scaffoldType === 'formwork' || activeService === 'formwork';

  // هشدار برای داربست حجمی کفراژ: ارتفاع بیشتر از 12 متر و بیشتر از مساحت زیرین
  const getFormworkWarning = () => {
    if (!isFormworkScaffolding) return null;
    const length = parseFloat(dimensions[0]?.length || '0');
    const width = parseFloat(dimensions[0]?.width || '0');
    const height = parseFloat(dimensions[0]?.height || '0');
    const floorArea = length * width;
    
    if (height > 12 && height > floorArea) {
      return 'ارتفاع داربست از مساحت زیرین بیشتر است. پیشنهاد می‌شود سفارش خود را در نوع داربست ستونی انجام دهید.';
    }
    return null;
  };

  // هشدار برای داربست سطحی نما: ارتفاع بیشتر از 12 متر و بیشتر از دو برابر مجموع طول‌ها
  const getFacadeWarning = () => {
    if (!isFacadeScaffolding) return null;
    
    // محاسبه مجموع طول‌های همه ابعاد
    const totalLength = dimensions.reduce((sum, dim) => sum + parseFloat(dim.length || '0'), 0);
    const height = parseFloat(dimensions[0]?.height || '0');
    
    if (height > 12 && height > (2 * totalLength)) {
      return 'ارتفاع داربست از دو برابر مجموع طول‌ها بیشتر است. پیشنهاد می‌شود نوع داربست خود را داربست ستونی انتخاب کنید.';
    }
    return null;
  };
  
  // Location fields - دریافت از state (در صورت عدم وجود در props)
  const [detailedAddress, setDetailedAddress] = useState(navState?.detailedAddress || address);
  const { districts } = useDistricts(provinceId || '');

  const [conditions, setConditions] = useState<ServiceConditions>({
    totalMonths: 1,
    currentMonth: 1,
    distanceRange: '0-15',
    platformHeight: null,
    scaffoldHeightFromPlatform: null,
    vehicleDistance: null,
    rentalMonthsPlan: '1',
  });

  const [onGround, setOnGround] = useState(true);
  const [vehicleReachesSite, setVehicleReachesSite] = useState(true);
  const [ceilingTieredOpen, setCeilingTieredOpen] = useState(false);
  const [ceilingSlabOpen, setCeilingSlabOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [locationPurpose, setLocationPurpose] = useState('');
  const [installationDateTime, setInstallationDateTime] = useState<string>('');

  // Fetch order data if editing from query parameter
  useEffect(() => {
    if (editOrderId && !existingOrderData) {
      fetchOrderData();
    }
  }, [editOrderId]);

  const fetchOrderData = async () => {
    if (!editOrderId) return;
    
    setLoadingOrder(true);
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          *,
          subcategory:subcategories!projects_v3_subcategory_id_fkey (
            id,
            name,
            code
          ),
          province:provinces!projects_v3_province_id_fkey (
            id,
            name
          ),
          district:districts!projects_v3_district_id_fkey (
            id,
            name
          )
        `)
        .eq('id', editOrderId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setOrderData(data);
        
        // Parse notes to populate form
        if (data.notes) {
          try {
            const notes = typeof data.notes === 'string' ? JSON.parse(data.notes) : data.notes;
            
            // Set service type
            if (notes.service_type) {
              setActiveService(notes.service_type);
              if (notes.service_type === 'formwork') {
                setScaffoldType('formwork');
              } else if (notes.service_type === 'ceiling-beam-yonolit' || notes.service_type === 'ceiling-beam-ceramic' || notes.service_type === 'ceiling-slab') {
                setScaffoldType('ceiling');
                setCeilingSubType(notes.service_type);
              } else {
                setScaffoldType('facade');
              }
            }

            // Set dimensions
            if (notes.dimensions && Array.isArray(notes.dimensions)) {
              setDimensions(notes.dimensions.map((dim: any, index: number) => ({
                id: (index + 1).toString(),
                length: dim.length?.toString() || '',
                width: dim.width?.toString() || '',
                height: dim.height?.toString() || '',
                useTwoMeterTemplate: dim.useTwoMeterTemplate || false
              })));
            }
            
            // Set column height for column scaffolding
            if (notes.columnHeight !== undefined) {
              setColumnHeight(notes.columnHeight?.toString() || '');
            }

            // Set conditions
            if (notes.conditions) {
              setConditions(notes.conditions);
            }

            // Set other fields
            if (notes.isFacadeWidth2m !== undefined) {
              setIsFacadeWidth2m(notes.isFacadeWidth2m);
            }
            if (notes.onGround !== undefined) {
              setOnGround(notes.onGround);
            }
            if (notes.vehicleReachesSite !== undefined) {
              setVehicleReachesSite(notes.vehicleReachesSite);
            }
            if (notes.locationPurpose) {
              setLocationPurpose(notes.locationPurpose);
            }
            if (notes.installationDateTime) {
              setInstallationDateTime(notes.installationDateTime);
            }
          } catch (parseError) {
            console.error('Error parsing order notes:', parseError);
            toast({
              title: 'خطا در بارگذاری اطلاعات',
              description: 'جزئیات فنی این سفارش در دسترس نیست',
              variant: 'destructive'
            });
          }
        }
        
        // Set address fields
        if (data.address) {
          setDetailedAddress(data.address);
        }
        if (data.detailed_address) {
          setDetailedAddress(data.detailed_address);
        }
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
      toast({
        title: 'خطا',
        description: 'امکان بارگذاری اطلاعات سفارش وجود ندارد',
        variant: 'destructive'
      });
    } finally {
      setLoadingOrder(false);
    }
  };

  // Load existing order data when editing
  useEffect(() => {
    if (editOrderId && existingOrderData) {
      try {
        // Parse notes to get form data
        const notes = typeof existingOrderData.notes === 'string' 
          ? JSON.parse(existingOrderData.notes) 
          : existingOrderData.notes;

        if (notes) {
          // Set service type
          if (notes.service_type) {
            setActiveService(notes.service_type);
            if (notes.service_type === 'formwork') {
              setScaffoldType('formwork');
            } else if (notes.service_type === 'ceiling-beam-yonolit' || notes.service_type === 'ceiling-beam-ceramic' || notes.service_type === 'ceiling-slab') {
              setScaffoldType('ceiling');
              setCeilingSubType(notes.service_type);
            } else {
              setScaffoldType('facade');
            }
          }

          // Set dimensions
          if (notes.dimensions && Array.isArray(notes.dimensions)) {
            setDimensions(notes.dimensions.map((dim: any, index: number) => ({
              id: (index + 1).toString(),
              length: dim.length?.toString() || '',
              width: dim.width?.toString() || '',
              height: dim.height?.toString() || ''
            })));
          }
          
          // Set column height for column scaffolding
          if (notes.columnHeight !== undefined) {
            setColumnHeight(notes.columnHeight?.toString() || '');
          }

          // Set conditions
          if (notes.conditions) {
            setConditions(notes.conditions);
          }

          // Set other fields
          if (notes.isFacadeWidth2m !== undefined) {
            setIsFacadeWidth2m(notes.isFacadeWidth2m);
          }
          if (notes.onGround !== undefined) {
            setOnGround(notes.onGround);
          }
          if (notes.vehicleReachesSite !== undefined) {
            setVehicleReachesSite(notes.vehicleReachesSite);
          }
          if (notes.locationPurpose) {
            setLocationPurpose(notes.locationPurpose);
          }
          if (notes.installationDateTime) {
            setInstallationDateTime(notes.installationDateTime);
          }
        }
      } catch (error) {
        console.error('Error loading order data:', error);
      }
    }
  }, [editOrderId, existingOrderData]);

  const addDimension = () => {
    const newId = (dimensions.length + 1).toString();
    // فقط داربست سطحی نما عرض پیش‌فرض دارد، بقیه خالی
    const defaultWidth = activeService === 'facade' ? (isFacadeWidth2m ? '1.5' : '1') : '';
    setDimensions([...dimensions, { id: newId, length: '', width: defaultWidth, height: '' }]);
  };

  const removeDimension = (id: string) => {
    if (dimensions.length > 1) {
      setDimensions(dimensions.filter(d => d.id !== id));
    }
  };

  const updateDimension = (id: string, field: 'length' | 'width' | 'height', value: string) => {
    setDimensions(dimensions.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const calculateTotalArea = (): number => {
    return dimensions.reduce((total, dim) => {
      const length = parseFloat(dim.length) || 0;
      const width = parseFloat(dim.width) || 0;
      const height = parseFloat(dim.height) || 0;
      return total + (length * width * height);
    }, 0);
  };

  const calculatePrice = (): { total: number; pricePerMeter: number | null; breakdown: string[] } => {
    const area = calculateTotalArea();
    let basePrice = 0;
    let pricePerMeter: number | null = null;
    const breakdown: string[] = [];

    // محاسبه قیمت برای داربست به طول لوله مصرفی
    if (isPipeLengthScaffolding) {
      const pipeLength = parseFloat(dimensions[0]?.length || '0');
      
      if (pipeLength <= 100) {
        basePrice = 3200000;
        breakdown.push(`طول لوله: ${pipeLength} متر (زیر 100 متر)`);
        breakdown.push(`قیمت ثابت: ${basePrice.toLocaleString('fa-IR')} تومان`);
      } else if (pipeLength <= 200) {
        basePrice = 4200000;
        breakdown.push(`طول لوله: ${pipeLength} متر (100-200 متر)`);
        breakdown.push(`قیمت ثابت: ${basePrice.toLocaleString('fa-IR')} تومان`);
      } else {
        pricePerMeter = 30000;
        basePrice = pipeLength * pricePerMeter;
        breakdown.push(`طول لوله: ${pipeLength} متر (بیش از 200 متر)`);
        breakdown.push(`فی هر متر لوله: ${pricePerMeter.toLocaleString('fa-IR')} تومان`);
        breakdown.push(`قیمت کل: ${pipeLength} × ${pricePerMeter.toLocaleString('fa-IR')} = ${basePrice.toLocaleString('fa-IR')} تومان`);
      }
      
      return { total: Math.round(basePrice), pricePerMeter, breakdown };
    }

    // محاسبه قیمت برای داربست ستونی
    if (isColumnScaffolding) {
      const getUnits = (dimension: number): number => {
        if (dimension >= 0.20 && dimension <= 3.5) return 1;
        if (dimension > 3.5 && dimension <= 7) return 2;
        if (dimension > 7 && dimension <= 10.5) return 3;
        return 0;
      };

      const length = parseFloat(dimensions[0]?.length || '0');
      const width = parseFloat(dimensions[0]?.width || '0');
      const height = parseFloat(columnHeight || '0');
      
      // محاسبه تعداد طبقات از ارتفاع (هر 3.5 متر = 1 طبقه)
      const floors = Math.ceil(height / 3.5);

      const lengthUnits = getUnits(length);
      const widthUnits = getUnits(width);
      const floorUnits = floors;

      const totalUnits = lengthUnits * widthUnits * floorUnits;
      const pricePerUnit = 1000000;

      basePrice = totalUnits * pricePerUnit;

      breakdown.push(`طول: ${length} متر → ${lengthUnits} واحد`);
      breakdown.push(`عرض: ${width} متر → ${widthUnits} واحد`);
      breakdown.push(`ارتفاع: ${height} متر → ${floors} طبقه (${floorUnits} واحد)`);
      breakdown.push(`مجموع واحدها: ${lengthUnits} × ${widthUnits} × ${floorUnits} = ${totalUnits} واحد`);
      breakdown.push(`قیمت هر واحد: ${pricePerUnit.toLocaleString('fa-IR')} تومان`);
      breakdown.push(`قیمت کل: ${basePrice.toLocaleString('fa-IR')} تومان`);
      
      return { total: Math.round(basePrice), pricePerMeter: null, breakdown };
    }

    if (activeService === 'facade') {
      if (area <= 50) {
        basePrice = 3200000;
      } else if (area <= 100) {
        basePrice = 4200000;
      } else {
        pricePerMeter = 45000;
        basePrice = area * pricePerMeter;
      }
    } else if (activeService === 'formwork') {
      if (area <= 100) {
        basePrice = 3200000;
      } else if (area <= 200) {
        basePrice = 4000000;
      } else {
        pricePerMeter = 20000;
        basePrice = area * pricePerMeter;
      }
    } else if (activeService === 'ceiling-beam-yonolit' || activeService === 'ceiling-beam-ceramic') {
      // زیربتن تیرچه یونولیت و سفال - قیمت یکسان
      if (area <= 100) {
        basePrice = 7500000;
      } else if (area <= 200) {
        basePrice = 11000000;
      } else {
        pricePerMeter = 45000;
        basePrice = area * pricePerMeter;
      }
    } else if (activeService === 'ceiling-slab') {
      // زیربتن دال و وافل
      if (area <= 100) {
        basePrice = 8000000;
      } else if (area <= 200) {
        basePrice = 15000000;
      } else {
        pricePerMeter = 70000;
        basePrice = area * pricePerMeter;
      }
    }

    breakdown.push(`قیمت پایه: ${basePrice.toLocaleString('fa-IR')} تومان`);

    if (conditions.currentMonth === 1) {
      let monthMultiplier = 1;

      if (conditions.distanceRange === '15-25') {
        monthMultiplier *= 1.2;
        breakdown.push('فاصله 15-25 کیلومتر: +20%');
      } else if (conditions.distanceRange === '25-50') {
        monthMultiplier *= 1.4;
        breakdown.push('فاصله 25-50 کیلومتر: +40%');
      } else if (conditions.distanceRange === '50-85') {
        monthMultiplier *= 1.7;
        breakdown.push('فاصله 50-85 کیلومتر: +70%');
      }

      if (!onGround && conditions.platformHeight) {
        if (conditions.platformHeight <= 3) {
          monthMultiplier *= 1.2;
          breakdown.push('ارتفاع پای کار تا 3 متر: +20%');
        } else if (conditions.platformHeight <= 6) {
          monthMultiplier *= 1.4;
          breakdown.push('ارتفاع پای کار 3-6 متر: +40%');
        } else {
          monthMultiplier *= 1.6;
          breakdown.push('ارتفاع پای کار بیش از 6 متر: +60%');
        }
      }

      if (!onGround && conditions.scaffoldHeightFromPlatform) {
        if (conditions.scaffoldHeightFromPlatform > 15) {
          monthMultiplier *= 1.2;
          breakdown.push('ارتفاع داربست بیش از 15 متر: +20%');
        }
      }

      if (!vehicleReachesSite && conditions.vehicleDistance) {
        if (conditions.vehicleDistance <= 50) {
          monthMultiplier *= 1.1;
          breakdown.push('فاصله خودرو تا 50 متر: +10%');
        } else if (conditions.vehicleDistance <= 100) {
          monthMultiplier *= 1.15;
          breakdown.push('فاصله خودرو 50-100 متر: +15%');
        } else {
          monthMultiplier *= 1.25;
          breakdown.push('فاصله خودرو بیش از 100 متر: +25%');
        }
      }

      basePrice *= monthMultiplier;
    }

    // محاسبه تخفیف اجاره چند ماهه برای داربست سطحی نما
    if (isFacadeScaffolding && conditions.rentalMonthsPlan) {
      const monthsPlan = parseInt(conditions.rentalMonthsPlan.replace('+', ''));
      let discount = 0;
      
      if (conditions.rentalMonthsPlan === '2') {
        discount = 0.10; // 10% تخفیف برای 2 ماه
        breakdown.push(`تخفیف اجاره 2 ماهه: -10% در هر ماه`);
      } else if (conditions.rentalMonthsPlan === '3+') {
        discount = 0.15; // 15% تخفیف برای 3 ماه و بیشتر
        breakdown.push(`تخفیف اجاره 3 ماهه: -15% در هر ماه`);
      }
      
      if (discount > 0) {
        const discountedMonthlyPrice = basePrice * (1 - discount);
        const totalWithDiscount = discountedMonthlyPrice * monthsPlan;
        breakdown.push(`قیمت هر ماه با تخفیف: ${Math.round(discountedMonthlyPrice).toLocaleString('fa-IR')} تومان`);
        breakdown.push(`مجموع ${monthsPlan} ماه: ${Math.round(totalWithDiscount).toLocaleString('fa-IR')} تومان`);
        basePrice = totalWithDiscount;
      } else {
        breakdown.push(`مجموع 1 ماه: ${Math.round(basePrice).toLocaleString('fa-IR')} تومان`);
      }
    } else if (conditions.totalMonths > 1) {
      const additionalMonths = conditions.totalMonths - 1;
      const additionalCost = basePrice * 0.7 * additionalMonths;
      breakdown.push(`ماه‌های اضافی (${additionalMonths} ماه): ${additionalCost.toLocaleString('fa-IR')} تومان`);
      basePrice += additionalCost;
    }

    return { total: Math.round(basePrice), pricePerMeter, breakdown };
  };

  // Function to upload media files to storage
  // Extract thumbnail from video beginning
  const extractVideoThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      
      video.onloadedmetadata = () => {
        // Seek to beginning of video (0.1 seconds to ensure frame is loaded)
        video.currentTime = 0.1;
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        }, 'image/jpeg', 0.7);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Cannot load video'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  // آپلود یک فایل منفرد
  const uploadSingleFile = async (projectId: string, file: File): Promise<boolean> => {
    try {
      // Enforce backend upload limit: skip oversized videos (>50MB)
      const isVideo = file.type?.startsWith('video/');
      const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        toast({
          title: 'حجم ویدیو زیاد است',
          description: `حجم ${file.name} بیشتر از 50MB است. لطفاً فایل را کوچکتر کنید.`,
          variant: 'destructive'
        });
        return false;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('order-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        const statusCode = (uploadError as any)?.statusCode;
        let message = (uploadError as any)?.message || 'خطای نامشخص';
        if (statusCode === 413 || /payload too large|too large|exceeds/i.test(message)) {
          message = 'حجم فایل بیش از حد مجاز است. حداکثر 50MB برای هر ویدیو مجاز است.';
        }
        toast({
          title: 'خطا در آپلود',
          description: `خطا در آپلود ${file.name}: ${message}`,
          variant: 'destructive'
        });
        return false;
      }

      // Generate and upload thumbnail for videos
      let thumbnailPath: string | null = null;
      if (isVideo) {
        try {
          const thumbnailBlob = await extractVideoThumbnail(file);
          const thumbnailFileName = `${user!.id}/${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}_thumb.jpg`;
          
          const { error: thumbUploadError } = await supabase.storage
            .from('order-media')
            .upload(thumbnailFileName, thumbnailBlob, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'image/jpeg',
            });
          
          if (!thumbUploadError) {
            thumbnailPath = thumbnailFileName;
          }
        } catch (error) {
          console.error('Error generating thumbnail:', error);
          // Continue without thumbnail
        }
      }

      // Save metadata to database
      const fileType = file.type.startsWith('image/') ? 'image' : 'video';
      const { error: dbError } = await supabase
        .from('project_media')
        .insert({
          project_id: projectId,
          user_id: user!.id,
          file_path: filePath,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type,
          thumbnail_path: thumbnailPath
        });

      if (dbError) {
        console.error('Database error:', dbError);
        toast({
          title: 'خطا در ذخیره اطلاعات',
          description: `خطا در ذخیره اطلاعات ${file.name}`,
          variant: 'destructive'
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'خطا',
        description: `خطای غیرمنتظره در آپلود ${file.name}`,
        variant: 'destructive'
      });
      return false;
    }
  };

  // آپلود همه فایل‌ها به صورت موازی
  const uploadMediaFiles = async (projectId: string, files: File[]) => {
    if (!user) return;

    // آپلود همه فایل‌ها به صورت موازی (Parallel)
    const uploadPromises = files.map(file => uploadSingleFile(projectId, file));
    const results = await Promise.allSettled(uploadPromises);

    // شمارش موفقیت و شکست
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length;

    if (successCount > 0) {
      toast({
        title: 'موفق',
        description: `${successCount} فایل با موفقیت آپلود شد`,
      });
    }
  };

  const onSubmit = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (!customerId) {
      toast({ title: 'خطا', description: 'لطفاً ابتدا وارد شوید', variant: 'destructive' });
      return;
    }

    // بازخوانی آدرس از بالای فرم (از prefilledAddress که از مرحله قبل آمده)
    const finalAddress = prefilledAddress || address || detailedAddress;
    
    if (!finalAddress) {
      toast({ title: 'خطا', description: 'آدرس پروژه از مرحله قبل دریافت نشد', variant: 'destructive' });
      return;
    }

    // فقط چک کردن ابعاد به‌عنوان فیلد ضروری
    if (isColumnScaffolding || isPipeLengthScaffolding) {
      if (!dimensions[0]?.length || !dimensions[0]?.width || !columnHeight) {
        toast({ title: 'خطا', description: 'لطفاً تمام ابعاد را وارد کنید', variant: 'destructive' });
        return;
      }
    } else if (dimensions.some(d => !d.length || !d.width || !d.height)) {
      toast({ title: 'خطا', description: 'لطفاً تمام ابعاد را وارد کنید', variant: 'destructive' });
      return;
    }

    // Validate using Zod schema - فقط ابعاد
    try {
      scaffoldingFormSchema.parse({
        detailedAddress: finalAddress.trim(),
        dimensions: dimensions.map(d => ({
          length: parseFloat(d.length),
          width: parseFloat(d.width),
          height: parseFloat(d.height)
        }))
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: 'خطای اعتبارسنجی', description: error.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    // Validate dimensions - check minimum 3 meters for length and height
    if (isColumnScaffolding || isPipeLengthScaffolding) {
      const length = parseFloat(dimensions[0]?.length || '0');
      const width = parseFloat(dimensions[0]?.width || '0');
      const height = parseFloat(columnHeight || '0');
      
      if (length < 3 || isNaN(length)) {
        toast({ 
          title: 'خطا در ابعاد', 
          description: 'حداقل طول داربست باید 3 متر باشد', 
          variant: 'destructive' 
        });
        return;
      }
      
      if (height < 3 || isNaN(height)) {
        toast({ 
          title: 'خطا در ابعاد', 
          description: 'حداقل ارتفاع داربست باید 3 متر باشد', 
          variant: 'destructive' 
        });
        return;
      }
    } else {
      const invalidDimensions = dimensions.filter(dim => {
        const length = parseFloat(dim.length);
        const height = parseFloat(dim.height);
        return length < 3 || height < 3 || isNaN(length) || isNaN(height);
      });

      if (invalidDimensions.length > 0) {
        toast({ 
          title: 'خطا در ابعاد', 
          description: 'حداقل طول و ارتفاع داربست باید 3 متر باشد', 
          variant: 'destructive' 
        });
        return;
      }
    }

    // Sanitize address - استفاده از آدرس بازخوانی شده از بالای فرم
    const sanitizedAddress = sanitizeHtml(finalAddress.trim());

    try {
      setLoading(true);
      const priceData = calculatePrice();

      // دریافت نوع خدمات و subcategory از state یا حافظه یا داده‌های موجود در ویرایش
      const pendingSel = JSON.parse(localStorage.getItem('pendingServiceSelection') || 'null');
      let finalServiceTypeId: string | null = null;
      let finalSubcategoryId: string | null = null;

      // در حالت ویرایش، ابتدا از existingOrderData استفاده کن
      if (editOrderId && existingOrderData) {
        // استفاده از subcategory_id مستقیم از existingOrderData
        if (existingOrderData.subcategory_id) {
          finalSubcategoryId = existingOrderData.subcategory_id;
          
          // گرفتن service_type_id از طریق subcategory
          const { data: subData } = await supabase
            .from('subcategories')
            .select('id, service_type_id')
            .eq('id', existingOrderData.subcategory_id)
            .maybeSingle();
          
          if (subData) {
            finalServiceTypeId = subData.service_type_id;
          }
        }
      }

      // اگر از ویرایش پیدا نشد، از navigation state یا localStorage یا props استفاده کن
      if (!finalServiceTypeId || !finalSubcategoryId) {
        finalServiceTypeId = propServiceTypeId || serviceTypeId || navState?.serviceTypeId || pendingSel?.serviceTypeId || null;
        finalSubcategoryId = propSubcategoryId || subcategoryId || navState?.subcategoryId || pendingSel?.subcategoryId || null;
      }

      // اگر هنوز مشخص نشد، بر اساس نام‌ها یا کد زیرشاخه تلاش کن
      if (!finalServiceTypeId || !finalSubcategoryId) {
        // تلاش بر اساس نام نوع خدمت
        if (!finalServiceTypeId && navState?.serviceName) {
          const { data: st } = await supabase
            .from('service_types_v3')
            .select('id')
            .ilike('name', navState.serviceName)
            .maybeSingle();
          if (st) finalServiceTypeId = st.id;
        }

        // تلاش بر اساس نام زیرشاخه در صورت داشتن serviceTypeId
        if (finalServiceTypeId && !finalSubcategoryId && navState?.subcategoryName) {
          const { data: sc } = await supabase
            .from('subcategories')
            .select('id')
            .eq('service_type_id', finalServiceTypeId)
            .ilike('name', navState.subcategoryName)
            .maybeSingle();
          if (sc) finalSubcategoryId = sc.id;
        }

        // تلاش بر اساس کد زیرشاخه (در state یا حافظه) اگر هنوز نامشخص است
        if ((!finalServiceTypeId || !finalSubcategoryId) && (navState?.subcategoryCode || pendingSel?.subcategoryCode)) {
          const subCode = navState?.subcategoryCode || pendingSel?.subcategoryCode;
          const { data: sc2 } = await supabase
            .from('subcategories')
            .select('id, service_type_id')
            .eq('code', subCode)
            .maybeSingle();
          if (sc2) {
            finalServiceTypeId = sc2.service_type_id;
            finalSubcategoryId = sc2.id;
          }
        }

        // پیش‌فرض امن: اگر هنوز زیرشاخه مشخص نشده، زیرشاخه "با مصالح" (کد 10) را انتخاب کن
        if (finalServiceTypeId && !finalSubcategoryId) {
          const { data: scDefault } = await supabase
            .from('subcategories')
            .select('id')
            .eq('service_type_id', finalServiceTypeId)
            .eq('code', '10')
            .maybeSingle();
          if (scDefault) finalSubcategoryId = scDefault.id;
        }
      }

      if (!finalServiceTypeId || !finalSubcategoryId) {
        throw new Error('نوع خدمات یا زیرشاخه یافت نشد');
      }

      // استفاده از hierarchyProjectId اگر وجود داشت (از SelectLocation)
      let projectId = hierarchyProjectId;
      let finalLocationId: string | undefined;

      // اگر hierarchyProjectId نداشتیم، باید location و project را ایجاد کنیم
      if (!projectId) {
        // استفاده از locationId که از مرحله قبل آمده یا ایجاد جدید
        let locationId = propLocationId;
        
        // اگر locationId نداریم، location جدید ایجاد می‌کنیم
        if (!locationId) {
          // Create or get location
          const { data: existingLocation } = await supabase
            .from('locations')
            .select('id')
            .eq('user_id', user.id)
            .eq('address_line', sanitizedAddress)
            .maybeSingle();

          locationId = existingLocation?.id;

          if (!locationId) {
            const { data: newLocation, error: locError } = await supabase
              .from('locations')
              .insert([{
                user_id: user.id,
                province_id: provinceId || null,
                district_id: districtId || null,
                address_line: sanitizedAddress,
                lat: 0,
                lng: 0,
                is_active: true
              }])
              .select('id')
              .single();

            if (locError) throw locError;
            locationId = newLocation.id;
          }
        }

        // ذخیره برای استفاده در navigation
        finalLocationId = locationId;
        
        // ایجاد پروژه سلسله‌مراتبی برای لینک
        if (locationId && finalServiceTypeId && finalSubcategoryId) {
          try {
            const validated = getOrCreateProjectSchema.parse({
              _user_id: user.id,
              _location_id: locationId,
              _service_type_id: finalServiceTypeId,
              _subcategory_id: finalSubcategoryId
            });
            const { data: newProjectId, error: hierarchyError } = await supabase.rpc('get_or_create_project', validated as { _user_id: string; _location_id: string; _service_type_id: string; _subcategory_id: string });
            
            if (!hierarchyError && newProjectId) {
              projectId = newProjectId;
            }
          } catch (error) {
            console.error('خطا در ایجاد پروژه سلسله‌مراتبی:', error);
          }
        }
      }

      // Check if editing or creating new order
      if (editOrderId) {
        // Update existing order
        const { error: updateError } = await supabase
          .from('projects_v3')
          .update({
            address: sanitizedAddress,
            detailed_address: sanitizedAddress,
            notes: {
              service_type: activeService,
              dimensions: dimensions.map(d => ({
                length: parseFloat(d.length),
                width: parseFloat(d.width),
                height: parseFloat(d.height),
              })),
              columnHeight: isColumnScaffolding ? parseFloat(columnHeight) : undefined,
              column_units: isColumnScaffolding ? (() => {
                const getUnits = (dimension: number): number => {
                  if (dimension >= 0.20 && dimension <= 3.5) return 1;
                  if (dimension > 3.5 && dimension <= 7) return 2;
                  if (dimension > 7 && dimension <= 10.5) return 3;
                  return 0;
                };
                const length = parseFloat(dimensions[0]?.length || '0');
                const width = parseFloat(dimensions[0]?.width || '0');
                const height = parseFloat(columnHeight || '0');
                const floors = Math.ceil(height / 3.5);
                const lengthUnits = getUnits(length);
                const widthUnits = getUnits(width);
                const floorUnits = floors;
                const totalUnits = lengthUnits * widthUnits * floorUnits;
                return {
                  length_units: lengthUnits,
                  width_units: widthUnits,
                  height_units: floorUnits,
                  total_units: totalUnits
                };
              })() : undefined,
              isFacadeWidth2m,
              conditions,
              onGround,
              vehicleReachesSite,
              locationPurpose,
              totalArea: calculateTotalArea(),
              estimated_price: priceData.total,
              price_breakdown: priceData.breakdown,
              installationDateTime,
              customerName: user?.user_metadata?.full_name || '',
              phoneNumber: user?.phone || '',
            } as any
          })
          .eq('id', editOrderId);

        if (updateError) throw updateError;

        toast({ 
          title: 'بروزرسانی شد', 
          description: 'سفارش شما با موفقیت ویرایش شد' 
        });

        // آپلود فایل‌ها در پس‌زمینه (بدون انتظار)
        if (mediaFiles && mediaFiles.length > 0) {
          uploadMediaFiles(editOrderId, mediaFiles).catch(err => {
            console.error('Background upload error:', err);
          });
        }

        navigate(`/orders/${editOrderId}`);
      } else {
        // ایجاد سفارش جدید به‌صورت اتمیک در دیتابیس با لینک به پروژه سلسله‌مراتبی
        // مطمئن شویم که provinceId و districtId UUID معتبر یا null هستند
        const validProvinceId = provinceId && provinceId.trim() !== '' ? provinceId : null;
        const validDistrictId = districtId && districtId.trim() !== '' ? districtId : null;
        
        const validated = createProjectV3Schema.parse({
          _customer_id: customerId,
          _province_id: validProvinceId!,
          _district_id: validDistrictId,
          _subcategory_id: finalSubcategoryId,
          _hierarchy_project_id: projectId || hierarchyProjectId,
          _address: sanitizedAddress,
          _detailed_address: sanitizedAddress,
          _notes: JSON.stringify({
            service_type: activeService,
            dimensions: dimensions.map(d => ({
              length: parseFloat(d.length),
              width: parseFloat(d.width),
              height: parseFloat(d.height),
            })),
            columnHeight: isColumnScaffolding ? parseFloat(columnHeight) : undefined,
            column_units: isColumnScaffolding ? (() => {
              const getUnits = (dimension: number): number => {
                if (dimension >= 0.20 && dimension <= 3.5) return 1;
                if (dimension > 3.5 && dimension <= 7) return 2;
                if (dimension > 7 && dimension <= 10.5) return 3;
                return 0;
              };
              const length = parseFloat(dimensions[0]?.length || '0');
              const width = parseFloat(dimensions[0]?.width || '0');
              const height = parseFloat(columnHeight || '0');
              const floors = Math.ceil(height / 3.5);
              const lengthUnits = getUnits(length);
              const widthUnits = getUnits(width);
              const floorUnits = floors;
              const totalUnits = lengthUnits * widthUnits * floorUnits;
              return {
                length_units: lengthUnits,
                width_units: widthUnits,
                height_units: floorUnits,
                total_units: totalUnits
              };
            })() : undefined,
            isFacadeWidth2m,
            conditions,
            onGround,
            vehicleReachesSite,
            locationPurpose,
            totalArea: calculateTotalArea(),
            estimated_price: priceData.total,
            price_breakdown: priceData.breakdown,
            installationDateTime,
            customerName: user?.user_metadata?.full_name || '',
            phoneNumber: user?.phone || '',
          })
        });
        
        const { data: createdRows, error: createError } = await supabase.rpc('create_project_v3', validated as any);

        if (createError) throw createError;
        const createdProject = createdRows?.[0];
        if (!createdProject) throw new Error('خطا در ایجاد سفارش');

        toast({ 
          title: 'ثبت شد', 
          description: `سفارش شما با کد ${createdProject.code} ثبت شد و در انتظار تایید است.` 
        });

        // آپلود فایل‌ها در پس‌زمینه (بدون انتظار) - کاربر بلافاصله هدایت می‌شود
        if (mediaFiles && mediaFiles.length > 0) {
          uploadMediaFiles(createdProject.id, mediaFiles).catch(err => {
            console.error('Background upload error:', err);
          });
        }

        // اتوماسیون اداری حالا با database trigger اجرا می‌شود (order-automation function حذف شد)

        // هدایت کاربر به صفحه جزئیات سفارش بلافاصله
        navigate(`/orders/${createdProject.id}`);
      }
    } catch (e: any) {
      console.error('Error:', e);
      toast({ title: 'خطا', description: e.message || 'ثبت با مشکل مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const priceData = calculatePrice();

  // Show loading spinner while fetching order data
  if (loadingOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="space-y-6">

      {/* Header with order info if editing */}
      {editOrderId && orderData && (
        <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-300">
              جزئیات سفارش - کد: {orderData.code}
            </CardTitle>
            <CardDescription className="text-slate-700 dark:text-slate-300">
              وضعیت: {
                orderData.status === 'pending' ? 'در انتظار تایید' :
                orderData.status === 'approved' ? 'تایید شده' :
                orderData.status === 'in_progress' ? 'در حال اجرا' :
                orderData.status === 'completed' ? 'تکمیل شده' :
                orderData.status === 'rejected' ? 'رد شده' :
                orderData.status
              }
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* نوع داربست */}
      <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="scaffold-type-select" className="text-foreground font-semibold">نوع داربست مورد نظر خود را انتخاب کنید</Label>
            <Select
              value={scaffoldType}
              onValueChange={(value: 'formwork' | 'ceiling' | 'facade' | 'column' | 'pipe-length') => {
                setScaffoldType(value);
                // Reset dimensions - فقط داربست سطحی نما عرض پیش‌فرض ۱ دارد
                const defaultWidth = value === 'facade' ? '1' : '';
                setDimensions([{ id: '1', length: '', width: defaultWidth, height: '', useTwoMeterTemplate: false }]);
                setColumnHeight('');
                setCeilingSubType('');
                
                if (value === 'formwork') {
                  setActiveService('formwork');
                } else if (value === 'ceiling') {
                  setActiveService(''); // Reset - user must select sub-type
                } else if (value === 'column') {
                  setActiveService('column');
                } else if (value === 'pipe-length') {
                  setActiveService('pipe-length');
                } else {
                  setActiveService('facade');
                }
              }}
            >
              <SelectTrigger id="scaffold-type-select" className="w-full bg-background">
                <SelectValue placeholder="یکی از نوع خدمات را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="facade">داربست سطحی نما</SelectItem>
                <SelectItem value="formwork">داربست حجمی کفراژ</SelectItem>
                <SelectItem value="ceiling">داربست زیر بتن (سقف)</SelectItem>
                <SelectItem value="column">داربست ستونی، نورگیر، چاله اسانسور و ...</SelectItem>
                <SelectItem value="pipe-length">داربست به طول لوله مصرفی</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* لیست کشویی نوع زیربتن */}
          {scaffoldType === 'ceiling' && (
            <div className="space-y-2 mt-4">
              <Label htmlFor="ceiling-subtype-select" className="text-foreground font-semibold">نوع زیربتن را انتخاب کنید</Label>
              <Select
                value={ceilingSubType}
                onValueChange={(value: 'ceiling-beam-yonolit' | 'ceiling-beam-ceramic' | 'ceiling-slab') => {
                  setCeilingSubType(value);
                  setActiveService(value);
                }}
              >
                <SelectTrigger id="ceiling-subtype-select" className="w-full bg-background">
                  <SelectValue placeholder="نوع زیربتن را انتخاب کنید" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ceiling-beam-yonolit">زیربتن تیرچه یونولیت</SelectItem>
                  <SelectItem value="ceiling-beam-ceramic">زیربتن تیرچه سفال</SelectItem>
                  <SelectItem value="ceiling-slab">زیربتن دال و وافل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نمایش فیلدهای زیر فقط اگر نوع داربست انتخاب شده باشد */}
      {scaffoldType && (scaffoldType !== 'ceiling' || ceilingSubType) && (
      <>
      {/* شرح محل نصب و ابعاد */}
      <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-xl font-bold flex items-center gap-2">
                <Box className="h-6 w-6 text-primary" />
                شرح محل نصب و ابعاد
              </CardTitle>
              <CardDescription className="text-muted-foreground">ابعاد به متر وارد شود</CardDescription>
            </div>
            {isFacadeScaffolding && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <HelpCircle className="h-4 w-4" />
                    راهنمای ابعاد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl text-right">راهنمای وارد کردن ابعاد داربست سطحی</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-right" dir="rtl">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">۱</span>
                        <span>حداقل فاصله بین دو پایه</span>
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 pr-8">
                        حداقل بین دو پایه سه متر می‌باشد و اگر بین دو پایه کمتر از 3 متر باشد همان سه متر در طول داربست حساب می‌شود.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <h3 className="font-bold text-green-900 dark:text-green-300 mb-2 flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">۲</span>
                        <span>استفاده از قالب دو متری</span>
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 pr-8">
                        اگر در داربست سطحی یک یا چند تا از پایه‌ها از قالب دو متری استفاده شده باشد، یک متر به ازای هر پایه با قالب دو متری به طول داربست اضافه می‌شود.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <h3 className="font-bold text-orange-900 dark:text-orange-300 mb-2 flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm">۳</span>
                        <span>عرض بیشتر از یک متر</span>
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 pr-8">
                        اگر عرض داربست سطحی بیشتر از 1 متر باشد کاربر باید تیک گزینه "داربست سطحی با قالب 2 متری (عرض 2 متر)" را زده باشد.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* شرح محل نصب و نوع فعالیت */}
          <div className="space-y-2">
            <Label className="text-foreground font-semibold">شرح محل نصب و نوع فعالیت</Label>
            <Textarea
              value={locationPurpose}
              onChange={(e) => setLocationPurpose(e.target.value)}
              placeholder="مثال: اجرای داربست برای نمای ساختمان"
              className="min-h-[80px] text-foreground"
            />
          </div>

          {/* ابعاد */}
          <div className="space-y-4">
          {isPipeLengthScaffolding ? (
            // فرم ویژه برای داربست به طول لوله مصرفی - فقط یک فیلد
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">طول مجموع لوله داربست‌های استفاده شده (متر)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dimensions[0].length}
                  onChange={(e) => updateDimension('1', 'length', e.target.value)}
                  placeholder="طول مجموع را وارد کنید"
                />
              </div>
              
              {/* نمایش قیمت‌گذاری برای داربست به طول لوله مصرفی */}
              {parseFloat(dimensions[0]?.length || '0') > 0 && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                  <div className="text-sm text-foreground font-semibold">اطلاعات قیمت‌گذاری:</div>
                  {parseFloat(dimensions[0]?.length || '0') <= 100 && (
                    <div className="text-sm text-muted-foreground">
                      زیر ۱۰۰ متر: قیمت ثابت ۳,۲۰۰,۰۰۰ تومان
                    </div>
                  )}
                  {parseFloat(dimensions[0]?.length || '0') > 100 && parseFloat(dimensions[0]?.length || '0') <= 200 && (
                    <div className="text-sm text-muted-foreground">
                      ۱۰۰ تا ۲۰۰ متر: قیمت ثابت ۴,۲۰۰,۰۰۰ تومان
                    </div>
                  )}
                  {parseFloat(dimensions[0]?.length || '0') > 200 && (
                    <div className="text-sm text-muted-foreground">
                      بیش از ۲۰۰ متر: فی هر متر لوله ۳۰,۰۰۰ تومان
                    </div>
                  )}
                  <div className="text-sm font-semibold text-primary">
                    قیمت تخمینی: {calculatePrice().total.toLocaleString('fa-IR')} تومان
                  </div>
                </div>
              )}
            </div>
          ) : isColumnScaffolding ? (
            // فرم ویژه برای داربست ستونی
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="text-foreground font-semibold">طول (متر)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dimensions[0].length}
                    onChange={(e) => updateDimension('1', 'length', e.target.value)}
                    placeholder="طول را وارد کنید"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-foreground font-semibold">عرض داربست را وارد کنید</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dimensions[0].width}
                    onChange={(e) => updateDimension('1', 'width', e.target.value)}
                    placeholder="عرض را وارد کنید"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-foreground font-semibold">ارتفاع (متر)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={columnHeight}
                    onChange={(e) => setColumnHeight(e.target.value)}
                    placeholder="ارتفاع را وارد کنید"
                  />
                </div>
              </div>
            </div>
          ) : (
            // فرم عادی برای سایر انواع داربست
            <>
              {dimensions.map((dim) => (
                <div key={dim.id} className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-foreground font-semibold">طول (متر)</Label>
                      <Input
                        type="number"
                        step={scaffoldType === 'facade' ? '1' : '0.01'}
                        min="3"
                        value={dim.length}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (scaffoldType === 'facade') {
                            // فقط اعداد صحیح مثبت برای داربست سطحی نما
                            if (value === '' || /^\d+$/.test(value)) {
                              updateDimension(dim.id, 'length', value);
                            }
                          } else {
                            updateDimension(dim.id, 'length', value);
                          }
                        }}
                        placeholder="حداقل 3 متر"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-foreground font-semibold">عرض (متر)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={isFormworkScaffolding ? "3" : undefined}
                        value={isFacadeScaffolding && dim.useTwoMeterTemplate ? '1.5' : dim.width}
                        onChange={(e) => updateDimension(dim.id, 'width', e.target.value)}
                        placeholder={isFormworkScaffolding ? "حداقل 3 متر" : "1"}
                        readOnly={isFacadeScaffolding}
                        disabled={isFacadeScaffolding}
                        className={isFacadeScaffolding ? "bg-muted" : ""}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-foreground font-semibold">ارتفاع (متر)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="3"
                        value={dim.height}
                        onChange={(e) => updateDimension(dim.id, 'height', e.target.value)}
                        placeholder="حداقل 3 متر"
                      />
                    </div>
                    {dimensions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDimension(dim.id)}
                        className="flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Checkbox for 2-meter template - individual for each dimension in facade scaffolding */}
                  {isFacadeScaffolding && (
                    <div className="flex items-center space-x-2 space-x-reverse pt-1 pr-2">
                      <Checkbox
                        id={`two-meter-template-${dim.id}`}
                        checked={dim.useTwoMeterTemplate || false}
                        onCheckedChange={(checked) => {
                          setDimensions(dimensions.map(d => 
                            d.id === dim.id 
                              ? { ...d, useTwoMeterTemplate: checked as boolean, width: checked ? '1.5' : '1' }
                              : d
                          ));
                        }}
                      />
                      <Label
                        htmlFor={`two-meter-template-${dim.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        داربست سطحی با قالب 2 متری (عرض 2 متر) میباشد
                      </Label>
                    </div>
                  )}
                </div>
              ))}
              
              <Button type="button" variant="outline" onClick={addDimension} className="w-full">
                <Plus className="h-4 w-4 ml-2" />
                افزودن ابعاد اضافی
              </Button>
            </>
          )}
          
          {!isColumnScaffolding && !isPipeLengthScaffolding && (
            <div className="text-sm text-slate-700 dark:text-slate-300 pt-2">
              مجموع مساحت: <span className="font-semibold">{Math.round(calculateTotalArea())}</span> متر مکعب
            </div>
          )}

          {/* هشدار برای داربست حجمی کفراژ */}
          {getFormworkWarning() && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>توجه</AlertTitle>
              <AlertDescription>{getFormworkWarning()}</AlertDescription>
            </Alert>
          )}

          {/* هشدار برای داربست سطحی نما */}
          {getFacadeWarning() && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>توجه</AlertTitle>
              <AlertDescription>{getFacadeWarning()}</AlertDescription>
            </Alert>
          )}
          </div>
        </CardContent>
      </Card>

      {/* نمایش کادرهای زیر فقط اگر ابعاد وارد شده باشد و هشدارها فعال نباشند */}
      {!getFacadeWarning() && !getFormworkWarning() && (calculateTotalArea() > 0 || 
        (isColumnScaffolding && columnHeight && dimensions[0]?.length && dimensions[0]?.width) ||
        (isPipeLengthScaffolding && parseFloat(dimensions[0]?.length || '0') > 0)
      ) && (
      <>

      {/* Service Conditions */}
      <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-300">شرایط سرویس</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* نمایش فیلد اجاره چند ماهه برای داربست سطحی نما */}
          {isFacadeScaffolding ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">کرایه داربست به شرط چند ماه است</Label>
                <Select
                  value={conditions.rentalMonthsPlan || '1'}
                  onValueChange={(v: '1' | '2' | '3+') => {
                    const monthsNum = parseInt(v.replace('+', ''));
                    setConditions({ 
                      ...conditions, 
                      rentalMonthsPlan: v,
                      totalMonths: monthsNum,
                      currentMonth: 1
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="1">به شرط یک ماه</SelectItem>
                    <SelectItem value="2">به شرط دو ماه</SelectItem>
                    <SelectItem value="3+">به شرط سه ماه و بیشتر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">کرایه ماه جاری داربست</Label>
                <Input
                  type="text"
                  disabled
                  value={
                    conditions.rentalMonthsPlan === '1' ? 'ماه اول' :
                    conditions.rentalMonthsPlan === '2' ? 'ماه اول و دوم' :
                    conditions.rentalMonthsPlan === '3+' ? 'ماه اول و دوم و سوم' :
                    'ماه اول'
                  }
                  className="bg-muted"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">تعداد کل ماه‌ها</Label>
                <Input
                  type="number"
                  min="1"
                  value={conditions.totalMonths}
                  onChange={(e) => setConditions({ ...conditions, totalMonths: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">ماه جاری</Label>
                <Input
                  type="number"
                  min="1"
                  max={conditions.totalMonths}
                  value={conditions.currentMonth}
                  onChange={(e) => setConditions({ ...conditions, currentMonth: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-foreground font-semibold">فاصله از مرکز استان</Label>
            <Select
              value={conditions.distanceRange}
              onValueChange={(v: any) => setConditions({ ...conditions, distanceRange: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-15">0-15 کیلومتر</SelectItem>
                <SelectItem value="15-25">15-25 کیلومتر (+20%)</SelectItem>
                <SelectItem value="25-50">25-50 کیلومتر (+40%)</SelectItem>
                <SelectItem value="50-85">50-85 کیلومتر (+70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground font-semibold">محل نصب داربست</Label>
            <RadioGroup value={onGround ? 'ground' : 'platform'} onValueChange={(v) => setOnGround(v === 'ground')}>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="ground" id="ground" />
                <Label htmlFor="ground" className="cursor-pointer text-foreground">روی زمین</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="platform" id="platform" />
                <Label htmlFor="platform" className="cursor-pointer text-foreground">روی سکو/پشت‌بام</Label>
              </div>
            </RadioGroup>

            {!onGround && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">ارتفاع پای کار (متر)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={conditions.platformHeight ?? ''}
                    onChange={(e) => setConditions({ ...conditions, platformHeight: parseFloat(e.target.value) || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">ارتفاع داربست از پای کار (متر)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={conditions.scaffoldHeightFromPlatform ?? ''}
                    onChange={(e) => setConditions({ ...conditions, scaffoldHeightFromPlatform: parseFloat(e.target.value) || null })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-foreground font-semibold">دسترسی خودرو</Label>
            <RadioGroup
              value={vehicleReachesSite ? 'reaches' : 'not-reaches'}
              onValueChange={(v) => setVehicleReachesSite(v === 'reaches')}
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="reaches" id="reaches" />
                <Label htmlFor="reaches" className="cursor-pointer text-foreground">خودرو به محل می‌رسد</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="not-reaches" id="not-reaches" />
                <Label htmlFor="not-reaches" className="cursor-pointer text-foreground">خودرو به محل نمی‌رسد</Label>
              </div>
            </RadioGroup>

            {!vehicleReachesSite && (
              <div className="space-y-2 pt-2">
                <Label className="text-foreground font-semibold">فاصله خودرو تا محل (متر)</Label>
                <Input
                  type="number"
                  step="1"
                  value={conditions.vehicleDistance ?? ''}
                  onChange={(e) => setConditions({ ...conditions, vehicleDistance: parseFloat(e.target.value) || null })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Media Upload Section */}
      <MediaUploader
        onFilesChange={setMediaFiles}
        maxImages={6}
        maxVideos={5}
        maxImageSize={10}
        maxVideoSize={50}
        maxVideoDuration={180}
      />

      {/* Installation Date & Time */}
      <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-300">زمان نصب داربست</CardTitle>
          <CardDescription className="text-slate-700 dark:text-slate-300 font-semibold">
            تاریخ و ساعت مورد نظر برای نصب داربست را انتخاب کنید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-foreground font-semibold">تاریخ و زمان نصب</Label>
            <PersianDatePicker
              value={installationDateTime}
              onChange={setInstallationDateTime}
              placeholder="انتخاب تاریخ نصب"
              timeMode="ampm"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              امکان انتخاب تاریخ‌های گذشته وجود ندارد
            </p>
          </div>
        </CardContent>
      </Card>

            {/* Price Summary */}
            {(calculateTotalArea() > 0 || 
              (isColumnScaffolding && columnHeight && dimensions[0]?.length && dimensions[0]?.width) ||
              (isPipeLengthScaffolding && parseFloat(dimensions[0]?.length || '0') > 0)
            ) && (
        <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-300">خلاصه قیمت</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {priceData.breakdown.map((item, idx) => (
              <div key={idx} className="text-sm text-slate-700 dark:text-slate-300">{item}</div>
            ))}
            <div className="pt-3 border-t">
              <div className="text-xl font-bold">
                قیمت نهایی: <span className="text-primary">{priceData.total.toLocaleString('fa-IR')}</span> تومان
              </div>
              {priceData.pricePerMeter && (
                <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  (قیمت هر متر مکعب: {priceData.pricePerMeter.toLocaleString('fa-IR')} تومان)
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}

        <Button 
          onClick={onSubmit}
          disabled={
            loading || 
            !scaffoldType ||
            !!getFacadeWarning() ||
            !!getFormworkWarning() ||
            (isPipeLengthScaffolding 
              ? parseFloat(dimensions[0]?.length || '0') <= 0
              : isColumnScaffolding 
                ? !dimensions[0]?.length || !dimensions[0]?.width || !columnHeight
                : dimensions.some(d => !d.length || !d.width || !d.height)
            )
          }
          className="w-full" 
          size="lg"
        >
          {loading ? 'در حال ثبت...' : 'ثبت درخواست'}
        </Button>
      </>
      )}
      </div>
    </div>
  );
}
