import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sendPushNotification, notifyManagers } from '@/lib/notifications';
import { reportActivity } from '@/lib/activityReporter';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, AlertCircle, ChevronDown, ClipboardList, HelpCircle, FileText, Box, MapPin, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCustomer } from '@/hooks/useCustomer';
import { useProvinces } from '@/hooks/useProvinces';
import { useDistricts } from '@/hooks/useDistricts';
import { useLocations } from '@/hooks/useLocations';
import { sanitizeHtml } from '@/lib/security';
import { scaffoldingFormSchema } from '@/lib/validations';
import { MediaUploader } from '@/components/orders/MediaUploader';
import { Textarea } from '@/components/ui/textarea';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { getOrCreateProjectSchema, createProjectV3Schema } from '@/lib/rpcValidation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { NewLocationForm } from '@/components/locations/NewLocationForm';
import { useScaffoldingPricing } from '@/hooks/useScaffoldingPricing';
import { useScaffoldingNoMaterialsPricing } from '@/hooks/useScaffoldingNoMaterialsPricing';
import { OrderForOthers, RecipientData } from '@/components/orders/OrderForOthers';
import { buildOrderSmsAddress, sendOrderSms, sendCeoNotificationSms } from '@/lib/orderSms';
import { ExpertPricingRequestDialog } from '@/components/orders/ExpertPricingRequestDialog';
import { savePendingOrder, getPendingOrder, clearPendingOrder } from '@/lib/pendingOrder';
import { useCooperationDiscount } from '@/hooks/useCooperationDiscount';
import { roundToThousand, applyDiscountAndRound } from '@/lib/cooperationDiscount';

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
  isManagerEdit?: boolean; // وقتی مدیر در حال ویرایش سفارش است
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
  isManagerEdit = false,
}: ComprehensiveScaffoldingFormProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const navState = (location?.state || {}) as any;
  const { toast } = useToast();
  const { user } = useAuth();
  const { customerId } = useCustomer();
  const { provinces } = useProvinces();
  const { locations, loading: locationsLoading, refetch: refetchLocations } = useLocations();
  const [routeProjectMeta, setRouteProjectMeta] = useState<{
    locationId?: string;
    serviceTypeId?: string;
    subcategoryId?: string;
    provinceId?: string | null;
    districtId?: string | null;
    address?: string;
  } | null>(null);
  
  // دریافت editOrderId از query parameter یا prop
  const editOrderId = searchParams.get('edit') || propEditOrderId;
  
  // دریافت hierarchyProjectId از props یا state برای لینک کردن سفارش
  const hierarchyProjectId = propHierarchyProjectId || navState?.hierarchyProjectId || propProjectId || navState?.projectId || routeProjectId || null;
  const initialLocationId = propLocationId || navState?.locationId || routeProjectMeta?.locationId;
  const initialProvinceId = propProvinceId || navState?.provinceId || routeProjectMeta?.provinceId || null;
  const initialDistrictId = propDistrictId || navState?.districtId || routeProjectMeta?.districtId || null;
  const serviceTypeId = propServiceTypeId || navState?.serviceTypeId || routeProjectMeta?.serviceTypeId;
  const subcategoryId = propSubcategoryId || navState?.subcategoryId || routeProjectMeta?.subcategoryId;

  // State برای آدرس انتخابی
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialLocationId || null);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(initialProvinceId);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(initialDistrictId);
  const [showNewLocationDialog, setShowNewLocationDialog] = useState(false);

  const [scaffoldType, setScaffoldType] = useState<'formwork' | 'ceiling' | 'facade' | 'column' | 'pipe-length' | ''>('');
  const [activeService, setActiveService] = useState<'facade' | 'formwork' | 'ceiling-beam-yonolit' | 'ceiling-beam-ceramic' | 'ceiling-slab' | 'column' | 'pipe-length' | ''>('');
  const [ceilingSubType, setCeilingSubType] = useState<'ceiling-beam-yonolit' | 'ceiling-beam-ceramic' | 'ceiling-slab' | ''>('');
  const address = prefilledAddress || navState?.locationAddress || routeProjectMeta?.address || '';
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

  // حداقل ابعاد قابل محاسبه: اعداد کمتر از 3 متر در پشت پرده 3 متر در نظر گرفته می‌شوند
  const MIN_DIMENSION = 3;
  const clampMinDim = (v: string | number | undefined | null): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    if (isNaN(n) || n <= 0) return 0;
    return Math.max(MIN_DIMENSION, n);
  };
  // ابعاد مؤثر برای محاسبه قیمت و ذخیره‌سازی (ورودی کاربر دست‌نخورده می‌ماند)
  const effectiveDimensions = dimensions.map(d => ({
    length: clampMinDim(d.length),
    width: parseFloat(d.width) || 0,
    height: clampMinDim(d.height),
  }));
  const effectiveColumnHeight = clampMinDim(columnHeight);

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
  const { districts } = useDistricts(selectedProvinceId || '');

  // تبدیل فاصله از مرکز استان به بازه مناسب
  const getDistanceRangeFromKm = (distanceKm: number | undefined): '0-15' | '15-25' | '25-50' | '50-85' => {
    if (!distanceKm) return '0-15';
    if (distanceKm <= 15) return '0-15';
    if (distanceKm <= 25) return '15-25';
    if (distanceKm <= 50) return '25-50';
    return '50-85';
  };

  // دریافت فاصله از state ناوبری
  const distanceFromCenter = navState?.distanceFromCenter;
  const initialDistanceRange = getDistanceRangeFromKm(distanceFromCenter);
  
  console.log('📍 ComprehensiveScaffoldingForm - distanceFromCenter:', distanceFromCenter, 'initialDistanceRange:', initialDistanceRange, 'navState:', navState);

  // تنظیمات قیمت‌گذاری از ماژول CEO (با fallback به مقادیر پیش‌فرض)
  // برای «اجرای بدون اجناس» (کد 20) از جدول قیمت‌گذاری مستقل استفاده می‌کنیم
  const { get: pricingGetWithMaterials } = useScaffoldingPricing();
  const { get: pricingGetNoMaterials } = useScaffoldingNoMaterialsPricing();
  const isNoMaterialsSubcategory = propSubcategoryCode === '20';
  const pricingGet = isNoMaterialsSubcategory ? pricingGetNoMaterials : pricingGetWithMaterials;


  const [conditions, setConditions] = useState<ServiceConditions>({
    totalMonths: 1,
    currentMonth: 1,
    distanceRange: initialDistanceRange,
    platformHeight: null,
    scaffoldHeightFromPlatform: null,
    vehicleDistance: null,
    rentalMonthsPlan: '1',
  });
  
  // به‌روزرسانی distanceRange اگر distanceFromCenter تغییر کرد
  useEffect(() => {
    if (distanceFromCenter !== undefined && distanceFromCenter !== null) {
      const newRange = getDistanceRangeFromKm(distanceFromCenter);
      console.log('📍 Updating distanceRange to:', newRange, 'from distanceFromCenter:', distanceFromCenter);
      setConditions(prev => ({ ...prev, distanceRange: newRange }));
    }
  }, [distanceFromCenter]);

  const [onGround, setOnGround] = useState(true);
  const [vehicleReachesSite, setVehicleReachesSite] = useState(true);
  const [ceilingTieredOpen, setCeilingTieredOpen] = useState(false);
  const [ceilingSlabOpen, setCeilingSlabOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [locationPurpose, setLocationPurpose] = useState('');
  const [installationDateTime, setInstallationDateTime] = useState<string>('');
  
  // State برای ثبت سفارش برای دیگری
  const [recipientData, setRecipientData] = useState<RecipientData | null>(null);
  
  // State برای override قیمت توسط مدیر
  const [manualPriceOverride, setManualPriceOverride] = useState<string>('');
  const [useManualPrice, setUseManualPrice] = useState(false);

  // State برای حالت چند داربست همزمان در یک مکان
  const [multiOrderMode, setMultiOrderMode] = useState(false);
  type SavedScaffold = {
    id: string;
    label: string;
    snapshot: {
      scaffoldType: string;
      activeService: string;
      ceilingSubType: string;
      dimensions: any[];
      isFacadeWidth2m: boolean;
      columnHeight: string;
      onGround: boolean;
      vehicleReachesSite: boolean;
      conditions: any;
      locationPurpose?: string;
    };
    fullPrice: number; // قیمت با درصد فاصله
    baseNoDistance: number; // قیمت بدون درصد فاصله (برای محاسبه حمل مشترک)
    breakdown: string[];
    totalArea: number;
  };
  const [savedScaffolds, setSavedScaffolds] = useState<SavedScaffold[]>([]);
  // داربستی که در حال ویرایش مجدد است (از لیست خارج شده و در فرم بارگذاری شده)
  const [editingScaffold, setEditingScaffold] = useState<{ id: string; index: number } | null>(null);
  
  // دریافت isManagerEdit از query param نیز
  const isManagerEditMode = isManagerEdit || searchParams.get('managerEdit') === 'true';

  useEffect(() => {
    if (!hierarchyProjectId || (propLocationId && propServiceTypeId && propSubcategoryId)) return;

    const fetchProjectMeta = async () => {
      const { data, error } = await supabase
        .from('projects_hierarchy')
        .select(`
          location_id,
          service_type_id,
          subcategory_id,
          locations (
            address_line,
            province_id,
            district_id
          )
        `)
        .eq('id', hierarchyProjectId)
        .maybeSingle();

      if (error || !data) return;
      const loc = (data as any).locations;
      setRouteProjectMeta({
        locationId: data.location_id || undefined,
        serviceTypeId: data.service_type_id || undefined,
        subcategoryId: data.subcategory_id || undefined,
        provinceId: loc?.province_id || null,
        districtId: loc?.district_id || null,
        address: loc?.address_line || undefined,
      });
    };

    fetchProjectMeta();
  }, [hierarchyProjectId, propLocationId, propServiceTypeId, propSubcategoryId]);

  useEffect(() => {
    if (initialLocationId) setSelectedLocationId(initialLocationId);
    if (initialProvinceId) setSelectedProvinceId(initialProvinceId);
    if (initialDistrictId) setSelectedDistrictId(initialDistrictId);
    if (address) setDetailedAddress(address);
  }, [initialLocationId, initialProvinceId, initialDistrictId, address]);

  // Fetch order data if editing from query parameter
  useEffect(() => {
    if (editOrderId && !existingOrderData) {
      fetchOrderData();
    }
  }, [editOrderId]);

  // بازیابی مقادیر فرم پس از بازگشت کاربر مهمان از صفحه ورود/ثبت‌نام
  useEffect(() => {
    if (editOrderId || existingOrderData) return;
    const pending = getPendingOrder();
    if (pending?.formKey !== 'scaffolding' || !pending.values) return;
    const v = pending.values;
    try {
      if (v.scaffoldType !== undefined) setScaffoldType(v.scaffoldType);
      if (v.activeService !== undefined) setActiveService(v.activeService);
      if (v.ceilingSubType !== undefined) setCeilingSubType(v.ceilingSubType);
      if (Array.isArray(v.dimensions) && v.dimensions.length > 0) setDimensions(v.dimensions);
      if (v.isFacadeWidth2m !== undefined) setIsFacadeWidth2m(v.isFacadeWidth2m);
      if (v.columnHeight !== undefined) setColumnHeight(v.columnHeight);
      if (v.detailedAddress !== undefined) setDetailedAddress(v.detailedAddress);
      if (v.conditions !== undefined) setConditions(v.conditions);
      if (v.onGround !== undefined) setOnGround(v.onGround);
      if (v.vehicleReachesSite !== undefined) setVehicleReachesSite(v.vehicleReachesSite);
      if (v.locationPurpose !== undefined) setLocationPurpose(v.locationPurpose);
      if (v.installationDateTime !== undefined) setInstallationDateTime(v.installationDateTime);
      if (v.recipientData !== undefined) setRecipientData(v.recipientData);
      clearPendingOrder();
      toast({
        title: 'مقادیر فرم بازیابی شد',
        description: 'اطلاعاتی که قبلاً وارد کرده بودید بازگردانده شد. می‌توانید سفارش را ثبت کنید.',
      });
    } catch (err) {
      console.error('Failed to restore pending form values', err);
      clearPendingOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

            // بازیابی حالت چند داربست همزمان در یک مکان
            if (Array.isArray(notes.multi_scaffolds) && notes.multi_scaffolds.length > 0) {
              setMultiOrderMode(true);
              setSavedScaffolds(notes.multi_scaffolds.map((m: any, idx: number) => ({
                id: `restored-${idx + 1}-${Date.now()}`,
                label: m.label || `داربست #${idx + 1}`,
                snapshot: m.snapshot || {
                  scaffoldType: '', activeService: '', ceilingSubType: '',
                  dimensions: [], isFacadeWidth2m: false, columnHeight: '',
                  onGround: true, vehicleReachesSite: true, conditions: {},
                },
                fullPrice: Number(m.finalPrice || 0),
                baseNoDistance: Number(m.baseNoDistance || 0),
                breakdown: [],
                totalArea: Number(m.totalArea || 0),
              })));
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
        
        // Set existing price for manager override
        if (data.payment_amount) {
          setManualPriceOverride(data.payment_amount.toString());
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

          // بازیابی حالت چند داربست همزمان در یک مکان
          if (Array.isArray(notes.multi_scaffolds) && notes.multi_scaffolds.length > 0) {
            setMultiOrderMode(true);
            setSavedScaffolds(notes.multi_scaffolds.map((m: any, idx: number) => ({
              id: `restored-${idx + 1}-${Date.now()}`,
              label: m.label || `داربست #${idx + 1}`,
              snapshot: m.snapshot || {
                scaffoldType: '', activeService: '', ceilingSubType: '',
                dimensions: [], isFacadeWidth2m: false, columnHeight: '',
                onGround: true, vehicleReachesSite: true, conditions: {},
              },
              fullPrice: Number(m.finalPrice || 0),
              baseNoDistance: Number(m.baseNoDistance || 0),
              breakdown: [],
              totalArea: Number(m.totalArea || 0),
            })));
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
    return effectiveDimensions.reduce((total, dim) => {
      return total + (dim.length * dim.width * dim.height);
    }, 0);
  };


  // ====== رتبه همکاری و درصد تخفیف کاربر فعلی ======
  const { discountPercent: cooperationDiscountPct, rank: cooperationRank } = useCooperationDiscount();
  /** اعمال تخفیف رتبه همکاری + گرد کردن به نزدیک‌ترین ۱۰۰۰ تومان */
  const finalizePrice = (n: number) => applyDiscountAndRound(n, cooperationDiscountPct);

  const calculatePrice = (skipDistanceSurcharge: boolean = false): { total: number; pricePerMeter: number | null; breakdown: string[] } => {
    const area = calculateTotalArea();
    let basePrice = 0;
    let pricePerMeter: number | null = null;
    const breakdown: string[] = [];

    // ====== مقادیر قابل تنظیم از ماژول CEO (با fallback به اعداد فعلی) ======
    const P = pricingGet;
    const pct = (key: string, fb: number) => P(key, fb) / 100; // درصد به ضریب اضافه

    // محاسبه قیمت برای داربست به طول لوله مصرفی
    if (isPipeLengthScaffolding) {
      const pipeLength = parseFloat(dimensions[0]?.length || '0');

      if (pipeLength <= 100) {
        basePrice = P('pipe_fixed_under_100m', 3200000);
        breakdown.push(`طول لوله: ${pipeLength} متر (زیر 100 متر)`);
        breakdown.push(`قیمت ثابت: ${basePrice.toLocaleString('fa-IR')} تومان`);
      } else if (pipeLength <= 200) {
        basePrice = P('pipe_fixed_100_to_200m', 4200000);
        breakdown.push(`طول لوله: ${pipeLength} متر (100-200 متر)`);
        breakdown.push(`قیمت ثابت: ${basePrice.toLocaleString('fa-IR')} تومان`);
      } else {
        pricePerMeter = P('pipe_per_meter_over_200', 30000);
        basePrice = pipeLength * pricePerMeter;
        breakdown.push(`طول لوله: ${pipeLength} متر (بیش از 200 متر)`);
        breakdown.push(`فی هر متر لوله: ${pricePerMeter.toLocaleString('fa-IR')} تومان`);
        breakdown.push(`قیمت کل: ${pipeLength} × ${pricePerMeter.toLocaleString('fa-IR')} = ${basePrice.toLocaleString('fa-IR')} تومان`);
      }

      return { total: finalizePrice(basePrice), pricePerMeter, breakdown };
    }

    // محاسبه قیمت برای داربست ستونی
    if (isColumnScaffolding) {
      const getLengthUnits = (dimension: number): number => {
        if (dimension <= 0) return 0;
        return Math.ceil(dimension / 3);
      };
      const getWidthUnits = (dimension: number): number => {
        if (dimension >= 0.20 && dimension <= 3.5) return 1;
        if (dimension > 3.5 && dimension <= 7) return 2;
        if (dimension > 7 && dimension <= 10.5) return 3;
        return 0;
      };

      const length = effectiveDimensions[0]?.length || 0;
      const width = effectiveDimensions[0]?.width || 0;
      const height = effectiveColumnHeight;
      const floors = Math.ceil(height / 3.5);

      const lengthUnits = getLengthUnits(length);
      const widthUnits = getWidthUnits(width);
      const floorUnits = floors;
      const totalUnits = lengthUnits * widthUnits * floorUnits;
      const pricePerUnit = P('column_price_per_unit', 1000000);

      basePrice = totalUnits * pricePerUnit;

      breakdown.push(`طول: ${length} متر → ${lengthUnits} واحد`);
      breakdown.push(`عرض: ${width} متر → ${widthUnits} واحد`);
      breakdown.push(`ارتفاع: ${height} متر → ${floors} طبقه (${floorUnits} واحد)`);
      breakdown.push(`مجموع واحدها: ${lengthUnits} × ${widthUnits} × ${floorUnits} = ${totalUnits} واحد`);
      breakdown.push(`قیمت هر واحد: ${pricePerUnit.toLocaleString('fa-IR')} تومان`);
      breakdown.push(`قیمت کل: ${basePrice.toLocaleString('fa-IR')} تومان`);

      return { total: finalizePrice(basePrice), pricePerMeter: null, breakdown };
    }

    // محاسبه ضریب شرایط سرویس
    const getConditionsMultiplier = (): { multiplier: number; conditionBreakdown: string[]; distancePct: number; distanceMin: number; distanceLabel: string | null } => {
      let percentSum = 0; // جمع جبری درصدها (افزایش از قیمت پایه، نه تجمیعی)
      const conditionBreakdown: string[] = [];
      let distancePct = 0;
      let distanceMin = 0;
      let distanceLabel: string | null = null;

      if (!skipDistanceSurcharge) {
        if (conditions.distanceRange === '15-25') {
          const p = P('distance_15_to_25_pct', 20);
          percentSum += p;
          distancePct = p;
          distanceMin = P('distance_15_to_25_min', 0);
          distanceLabel = 'فاصله 15-25 کیلومتر';
        } else if (conditions.distanceRange === '25-50') {
          const p = P('distance_25_to_50_pct', 40);
          percentSum += p;
          distancePct = p;
          distanceMin = P('distance_25_to_50_min', 0);
          distanceLabel = 'فاصله 25-50 کیلومتر';
        } else if (conditions.distanceRange === '50-85') {
          const p = P('distance_50_to_85_pct', 70);
          percentSum += p;
          distancePct = p;
          distanceMin = P('distance_50_to_85_min', 0);
          distanceLabel = 'فاصله 50-85 کیلومتر';
        }
      }

      if (!onGround && conditions.platformHeight) {
        if (conditions.platformHeight <= 3) {
          const p = P('platform_height_under_3_pct', 20);
          percentSum += p;
          conditionBreakdown.push(`ارتفاع پای کار تا 3 متر: +${p}%`);
        } else if (conditions.platformHeight <= 6) {
          const p = P('platform_height_3_to_6_pct', 40);
          percentSum += p;
          conditionBreakdown.push(`ارتفاع پای کار 3-6 متر: +${p}%`);
        } else {
          const p = P('platform_height_over_6_pct', 60);
          percentSum += p;
          conditionBreakdown.push(`ارتفاع پای کار بیش از 6 متر: +${p}%`);
        }
      }

      if (!onGround && conditions.scaffoldHeightFromPlatform) {
        if (conditions.scaffoldHeightFromPlatform > 15) {
          const p = P('scaffold_height_over_15_pct', 20);
          percentSum += p;
          conditionBreakdown.push(`ارتفاع داربست بیش از 15 متر: +${p}%`);
        }
      }

      if (!vehicleReachesSite && conditions.vehicleDistance) {
        if (conditions.vehicleDistance <= 50) {
          const p = P('vehicle_distance_under_50_pct', 10);
          percentSum += p;
          conditionBreakdown.push(`فاصله خودرو تا 50 متر: +${p}%`);
        } else if (conditions.vehicleDistance <= 100) {
          const p = P('vehicle_distance_50_to_100_pct', 15);
          percentSum += p;
          conditionBreakdown.push(`فاصله خودرو 50-100 متر: +${p}%`);
        } else {
          const p = P('vehicle_distance_over_100_pct', 25);
          percentSum += p;
          conditionBreakdown.push(`فاصله خودرو بیش از 100 متر: +${p}%`);
        }
      }

      const multiplier = 1 + percentSum / 100;
      return { multiplier, conditionBreakdown, distancePct, distanceMin, distanceLabel };
    };

    // اعمال حداقل افزایش قیمت فاصله: اگر سهم درصدی فاصله از قیمت پایه کمتر از حداقل تنظیم‌شده باشد، مابه‌التفاوت اضافه می‌شود
    const applyDistanceMinimum = (basePreConditions: number, distancePct: number, distanceMin: number): { topUp: number; minApplied: boolean } => {
      if (!distanceMin || distancePct <= 0 || basePreConditions <= 0) return { topUp: 0, minApplied: false };
      const distanceSurcharge = (basePreConditions * distancePct) / 100;
      if (distanceSurcharge >= distanceMin) return { topUp: 0, minApplied: false };
      const topUp = roundToThousand(distanceMin - distanceSurcharge);
      return { topUp, minApplied: true };
    };

    // ساخت خط نمایش فاصله: اگر حداقل اعمال شده باشد به‌جای درصد، مبلغ حداقل اعمال‌شده نمایش داده می‌شود
    const buildDistanceLine = (distanceLabel: string | null, distancePct: number, distanceMin: number, minApplied: boolean): string | null => {
      if (!distanceLabel || distancePct <= 0) return null;
      if (minApplied) {
        return `${distanceLabel}: حداقل افزایش قیمت ${distanceMin.toLocaleString('fa-IR')} تومان اعمال شد`;
      }
      return `${distanceLabel}: +${distancePct}%`;
    };




    let conditionsAppliedToUnitPrice = false;
    // فی مؤثر ماهانه هر متر (پس از اعمال ضرایب/حداقل‌ها/تخفیف‌ها) برای نمایش شفاف به کارفرما
    let effectiveMonthlyUnitFee: number | null = null;

    if (activeService === 'facade') {
      if (area <= 50) {
        basePrice = P('facade_fixed_under_50', 3200000);
      } else if (area <= 100) {
        basePrice = P('facade_fixed_50_to_100', 4200000);
      } else {
        const basePricePerMeter = P('facade_per_meter_over_100', 45000);
        const { multiplier, conditionBreakdown, distancePct, distanceMin, distanceLabel } = getConditionsMultiplier();
        pricePerMeter = Math.round(basePricePerMeter * multiplier);
        basePrice = area * pricePerMeter;
        conditionsAppliedToUnitPrice = true;

        const { topUp, minApplied } = applyDistanceMinimum(area * basePricePerMeter, distancePct, distanceMin);

        if (multiplier > 1) {
          breakdown.push(`فی پایه: ${basePricePerMeter.toLocaleString('fa-IR')} تومان`);
          const distLine = buildDistanceLine(distanceLabel, distancePct, distanceMin, minApplied);
          if (distLine) breakdown.push(distLine);
          conditionBreakdown.forEach(cb => breakdown.push(cb));
          breakdown.push(`فی نهایی: ${pricePerMeter.toLocaleString('fa-IR')} تومان`);
        }

        if (topUp > 0) { basePrice += topUp; }
        if (pricePerMeter !== null && area > 0) {
          effectiveMonthlyUnitFee = Math.round(basePrice / area);
        }
      }

    } else if (activeService === 'formwork') {
      if (area <= 100) {
        basePrice = P('formwork_fixed_under_100', 3200000);
      } else if (area <= 200) {
      } else {
        const basePricePerMeter = P('formwork_per_meter_over_200', 20000);
        const { multiplier, conditionBreakdown, distancePct, distanceMin, distanceLabel } = getConditionsMultiplier();
        pricePerMeter = Math.round(basePricePerMeter * multiplier);
        basePrice = area * pricePerMeter;
        conditionsAppliedToUnitPrice = true;

        const { topUp, minApplied } = applyDistanceMinimum(area * basePricePerMeter, distancePct, distanceMin);

        if (multiplier > 1) {
          breakdown.push(`فی پایه: ${basePricePerMeter.toLocaleString('fa-IR')} تومان`);
          const distLine = buildDistanceLine(distanceLabel, distancePct, distanceMin, minApplied);
          if (distLine) breakdown.push(distLine);
          conditionBreakdown.forEach(cb => breakdown.push(cb));
          breakdown.push(`فی نهایی: ${pricePerMeter.toLocaleString('fa-IR')} تومان`);
        }

        if (topUp > 0) { basePrice += topUp; }
        if (pricePerMeter !== null && area > 0) {
          effectiveMonthlyUnitFee = Math.round(basePrice / area);
        }
      }

    } else if (activeService === 'ceiling-beam-yonolit' || activeService === 'ceiling-beam-ceramic') {
      if (area <= 100) {
        basePrice = P('ceiling_beam_fixed_under_100', 7500000);
      } else if (area <= 200) {
      } else {
        const basePricePerMeter = P('ceiling_beam_per_meter_over_200', 45000);
        const { multiplier, conditionBreakdown, distancePct, distanceMin, distanceLabel } = getConditionsMultiplier();
        pricePerMeter = Math.round(basePricePerMeter * multiplier);
        basePrice = area * pricePerMeter;
        conditionsAppliedToUnitPrice = true;

        const { topUp, minApplied } = applyDistanceMinimum(area * basePricePerMeter, distancePct, distanceMin);

        if (multiplier > 1) {
          breakdown.push(`فی پایه: ${basePricePerMeter.toLocaleString('fa-IR')} تومان`);
          const distLine = buildDistanceLine(distanceLabel, distancePct, distanceMin, minApplied);
          if (distLine) breakdown.push(distLine);
          conditionBreakdown.forEach(cb => breakdown.push(cb));
          breakdown.push(`فی نهایی: ${pricePerMeter.toLocaleString('fa-IR')} تومان`);
        }

        if (topUp > 0) { basePrice += topUp; }
        if (pricePerMeter !== null && area > 0) {
          effectiveMonthlyUnitFee = Math.round(basePrice / area);
        }
      }

    } else if (activeService === 'ceiling-slab') {
      if (area <= 100) {
        basePrice = P('ceiling_slab_fixed_under_100', 8000000);
      } else if (area <= 200) {
      } else {
        const basePricePerMeter = P('ceiling_slab_per_meter_over_200', 70000);
        const { multiplier, conditionBreakdown, distancePct, distanceMin, distanceLabel } = getConditionsMultiplier();
        pricePerMeter = Math.round(basePricePerMeter * multiplier);
        basePrice = area * pricePerMeter;
        conditionsAppliedToUnitPrice = true;

        const { topUp, minApplied } = applyDistanceMinimum(area * basePricePerMeter, distancePct, distanceMin);

        if (multiplier > 1) {
          breakdown.push(`فی پایه: ${basePricePerMeter.toLocaleString('fa-IR')} تومان`);
          const distLine = buildDistanceLine(distanceLabel, distancePct, distanceMin, minApplied);
          if (distLine) breakdown.push(distLine);
          conditionBreakdown.forEach(cb => breakdown.push(cb));
          breakdown.push(`فی نهایی: ${pricePerMeter.toLocaleString('fa-IR')} تومان`);
        }

        if (topUp > 0) { basePrice += topUp; }
        if (pricePerMeter !== null && area > 0) {
          effectiveMonthlyUnitFee = Math.round(basePrice / area);
        }
      }

    }

    breakdown.push(`قیمت ماه اول: ${basePrice.toLocaleString('fa-IR')} تومان`);

    if (conditions.currentMonth === 1 && !conditionsAppliedToUnitPrice) {
      const basePreConditions = basePrice;
      const { multiplier, conditionBreakdown, distancePct, distanceMin, distanceLabel } = getConditionsMultiplier();
      const { topUp, minApplied } = applyDistanceMinimum(basePreConditions, distancePct, distanceMin);
      if (multiplier > 1) {
        const distLine = buildDistanceLine(distanceLabel, distancePct, distanceMin, minApplied);
        if (distLine) breakdown.push(distLine);
        conditionBreakdown.forEach(cb => breakdown.push(cb));
        basePrice *= multiplier;
      }
      if (topUp > 0) { basePrice += topUp; }
    }


    // تخفیف اجاره چند ماهه برای داربست سطحی نما
    if (isFacadeScaffolding && conditions.rentalMonthsPlan) {
      const monthsPlan = parseInt(conditions.rentalMonthsPlan.replace('+', ''));
      let discount = 0;

      if (conditions.rentalMonthsPlan === '2') {
        const p = P('rental_discount_2_months_pct', 10);
        discount = p / 100;
        breakdown.push(`تخفیف اجاره 2 ماهه: -${p}% در هر ماه`);
      } else if (conditions.rentalMonthsPlan === '3+') {
        const p = P('rental_discount_3plus_months_pct', 15);
        discount = p / 100;
        breakdown.push(`تخفیف اجاره 3 ماهه: -${p}% در هر ماه`);
      }

      if (discount > 0) {
        const discountedMonthlyPrice = basePrice * (1 - discount);
        const totalWithDiscount = discountedMonthlyPrice * monthsPlan;
        if (effectiveMonthlyUnitFee !== null) {
          effectiveMonthlyUnitFee = Math.round(effectiveMonthlyUnitFee * (1 - discount));
          breakdown.push(`فی هر متر پس از تخفیف اجاره: ${effectiveMonthlyUnitFee.toLocaleString('fa-IR')} تومان`);
        }
        breakdown.push(`قیمت هر ماه با تخفیف: ${Math.round(discountedMonthlyPrice).toLocaleString('fa-IR')} تومان`);
        breakdown.push(`مجموع ${monthsPlan} ماه: ${Math.round(totalWithDiscount).toLocaleString('fa-IR')} تومان`);
        basePrice = totalWithDiscount;
      } else {
        breakdown.push(`مجموع 1 ماه: ${Math.round(basePrice).toLocaleString('fa-IR')} تومان`);
      }
    } else if (conditions.totalMonths > 1) {
      const additionalMonths = conditions.totalMonths - 1;
      const extraFactor = P('extra_month_factor_pct', 70) / 100;
      const additionalCost = basePrice * extraFactor * additionalMonths;
      breakdown.push(`ماه‌های اضافی (${additionalMonths} ماه): ${additionalCost.toLocaleString('fa-IR')} تومان`);
      basePrice += additionalCost;
    }

    // فی نهایی هر متر (شامل ضرایب فاصله/ارتفاع/تخفیف اجاره و تخفیف رتبه همکاری)
    if (effectiveMonthlyUnitFee !== null && effectiveMonthlyUnitFee > 0) {
      pricePerMeter = Math.round(effectiveMonthlyUnitFee * (1 - (cooperationDiscountPct || 0) / 100));
      breakdown.unshift('— ادامه روند محاسبه قیمت —');
      breakdown.unshift(`✅ فی نهایی هر متر برای این داربست: ${pricePerMeter.toLocaleString('fa-IR')} تومان (ماهانه)`);
    }

    return { total: finalizePrice(basePrice), pricePerMeter, breakdown };
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
      // Enforce upload size limit for videos (matches customer order page)
      const isVideo =
        file.type?.startsWith('video/') ||
        /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
      const MAX_VIDEO_SIZE_MB = 70;
      const MAX_VIDEO_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        toast({
          title: 'حجم ویدیو زیاد است',
          description: `حداکثر حجم هر ویدیو ${MAX_VIDEO_SIZE_MB}MB است. لطفاً ${file.name} را کوچکتر کنید.`,
          variant: 'destructive'
        });
        return false;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      // Upload to storage (bucket: project-media)
      const { error: uploadError } = await supabase.storage
        .from('project-media')
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
            .from('project-media')
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
      // ذخیره مقادیر فعلی فرم تا پس از ورود/ثبت‌نام دوباره نمایش داده شوند
      savePendingOrder({
        path: '/scaffolding/form',
        state: navState,
        formKey: 'scaffolding',
        values: {
          scaffoldType,
          activeService,
          ceilingSubType,
          dimensions,
          isFacadeWidth2m,
          columnHeight,
          detailedAddress,
          conditions,
          onGround,
          vehicleReachesSite,
          locationPurpose,
          installationDateTime,
          recipientData,
        },
        ts: Date.now(),
      });
      toast({
        title: 'برای ثبت نهایی سفارش وارد شوید',
        description: 'پس از ورود/ثبت‌نام به همین فرم برمی‌گردید و مقادیر شما حفظ می‌شود.',
      });
      navigate('/auth/login', {
        state: { from: { pathname: '/scaffolding/form' } },
      });
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

    // در حالت چند داربست همزمان، اگر حداقل یک داربست در لیست ذخیره شده باشد،
    // اعتبارسنجی ابعاد روی فرم جاری انجام نمی‌شود (هر داربست لیست‌شده قبلاً اعتبارسنجی شده).
    const isMultiSubmit = multiOrderMode && savedScaffolds.length > 0;

    if (!isMultiSubmit) {
      // فقط چک کردن ابعاد به‌عنوان فیلد ضروری
      if (isPipeLengthScaffolding) {
        // این نوع داربست فقط یک فیلد دارد: طول مجموع لوله مصرفی
        const pipeLen = parseFloat(dimensions[0]?.length || '0');
        if (!dimensions[0]?.length || isNaN(pipeLen) || pipeLen <= 0) {
          toast({ title: 'خطا', description: 'لطفاً طول مجموع لوله مصرفی را وارد کنید', variant: 'destructive' });
          return;
        }
      } else if (isColumnScaffolding) {
        if (!dimensions[0]?.length || !dimensions[0]?.width || !columnHeight) {
          toast({ title: 'خطا', description: 'لطفاً تمام ابعاد را وارد کنید', variant: 'destructive' });
          return;
        }
      } else if (dimensions.some(d => !d.length || !d.width || !d.height)) {
        toast({ title: 'خطا', description: 'لطفاً تمام ابعاد را وارد کنید', variant: 'destructive' });
        return;
      }

      // Validate using Zod schema - با ابعاد مؤثر (کمتر از 3 متر در پشت پرده 3 متر محاسبه می‌شود)
      if (!isPipeLengthScaffolding) {
        try {
          scaffoldingFormSchema.parse({
            detailedAddress: finalAddress.trim(),
            dimensions: isColumnScaffolding
              ? [{
                  length: effectiveDimensions[0]?.length || 0,
                  width: effectiveDimensions[0]?.width || 0,
                  height: effectiveColumnHeight,
                }]
              : effectiveDimensions.map(d => ({
                  length: d.length,
                  width: d.width,
                  height: d.height
                }))
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            toast({ title: 'خطای اعتبارسنجی', description: error.errors[0].message, variant: 'destructive' });
            return;
          }
        }
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

      // اگر هنوز مشخص نشد، بر اساس نام‌ها یا کد زیرشاخه تلاش کن - به صورت موازی
      if (!finalServiceTypeId || !finalSubcategoryId) {
        const subCode = navState?.subcategoryCode || pendingSel?.subcategoryCode;
        
        // اجرای کوئری‌ها به صورت موازی برای سرعت بیشتر
        const [serviceTypeResult, subcategoryByCodeResult] = await Promise.all([
          // تلاش بر اساس نام نوع خدمت
          (!finalServiceTypeId && navState?.serviceName) 
            ? supabase.from('service_types_v3').select('id').ilike('name', navState.serviceName).maybeSingle()
            : Promise.resolve({ data: null }),
          // تلاش بر اساس کد زیرشاخه
          subCode 
            ? supabase.from('subcategories').select('id, service_type_id').eq('code', subCode).maybeSingle()
            : Promise.resolve({ data: null })
        ]);

        if (serviceTypeResult?.data) {
          finalServiceTypeId = serviceTypeResult.data.id;
        }
        
        if (subcategoryByCodeResult?.data) {
          finalServiceTypeId = finalServiceTypeId || subcategoryByCodeResult.data.service_type_id;
          finalSubcategoryId = subcategoryByCodeResult.data.id;
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
                province_id: selectedProvinceId || null,
                district_id: selectedDistrictId || null,
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

      // محاسبه قیمت نهایی - اگر مدیر override کرده باشد، از آن استفاده کن
      // در حالت چند داربست، از مجموع تجمیعی استفاده می‌کنیم
      const multiSummary = (multiOrderMode && (savedScaffolds.length > 0 || canAddCurrentScaffold()))
        ? computeMultiSummary()
        : null;
      const effectivePriceTotal = multiSummary ? multiSummary.grandTotal : priceData.total;
      const effectivePriceBreakdown: string[] = multiSummary
        ? [
            `🏗️ چند داربست همزمان در یک مکان (${multiSummary.count} داربست)`,
            ...multiSummary.items.map((it, i) => `${it.label}: اجرا ${it.baseNoDistance.toLocaleString('fa-IR')} + سهم حمل ${it.transportShare.toLocaleString('fa-IR')} = ${it.finalPrice.toLocaleString('fa-IR')} تومان`),
            `جمع قیمت اجرا (بدون حمل): ${multiSummary.baseSum.toLocaleString('fa-IR')} تومان`,
            `هزینه حمل و نقل مشترک (${multiSummary.distancePct}%): ${multiSummary.sharedTransport.toLocaleString('fa-IR')} تومان`,
            `سهم حمل هر داربست: ${multiSummary.transportShare.toLocaleString('fa-IR')} تومان`,
            `مجموع نهایی: ${multiSummary.grandTotal.toLocaleString('fa-IR')} تومان`,
          ]
        : priceData.breakdown;
      const finalPrice = (isManagerEditMode && useManualPrice && manualPriceOverride) 
        ? parseFloat(manualPriceOverride) 
        : effectivePriceTotal;

      // Check if editing or creating new order
      if (editOrderId) {
        // Update existing order
        const { error: updateError } = await supabase
          .from('projects_v3')
          .update({
            address: sanitizedAddress,
            detailed_address: sanitizedAddress,
            payment_amount: finalPrice, // استفاده از قیمت نهایی (override یا محاسبه شده)
            notes: {
              service_type: activeService,
              dimensions: (isPipeLengthScaffolding
                ? dimensions.map(d => ({ length: parseFloat(d.length), width: parseFloat(d.width), height: parseFloat(d.height) }))
                : effectiveDimensions.map(d => ({ length: d.length, width: d.width, height: d.height }))),
              columnHeight: isColumnScaffolding ? effectiveColumnHeight : undefined,
              column_units: isColumnScaffolding ? (() => {
                const getUnits = (dimension: number): number => {
                  if (dimension >= 0.20 && dimension <= 3.5) return 1;
                  if (dimension > 3.5 && dimension <= 7) return 2;
                  if (dimension > 7 && dimension <= 10.5) return 3;
                  return 0;
                };
                const length = effectiveDimensions[0]?.length || 0;
                const width = effectiveDimensions[0]?.width || 0;
                const height = effectiveColumnHeight;
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
              estimated_price: effectivePriceTotal,
              manual_price_override: (isManagerEditMode && useManualPrice) ? parseFloat(manualPriceOverride) : undefined,
              price_breakdown: effectivePriceBreakdown,
              multi_scaffolds: multiSummary ? multiSummary.items.map(it => ({
                label: it.label,
                totalArea: it.totalArea,
                baseNoDistance: it.baseNoDistance,
                transportShare: it.transportShare,
                finalPrice: it.finalPrice,
                snapshot: it.snapshot,
              })) : undefined,
              multi_summary: multiSummary ? {
                count: multiSummary.count,
                distancePct: multiSummary.distancePct,
                sharedTransport: multiSummary.sharedTransport,
                baseSum: multiSummary.baseSum,
                grandTotal: multiSummary.grandTotal,
              } : undefined,
              installationDateTime,
              customerName: orderData?.customer_name || user?.user_metadata?.full_name || '',
              phoneNumber: orderData?.customer_phone || user?.phone || '',
            } as any
          })
          .eq('id', editOrderId);

        if (updateError) throw updateError;

        toast({ 
          title: 'بروزرسانی شد', 
          description: 'سفارش با موفقیت ویرایش شد' 
        });

        // آپلود فایل‌ها در پس‌زمینه (بدون انتظار)
        if (mediaFiles && mediaFiles.length > 0) {
          uploadMediaFiles(editOrderId, mediaFiles).catch(err => {
            console.error('Background upload error:', err);
          });
        }

        const mediaUploadQuery = mediaFiles && mediaFiles.length > 0 ? '?mediaUpload=1' : '';
        navigate(`/user/orders/${editOrderId}${mediaUploadQuery}`);
      } else {
        // ایجاد سفارش جدید به‌صورت اتمیک در دیتابیس با لینک به پروژه سلسله‌مراتبی
        // مطمئن شویم که provinceId و districtId UUID معتبر یا null هستند
        const validProvinceId = selectedProvinceId && selectedProvinceId.trim() !== '' ? selectedProvinceId : null;
        const validDistrictId = selectedDistrictId && selectedDistrictId.trim() !== '' ? selectedDistrictId : null;
        
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
            dimensions: (isPipeLengthScaffolding
              ? dimensions.map(d => ({ length: parseFloat(d.length), width: parseFloat(d.width), height: parseFloat(d.height) }))
              : effectiveDimensions.map(d => ({ length: d.length, width: d.width, height: d.height }))),
            columnHeight: isColumnScaffolding ? effectiveColumnHeight : undefined,
            column_units: isColumnScaffolding ? (() => {
              const getUnits = (dimension: number): number => {
                if (dimension >= 0.20 && dimension <= 3.5) return 1;
                if (dimension > 3.5 && dimension <= 7) return 2;
                if (dimension > 7 && dimension <= 10.5) return 3;
                return 0;
              };
              const length = effectiveDimensions[0]?.length || 0;
              const width = effectiveDimensions[0]?.width || 0;
              const height = effectiveColumnHeight;
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
            estimated_price: effectivePriceTotal,
            price_breakdown: effectivePriceBreakdown,
            multi_scaffolds: multiSummary ? multiSummary.items.map(it => ({
              label: it.label,
              totalArea: it.totalArea,
              baseNoDistance: it.baseNoDistance,
              transportShare: it.transportShare,
              finalPrice: it.finalPrice,
              snapshot: it.snapshot,
            })) : undefined,
            multi_summary: multiSummary ? {
              count: multiSummary.count,
              distancePct: multiSummary.distancePct,
              sharedTransport: multiSummary.sharedTransport,
              baseSum: multiSummary.baseSum,
              grandTotal: multiSummary.grandTotal,
            } : undefined,
            installationDateTime,
            customerName: user?.user_metadata?.full_name || '',
            phoneNumber: user?.phone || '',
          })
        });
        
        const { data: createdRows, error: createError } = await supabase.rpc('create_project_v3', validated as any);

        if (createError) throw createError;
        const createdProject = createdRows?.[0];
        if (!createdProject) throw new Error('خطا در ایجاد سفارش');

        // اگر سفارش برای شخص دیگری ثبت شده باشد، درخواست انتقال ایجاد می‌کنیم
        if (recipientData) {
          try {
            // ابتدا رکورد transfer request ایجاد می‌کنیم
            const { error: transferError } = await supabase
              .from('order_transfer_requests')
              .insert({
                order_id: createdProject.id,
                from_user_id: user!.id,
                to_phone_number: recipientData.phoneNumber,
                to_user_id: recipientData.userId,
                status: recipientData.isRegistered ? 'pending_recipient' : 'pending_registration'
              });

            if (transferError) {
              console.error('Transfer request error:', transferError);
            }

            // اگر کاربر ثبت‌نام کرده، انتقال خودکار بدون نیاز به تایید
            if (recipientData.isRegistered && recipientData.userId) {
              const { error: autoTransferError } = await supabase.rpc('auto_complete_order_transfer' as any, {
                p_order_id: createdProject.id,
                p_recipient_user_id: recipientData.userId,
                p_recipient_phone: recipientData.phoneNumber
              });

              if (autoTransferError) {
                console.error('Auto transfer error:', autoTransferError);
              }

              const senderName = user?.user_metadata?.full_name || 'یک کاربر';
              const serviceTypeName = activeService === 'facade' ? 'داربست نما' :
                                      activeService === 'column' ? 'داربست ستون' :
                                      activeService === 'formwork' ? 'داربست حجمی کفراژ' :
                                      activeService === 'pipe-length' ? 'داربست متراژ' :
                                      activeService.includes('ceiling') ? 'داربست سقف' : 'داربست';
              
              await supabase.rpc('send_notification', {
                _user_id: recipientData.userId,
                _title: '📦 سفارش جدید برای شما ثبت شد',
                _body: `${senderName} یک سفارش ${serviceTypeName} با کد ${createdProject.code} برای شما ثبت کرده است و به حساب شما منتقل شد.`,
                _link: `/user/orders/${createdProject.id}`,
                _type: 'success'
              });

              try {
                await sendPushNotification({
                  user_id: recipientData.userId,
                  title: '📦 سفارش جدید برای شما ثبت شد',
                  body: `${senderName} یک سفارش ${serviceTypeName} با کد ${createdProject.code} برای شما ثبت کرده و منتقل شد.`,
                  link: `/user/orders/${createdProject.id}`
                });
              } catch (pushErr) {
                console.log('Push notification skipped');
              }

              toast({
                title: '✅ سفارش ثبت و منتقل شد',
                description: `سفارش برای ${recipientData.fullName || recipientData.phoneNumber} ثبت و به‌صورت خودکار به حساب ایشان منتقل شد.`,
              });
            } else {
              toast({
                title: 'سفارش ثبت شد',
                description: `سفارش ثبت شد. پس از ثبت‌نام کاربر با شماره ${recipientData.phoneNumber}، سفارش به او منتقل خواهد شد`,
              });
            }
          } catch (transferErr) {
            console.error('Transfer creation error:', transferErr);
          }
        } else {
          toast({ 
            title: 'ثبت شد', 
            description: `سفارش شما با کد ${createdProject.code} ثبت شد و در انتظار تایید است.` 
          });
        }

        // آپلود فایل‌ها در پس‌زمینه (بدون انتظار) - کاربر بلافاصله هدایت می‌شود
        if (mediaFiles && mediaFiles.length > 0) {
          uploadMediaFiles(createdProject.id, mediaFiles).catch(err => {
            console.error('Background upload error:', err);
          });
        }

        // ارسال نوتیفیکیشن به مدیران (در پس‌زمینه)
        const serviceTypeName = activeService === 'facade' ? 'داربست نما' :
                                activeService === 'column' ? 'داربست ستون' :
                                activeService === 'formwork' ? 'داربست حجمی کفراژ' :
                                activeService === 'pipe-length' ? 'داربست متراژ' :
                                activeService.includes('ceiling') ? 'داربست سقف' : 'داربست';
        
        notifyManagers({
          order_code: createdProject.code,
          order_id: createdProject.id,
          customer_name: user?.user_metadata?.full_name || '',
          customer_phone: user?.user_metadata?.phone_number || user?.phone || '',
          customer_user_id: user?.id,
          service_type: serviceTypeName
        }).catch(err => {
          console.error('Notify managers error:', err);
        });

        // ثبت رویداد در لاگ فعالیت‌ها
        reportActivity({
          eventType: 'order_created',
          eventCategory: 'order',
          action: 'create',
          moduleName: 'ثبت سفارش',
          entityTable: 'projects_v3',
          entityId: createdProject.id,
          title: `سفارش جدید ${serviceTypeName} ثبت شد (کد ${createdProject.code})`,
          details: {
            orderCode: createdProject.code,
            serviceType: serviceTypeName,
            address: createdProject.address,
            customerName: user?.user_metadata?.full_name || '',
            customerPhone: user?.user_metadata?.phone_number || user?.phone || '',
          },
        }).catch(() => {});


        // ارسال پیامک به مشتری (در پس‌زمینه)
        const customerPhone = createdProject.customer_phone || user?.user_metadata?.phone_number || user?.phone || '';
        const customerName = createdProject.customer_name || user?.user_metadata?.full_name || 'مشتری';
        const smsAddress = buildOrderSmsAddress(createdProject.address, createdProject.detailed_address);
        
        if (createdProject.code) {
          sendOrderSms(customerPhone, createdProject.code, 'submitted', {
            orderId: createdProject.id,
            address: smsAddress,
            serviceType: serviceTypeName,
            customerName
          }).catch(err => {
            console.error('SMS notification error:', err);
          });
        }

        // ارسال پیامک به مدیرعامل (در پس‌زمینه)
        sendCeoNotificationSms(createdProject.code, 'submitted', {
          orderId: createdProject.id,
          serviceType: serviceTypeName,
          address: smsAddress,
          customerName
        }).catch(err => {
          console.error('CEO SMS notification error:', err);
        });

        // هدایت کاربر به صفحه جزئیات سفارش بلافاصله
        const mediaUploadQuery = mediaFiles && mediaFiles.length > 0 ? '?mediaUpload=1' : '';
        navigate(`/user/orders/${createdProject.id}${mediaUploadQuery}`);
      }
    } catch (e: any) {
      console.error('Error:', e);
      toast({ title: 'خطا', description: e.message || 'ثبت با مشکل مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const priceData = calculatePrice();
  const priceDataNoDistance = calculatePrice(true);

  // درصد فاصله فعلی (برای محاسبه حمل و نقل مشترک)
  const getCurrentDistancePct = (): number => {
    if (conditions.distanceRange === '15-25') return pricingGet('distance_15_to_25_pct', 20);
    if (conditions.distanceRange === '25-50') return pricingGet('distance_25_to_50_pct', 40);
    if (conditions.distanceRange === '50-85') return pricingGet('distance_50_to_85_pct', 70);
    return 0;
  };

  // حداقل افزایش قیمت (تومان) برای بازه فاصله فعلی
  const getCurrentDistanceMin = (): number => {
    if (conditions.distanceRange === '15-25') return pricingGet('distance_15_to_25_min', 0);
    if (conditions.distanceRange === '25-50') return pricingGet('distance_25_to_50_min', 0);
    if (conditions.distanceRange === '50-85') return pricingGet('distance_50_to_85_min', 0);
    return 0;
  };


  // اعتبارسنجی برای افزودن داربست به لیست (مشابه شرط دکمه ثبت)
  const canAddCurrentScaffold = (): boolean => {
    if (!scaffoldType) return false;
    if (getFacadeWarning() || getFormworkWarning()) return false;
    if (isPipeLengthScaffolding) {
      return parseFloat(dimensions[0]?.length || '0') > 0;
    }
    if (isColumnScaffolding) {
      return !!(dimensions[0]?.length && dimensions[0]?.width && columnHeight);
    }
    return !dimensions.some(d => !d.length || !d.width || !d.height);
  };

  const relabel = (list: SavedScaffold[]) => list.map((s, i) => ({ ...s, label: `داربست #${i + 1}` }));

  const resetScaffoldFields = () => {
    setScaffoldType('');
    setActiveService('');
    setCeilingSubType('');
    setDimensions([{ id: '1', length: '', width: '', height: '' }]);
    setIsFacadeWidth2m(false);
    setColumnHeight('');
    setLocationPurpose('');
  };

  const addCurrentScaffoldToList = () => {
    if (!canAddCurrentScaffold()) {
      toast({ variant: 'destructive', title: 'فرم ناقص است', description: 'لطفاً ابعاد و نوع داربست را کامل کنید.' });
      return;
    }
    const isEditing = !!editingScaffold;
    const item: SavedScaffold = {
      id: editingScaffold?.id || `${Date.now()}-${savedScaffolds.length + 1}`,
      label: `داربست #${(editingScaffold?.index ?? savedScaffolds.length) + 1}`,
      snapshot: {
        scaffoldType,
        activeService,
        ceilingSubType,
        dimensions: JSON.parse(JSON.stringify(dimensions)),
        isFacadeWidth2m,
        columnHeight,
        onGround,
        vehicleReachesSite,
        conditions: { ...conditions },
        locationPurpose,
      },
      fullPrice: priceData.total,
      baseNoDistance: priceDataNoDistance.total,
      breakdown: [...priceData.breakdown],
      totalArea: calculateTotalArea(),
    };
    setSavedScaffolds(prev => {
      const next = [...prev];
      if (isEditing) {
        const at = Math.min(editingScaffold!.index, next.length);
        next.splice(at, 0, item);
      } else {
        next.push(item);
      }
      return relabel(next);
    });
    setEditingScaffold(null);
    // ریست فقط فیلدهای مربوط به مشخصات داربست (آدرس/فاصله حفظ می‌شود)
    resetScaffoldFields();
    toast({
      title: isEditing ? `✓ ${item.label} ویرایش شد` : `✓ ${item.label} اضافه شد`,
      description: isEditing ? 'تغییرات این داربست ذخیره شد.' : 'می‌توانید داربست بعدی را وارد کنید.',
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const removeSavedScaffold = (id: string) => {
    setSavedScaffolds(prev => relabel(prev.filter(s => s.id !== id)));
    if (editingScaffold?.id === id) setEditingScaffold(null);
  };

  // بارگذاری یک داربست ذخیره‌شده در فرم برای ویرایش
  const startEditSavedScaffold = (id: string) => {
    const idx = savedScaffolds.findIndex(s => s.id === id);
    if (idx < 0) return;
    if (editingScaffold) {
      toast({ variant: 'destructive', title: 'ویرایش در جریان است', description: 'ابتدا داربست در حال ویرایش را ذخیره یا لغو کنید.' });
      return;
    }
    const sn = savedScaffolds[idx].snapshot as any;
    if (!sn || !sn.scaffoldType) {
      toast({ variant: 'destructive', title: 'قابل ویرایش نیست', description: 'جزئیات فنی این داربست در دسترس نیست.' });
      return;
    }
    setScaffoldType(sn.scaffoldType || '');
    setActiveService(sn.activeService || '');
    setCeilingSubType(sn.ceilingSubType || '');
    setDimensions(Array.isArray(sn.dimensions) && sn.dimensions.length > 0
      ? JSON.parse(JSON.stringify(sn.dimensions))
      : [{ id: '1', length: '', width: '', height: '' }]);
    setIsFacadeWidth2m(!!sn.isFacadeWidth2m);
    setColumnHeight(sn.columnHeight || '');
    if (typeof sn.onGround === 'boolean') setOnGround(sn.onGround);
    if (typeof sn.vehicleReachesSite === 'boolean') setVehicleReachesSite(sn.vehicleReachesSite);
    if (sn.conditions && Object.keys(sn.conditions).length > 0) {
      setConditions((prev: any) => ({ ...prev, ...sn.conditions }));
    }
    setLocationPurpose(sn.locationPurpose || '');
    setSavedScaffolds(prev => prev.filter(s => s.id !== id));
    setEditingScaffold({ id, index: idx });
    toast({ title: 'در حال ویرایش', description: 'مشخصات این داربست در فرم بارگذاری شد. پس از اصلاح، ذخیره کنید.' });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  const cancelEditSavedScaffold = () => {
    setEditingScaffold(null);
    resetScaffoldFields();
  };


  // محاسبه‌ی خلاصه چند داربست (حمل و نقل مشترک، یکبار محاسبه و تقسیم بین داربست‌ها)
  const computeMultiSummary = () => {
    const items: Array<SavedScaffold & { transportShare: number; finalPrice: number }> = [];
    const allItems = [...savedScaffolds];
    // اگر کاربر در حال پر کردن داربست فعلی است، آن را هم در پیش‌نمایش قرار بده
    if (canAddCurrentScaffold()) {
      allItems.push({
        id: 'current',
        label: `داربست #${savedScaffolds.length + 1} (در حال ویرایش)`,
        snapshot: null as any,
        fullPrice: priceData.total,
        baseNoDistance: priceDataNoDistance.total,
        breakdown: priceData.breakdown,
        totalArea: calculateTotalArea(),
      });
    }
    const distancePct = getCurrentDistancePct();
    const distanceMin = getCurrentDistanceMin();
    // حمل و نقل مشترک = (حداکثر قیمت پایه) × درصد فاصله — یکبار برای کل سفر
    // با اعمال حداقل افزایش قیمت برای بازه انتخاب‌شده
    const maxBase = allItems.reduce((mx, s) => Math.max(mx, s.baseNoDistance), 0);
    const pctBased = roundToThousand((maxBase * distancePct) / 100);
    const sharedTransport = Math.max(pctBased, roundToThousand(distanceMin));
    const transportShare = allItems.length > 0 ? roundToThousand(sharedTransport / allItems.length) : 0;

    allItems.forEach(s => {
      items.push({ ...s, transportShare, finalPrice: s.baseNoDistance + transportShare });
    });
    const baseSum = items.reduce((s, i) => s + i.baseNoDistance, 0);
    return {
      items,
      distancePct,
      sharedTransport,
      transportShare,
      baseSum,
      grandTotal: baseSum + sharedTransport,
      count: items.length,
    };
  };


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

      {/* دکمه بازگشت */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-2"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت
      </Button>

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

      {/* کارت یکپارچه: گزینه‌های جانبی سفارش (ثبت برای دیگری، قیمت‌گذاری کارشناس، چند داربست همزمان) */}
      {!editOrderId && (selectedLocationId || initialLocationId) && subcategoryId && selectedProvinceId && (
        <Card className="shadow-xl bg-card/95 backdrop-blur-md border-2 border-primary/30">
          <CardContent className="pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <OrderForOthers
                onRecipientSelected={setRecipientData}
                disabled={loading}
              />
              <ExpertPricingRequestDialog
                subcategoryId={subcategoryId}
                provinceId={selectedProvinceId}
                districtId={selectedDistrictId || undefined}
                address={address || detailedAddress}
                detailedAddress={detailedAddress}
                serviceTypeName="داربست فلزی"
                hierarchyProjectId={hierarchyProjectId || undefined}
                recipientData={recipientData || undefined}
                multiOrderMode={multiOrderMode}
              />

            </div>

            <div className="border-t pt-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <Checkbox
                  id="multi-order-mode"
                  checked={multiOrderMode}
                  onCheckedChange={(c) => {
                    const next = !!c;
                    setMultiOrderMode(next);
                    if (!next) setSavedScaffolds([]);
                  }}
                  disabled={loading}
                  className="mt-1"
                />
                <div className="flex-1 text-right">
                  <div className="font-semibold text-sm">درخواست چند داربست همزمان در یک مکان</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    اگر در یک آدرس بیش از یک داربست نیاز دارید این گزینه را فعال کنید. هزینه حمل و نقل فقط یک‌بار محاسبه و به‌صورت مساوی بین داربست‌ها تقسیم می‌شود.
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* لیست داربست‌های افزوده‌شده و خلاصه قیمت چندتایی */}
      {multiOrderMode && savedScaffolds.length > 0 && (() => {
        const summary = computeMultiSummary();
        return (
          <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2 border-emerald-500">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-300">
                داربست‌های افزوده شده ({summary.count})
              </CardTitle>
              <CardDescription>
                هزینه حمل و نقل مشترک به‌صورت یکجا برای کل سفر محاسبه و بین داربست‌ها تقسیم می‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.items.map((it) => (
                <div key={it.id} className="border rounded-lg p-3 bg-muted/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{it.label}</div>
                    {it.id !== 'current' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSavedScaffold(it.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    قیمت اجرا (بدون حمل): <span className="font-medium text-foreground">{it.baseNoDistance.toLocaleString('fa-IR')}</span> تومان
                  </div>
                  <div className="text-xs text-muted-foreground">
                    سهم حمل و نقل: <span className="font-medium text-foreground">{it.transportShare.toLocaleString('fa-IR')}</span> تومان
                  </div>
                  <div className="text-sm font-semibold mt-1">
                    جمع این داربست: <span className="text-primary">{it.finalPrice.toLocaleString('fa-IR')}</span> تومان
                  </div>
                </div>
              ))}

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>جمع قیمت اجرا (بدون حمل):</span><span className="font-medium">{summary.baseSum.toLocaleString('fa-IR')} تومان</span></div>
                <div className="flex justify-between"><span>هزینه حمل و نقل مشترک ({summary.distancePct}%):</span><span className="font-medium">{summary.sharedTransport.toLocaleString('fa-IR')} تومان</span></div>
                {cooperationDiscountPct > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-300">
                    <span>✓ رتبه همکاری شما</span>
                    <span className="font-medium">{cooperationRank} اعمال شد</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t">
                  <span>مجموع نهایی:</span>
                  <span className="text-emerald-700 dark:text-emerald-300">{summary.grandTotal.toLocaleString('fa-IR')} تومان</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}


      {/* نمایش فرم - آدرس قبلاً در صفحه SelectLocation انتخاب شده است */}
      {(selectedLocationId || editOrderId || initialLocationId || prefilledAddress || address || navState?.locationAddress) && (
      <>
      {/* نوع داربست */}
      <Card className="shadow-2xl bg-card/95 backdrop-blur-md border-2">
        <CardContent className="pt-6">
          {/* راهنمای انواع داربست */}
          <Collapsible className="mb-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm cursor-pointer w-full justify-end">
              <HelpCircle className="h-4 w-4" />
              <span>راهنمای انتخاب نوع داربست</span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm text-right border border-border/50">
                <div className="border-b border-border/30 pb-3">
                  <h4 className="font-bold text-foreground mb-1">داربست سطحی نما:</h4>
                  <p className="text-muted-foreground leading-relaxed">داربست‌های سطحی برای نماکاری، سیمانکاری، دیوارچینی و محیط‌هایی که برای یک بدنه سطح مربع می‌خواهند فعالیتی در ارتفاع انجام دهند مورد استفاده قرار می‌گیرد.</p>
                </div>
                <div className="border-b border-border/30 pb-3">
                  <h4 className="font-bold text-foreground mb-1">داربست حجمی کفراژ:</h4>
                  <p className="text-muted-foreground leading-relaxed">داربست برای محیط‌هایی که به صورت حجمی داربست بسته می‌شود، مثل داربست برای چادر خیمه‌ای یا داخل سالن که می‌خواهند بر روی سقف فعالیتی انجام دهند و یا برای کفراژ پشت داربست برای نگهداری از داربست و یا برای فنس‌کشی بر روی داربست می‌خواهند انجام دهند که باید داربست حجمی نصب شود.</p>
                </div>
                <div className="border-b border-border/30 pb-3">
                  <h4 className="font-bold text-foreground mb-1">داربست زیربتن سقف:</h4>
                  <p className="text-muted-foreground leading-relaxed">این نوع داربست برای نگهداری وزن سقف در زمان بتن‌ریزی برای سقف بسته می‌شود.</p>
                </div>
                <div className="border-b border-border/30 pb-3">
                  <h4 className="font-bold text-foreground mb-1">داربست ستونی:</h4>
                  <p className="text-muted-foreground leading-relaxed">این نوع داربست برای محل‌هایی نصب می‌شود که ارتفاع کار از طول و عرض محل فعالیت بیش از اندازه بیشتر باشد.</p>
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">داربست به طول لوله مصرفی:</h4>
                  <p className="text-muted-foreground leading-relaxed">این نوع داربست برای نرده‌کشی و یا اشکالی که در ابعاد و نوع داربست‌های بالا قرار نمی‌گیرد.</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
                <SelectValue placeholder="یکی از نوع داربست را انتخاب کنید" />
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

      {/* Media Upload Section - disableAutoUpload=true so files are uploaded after order creation */}
      <MediaUploader
        onFilesChange={setMediaFiles}
        maxImages={10}
        maxVideos={10}
        maxImageSize={10}
        maxVideoSize={70}
        maxVideoDuration={180}
        disableAutoUpload={true}
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
              {cooperationDiscountPct > 0 && (() => {
                const original = Math.round(priceData.total / (1 - cooperationDiscountPct / 100));
                const saved = original - priceData.total;
                return (
                  <div className="mb-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-3 space-y-1">
                    <div className="text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      🎉 <span>رتبه همکاری شما: <b>{cooperationRank}</b></span>
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">
                      قیمت پیش از تخفیف: <span className="line-through">{original.toLocaleString('fa-IR')}</span> تومان
                      &nbsp;•&nbsp; صرفه‌جویی شما: <b>{saved.toLocaleString('fa-IR')}</b> تومان
                    </div>
                  </div>
                );
              })()}
              <div className="text-xl font-bold">
                قیمت محاسبه شده: <span className="text-primary">{priceData.total.toLocaleString('fa-IR')}</span> تومان
              </div>
              {priceData.pricePerMeter && (
                <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  (قیمت هر متر مکعب: {priceData.pricePerMeter.toLocaleString('fa-IR')} تومان)
                </div>
              )}
            </div>

            
            {/* بخش تعیین قیمت دستی برای مدیر */}
            {isManagerEditMode && (
              <div className="pt-4 border-t border-amber-300 mt-4">
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-manual-price"
                      checked={useManualPrice}
                      onCheckedChange={(checked) => setUseManualPrice(checked as boolean)}
                    />
                    <Label htmlFor="use-manual-price" className="text-amber-800 dark:text-amber-200 font-semibold cursor-pointer">
                      تعیین قیمت دستی (متفاوت از قیمت محاسبه شده)
                    </Label>
                  </div>
                  
                  {useManualPrice && (
                    <div className="space-y-2">
                      <Label className="text-sm text-amber-700 dark:text-amber-300">قیمت دستی (تومان)</Label>
                      <Input
                        type="number"
                        value={manualPriceOverride}
                        onChange={(e) => setManualPriceOverride(e.target.value)}
                        placeholder="قیمت را وارد کنید"
                        className="text-lg font-bold"
                        dir="ltr"
                      />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        این قیمت جایگزین قیمت محاسبه شده خواهد شد
                      </p>
                    </div>
                  )}
                  
                  {useManualPrice && manualPriceOverride && (
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 mt-2">
                      <div className="text-lg font-bold text-green-700 dark:text-green-400">
                        قیمت نهایی: {parseFloat(manualPriceOverride).toLocaleString('fa-IR')} تومان
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </>
      )}

        {multiOrderMode && (
          <Button
            type="button"
            variant="outline"
            onClick={addCurrentScaffoldToList}
            disabled={loading || !canAddCurrentScaffold()}
            className="w-full border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            size="lg"
          >
            <Plus className="h-5 w-5 ml-2" />
            افزودن این داربست به لیست و وارد کردن داربست بعدی
          </Button>
        )}

        <Button 
          onClick={onSubmit}
          disabled={
            loading || 
            (!editOrderId && !selectedLocationId && !initialLocationId && !prefilledAddress && !address && !navState?.locationAddress) ||
            (multiOrderMode && savedScaffolds.length === 0 && !canAddCurrentScaffold()) ||
            (!multiOrderMode && (
              !scaffoldType ||
              !!getFacadeWarning() ||
              !!getFormworkWarning() ||
              (isPipeLengthScaffolding 
                ? parseFloat(dimensions[0]?.length || '0') <= 0
                : isColumnScaffolding 
                  ? !dimensions[0]?.length || !dimensions[0]?.width || !columnHeight
                  : dimensions.some(d => !d.length || !d.width || !d.height)
              )
            ))
          }
          className={`w-full ${recipientData ? 'bg-green-600 hover:bg-green-700' : ''}`}
          size="lg"
        >
          {loading 
            ? 'در حال ثبت...' 
            : multiOrderMode
              ? `ثبت همه سفارشات (${savedScaffolds.length + (canAddCurrentScaffold() ? 1 : 0)} داربست)`
              : recipientData 
                ? `ثبت سفارش برای ${recipientData.fullName || recipientData.phoneNumber}`
                : 'ثبت درخواست'
          }
        </Button>

      </>
      )}
      </>
      )}
      </div>
    </div>
  );
}
