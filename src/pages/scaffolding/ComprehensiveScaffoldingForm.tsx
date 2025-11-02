import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, AlertCircle, ChevronDown, ClipboardList } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCustomer } from '@/hooks/useCustomer';
import { useProvinces } from '@/hooks/useProvinces';
import { useDistricts } from '@/hooks/useDistricts';
import { sanitizeHtml } from '@/lib/security';
import { scaffoldingFormSchema } from '@/lib/validations';
import { MediaUploader } from '@/components/orders/MediaUploader';

interface Dimension {
  id: string;
  length: string;
  width: string;
  height: string;
}

interface ServiceConditions {
  totalMonths: number;
  currentMonth: number;
  distanceRange: '0-15' | '15-25' | '25-50' | '50-85';
  platformHeight: number | null;
  scaffoldHeightFromPlatform: number | null;
  vehicleDistance: number | null;
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
  editOrderId,
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
  const navState = (location?.state || {}) as any;
  const { toast } = useToast();
  const { user } = useAuth();
  const { customerId } = useCustomer();
  const { provinces } = useProvinces();
  
  // دریافت hierarchyProjectId از props یا state برای لینک کردن سفارش
  const hierarchyProjectId = propHierarchyProjectId || navState?.hierarchyProjectId || null;
  const locationId = propLocationId || navState?.locationId;
  const provinceId = propProvinceId || navState?.provinceId || null;
  const districtId = propDistrictId || navState?.districtId || null;
  const serviceTypeId = propServiceTypeId || navState?.serviceTypeId;
  const subcategoryId = propSubcategoryId || navState?.subcategoryId;

  const [scaffoldType, setScaffoldType] = useState<'formwork' | 'ceiling' | 'facade'>('facade');
  const [activeService, setActiveService] = useState<'facade' | 'formwork' | 'ceiling-tiered' | 'ceiling-slab'>('facade');
  const address = prefilledAddress || navState?.locationAddress || '';
  const [dimensions, setDimensions] = useState<Dimension[]>([{ id: '1', length: '', width: '1', height: '' }]);
  const [isFacadeWidth2m, setIsFacadeWidth2m] = useState(false);
  
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
  });

  const [onGround, setOnGround] = useState(true);
  const [vehicleReachesSite, setVehicleReachesSite] = useState(true);
  const [ceilingTieredOpen, setCeilingTieredOpen] = useState(false);
  const [ceilingSlabOpen, setCeilingSlabOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

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
            } else if (notes.service_type === 'ceiling-tiered' || notes.service_type === 'ceiling-slab') {
              setScaffoldType('ceiling');
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
        }
      } catch (error) {
        console.error('Error loading order data:', error);
      }
    }
  }, [editOrderId, existingOrderData]);

  const addDimension = () => {
    const newId = (dimensions.length + 1).toString();
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
    } else if (activeService === 'ceiling-tiered') {
      if (area <= 100) {
        basePrice = 7500000;
      } else if (area <= 200) {
        basePrice = 11000000;
      } else {
        pricePerMeter = 45000;
        basePrice = area * pricePerMeter;
      }
    } else if (activeService === 'ceiling-slab') {
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

    if (conditions.totalMonths > 1) {
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
    if (dimensions.some(d => !d.length || !d.width || !d.height)) {
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

        // پیش‌فرض امن: اگر هنوز زیرشاخه مشخص نشده، زیرشاخه "با مصالح" (کد 01) را انتخاب کن
        if (finalServiceTypeId && !finalSubcategoryId) {
          const { data: scDefault } = await supabase
            .from('subcategories')
            .select('id')
            .eq('service_type_id', finalServiceTypeId)
            .eq('code', '01')
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
            const { data: newProjectId, error: hierarchyError } = await supabase.rpc('get_or_create_project', {
              _user_id: user.id,
              _location_id: locationId,
              _service_type_id: finalServiceTypeId,
              _subcategory_id: finalSubcategoryId
            });
            
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
              isFacadeWidth2m,
              conditions,
              onGround,
              vehicleReachesSite,
              totalArea: calculateTotalArea(),
              estimated_price: priceData.total,
              price_breakdown: priceData.breakdown,
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
        
        const { data: createdRows, error: createError } = await supabase.rpc('create_project_v3', {
          _customer_id: customerId,
          _province_id: validProvinceId,
          _district_id: validDistrictId,
          _subcategory_id: finalSubcategoryId,
          _hierarchy_project_id: projectId || hierarchyProjectId,
          _address: sanitizedAddress,
          _detailed_address: sanitizedAddress,
          _notes: {
            service_type: activeService,
            dimensions: dimensions.map(d => ({
              length: parseFloat(d.length),
              width: parseFloat(d.width),
              height: parseFloat(d.height),
            })),
            isFacadeWidth2m,
            conditions,
            onGround,
            vehicleReachesSite,
            totalArea: calculateTotalArea(),
            estimated_price: priceData.total,
            price_breakdown: priceData.breakdown,
          } as any
        });

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

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/hero-background.webp)',
        }}
      >
        {/* Overlay gradient for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-6 pb-8">
        <div className="flex items-center justify-center gap-3 mb-6 bg-white rounded-lg p-6 shadow-lg">
          <ClipboardList className="w-6 h-6 text-blue-800" />
          <h1 className="text-xl font-bold text-blue-800">فرم ثبت سفارش داربست فلزی</h1>
          <p className="text-sm text-blue-600 mt-1">خدمات اجرای داربست به همراه اجناس داربست و حمل و نقل</p>
        </div>

      {/* نوع داربست */}
      <Card className="shadow-2xl bg-white dark:bg-card border-2">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-300">نوع خدمات داربست</CardTitle>
          <CardDescription className="text-foreground font-semibold">نوع داربست مورد نیاز خود را انتخاب کنید</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="scaffold-type-select" className="text-foreground">انتخاب نوع داربست:</Label>
            <Select
              value={scaffoldType}
              onValueChange={(value: 'formwork' | 'ceiling' | 'facade') => {
                setScaffoldType(value);
                if (value === 'formwork') {
                  setActiveService('formwork');
                } else if (value === 'ceiling') {
                  setActiveService('ceiling-tiered');
                } else {
                  setActiveService('facade');
                }
              }}
            >
              <SelectTrigger id="scaffold-type-select" className="w-full bg-background">
                <SelectValue placeholder="نوع داربست را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="facade">داربست سطحی نما</SelectItem>
                <SelectItem value="formwork">داربست کفراژ</SelectItem>
                <SelectItem value="ceiling">داربست زیر بتن (سقف)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card className="shadow-2xl bg-white dark:bg-card border-2">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-300">ابعاد</CardTitle>
          <CardDescription className="text-slate-700 dark:text-slate-300 font-semibold">ابعاد به متر وارد شود</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dimensions.map((dim) => (
            <div key={dim.id} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-foreground font-semibold">طول (متر)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dim.length}
                  onChange={(e) => updateDimension(dim.id, 'length', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-foreground font-semibold">عرض (متر)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dim.width}
                  onChange={(e) => updateDimension(dim.id, 'width', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-foreground font-semibold">ارتفاع (متر)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={dim.height}
                  onChange={(e) => updateDimension(dim.id, 'height', e.target.value)}
                  placeholder="0"
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
          ))}
          <Button type="button" variant="outline" onClick={addDimension} className="w-full">
            <Plus className="h-4 w-4 ml-2" />
            افزودن ابعاد اضافی
          </Button>
          <div className="text-sm text-slate-700 dark:text-slate-300 pt-2">
            مجموع مساحت: <span className="font-semibold">{Math.round(calculateTotalArea())}</span> متر مکعب
          </div>
        </CardContent>
      </Card>

      {/* Service Conditions */}
      <Card className="shadow-2xl bg-white dark:bg-card border-2">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-300">شرایط سرویس</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        maxImages={4}
        maxVideos={2}
        maxImageSize={10}
        maxVideoSize={50}
        maxVideoDuration={180}
      />

      {/* Price Summary */}
      {calculateTotalArea() > 0 && (
        <Card className="shadow-2xl bg-white dark:bg-card border-2 border-primary">
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

      <Button 
        onClick={onSubmit} 
        disabled={loading || dimensions.some(d => !d.length || !d.width || !d.height)} 
        className="w-full" 
        size="lg"
      >
        {loading ? 'در حال ثبت...' : 'ثبت درخواست'}
      </Button>
      </div>
    </div>
  );
}
