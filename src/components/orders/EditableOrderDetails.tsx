import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { calculateTotalFromDimensions } from '@/lib/dimensionCalculations';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ImageIcon, ChevronLeft, ChevronRight, Ruler, FileText, Layers, User, Phone, MapPin, 
  Calendar, Banknote, Edit, Save, X, Upload, Trash2, Loader2, Printer, Wrench, Truck, Home, ExternalLink, RefreshCw,
  Plus, Copy
} from 'lucide-react';
import { ManagerOrderInvoice } from './ManagerOrderInvoice';
import { formatPersianDate, formatPersianDateTime } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { parseOrderNotes } from './OrderDetailsView';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import CallHistory from '@/components/calls/CallHistory';
import OrderChat from './OrderChat';
import { RepairRequestDialog } from './RepairRequestDialog';
import { CollectionRequestDialog } from './CollectionRequestDialog';
import { ManagerRenewalDialog } from './ManagerRenewalDialog';
import StaticLocationMap from '@/components/locations/StaticLocationMap';
import { OrderCollaboratorsList } from './OrderCollaboratorsList';
import { OrderTimeline } from './OrderTimeline';
import { ManagerOwnershipChain } from './ManagerOwnershipChain';
import { CustomerOwnershipChain } from './CustomerOwnershipChain';
import { CentralizedVideoPlayer } from '@/components/media/CentralizedVideoPlayer';
import { OrderMediaSection } from './OrderMediaSection';
import { ExpertPricingEditDialog } from './ExpertPricingEditDialog';
import { InvoiceEmployerOverrideDialog } from './InvoiceEmployerOverrideDialog';
import { applyFixedPriceToBreakdown } from '@/lib/priceBreakdown';
import { OrderDiscountPanel } from './OrderDiscountPanel';


const scaffoldingTypeLabels: Record<string, string> = {
  facade: 'داربست سطحی نما',
  formwork: 'داربست حجمی کفراژ',
  ceiling: 'داربست زیربتن سقف',
  column: 'داربست ستونی',
  pipe_length: 'داربست به طول لوله مصرفی'
};

const ceilingSubtypeLabels: Record<string, string> = {
  yonolit: 'تیرچه یونولیت',
  ceramic: 'تیرچه سفال',
  slab: 'دال و وافل'
};


interface EditableOrderDetailsProps {
  order: {
    id: string;
    code: string;
    status?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_id?: string;
    address?: string;
    detailed_address?: string | null;
    created_at?: string;
    notes?: any;
    payment_amount?: number | null;
    location_lat?: number | null;
    location_lng?: number | null;
    executed_by?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    execution_start_date?: string | null;
    execution_end_date?: string | null;
    execution_stage?: string | null;
    execution_stage_updated_at?: string | null;
    customer_completion_date?: string | null;
    rejection_reason?: string | null;
    subcategory_id?: string | null;
    subcategory?: { code?: string; name?: string } | null;
    transferred_from_user_id?: string | null;
    transferred_from_phone?: string | null;
    rental_start_date?: string | null;
    total_price?: number | null;
    total_paid?: number | null;
    discount_amount?: number | null;
    price_before_discount?: number | null;
    discount_note?: string | null;

  };
  onUpdate?: () => void;
  hidePrice?: boolean; // Hide price information (for executive managers in specific modules)
  hideDetails?: boolean; // Hide order details, only show financial info (for accounting module)
}

export const EditableOrderDetails = ({ order, onUpdate, hidePrice = false, hideDetails = false }: EditableOrderDetailsProps) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [expertPricingEditOpen, setExpertPricingEditOpen] = useState(false);
  const [approvedRepairCost, setApprovedRepairCost] = useState(0);
  const [approvedRepairs, setApprovedRepairs] = useState<any[]>([]);

  const [approvedRenewalCost, setApprovedRenewalCost] = useState(0);
  const [approvedRenewals, setApprovedRenewals] = useState<any[]>([]);
  const [orderApprovals, setOrderApprovals] = useState<Array<{ approver_role: string; approved_at: string | null; approver_user_id: string | null }>>([]);
  const [approvedCollectionDate, setApprovedCollectionDate] = useState<string | null>(null);
  const { toast } = useToast();
  
  const parsedNotes = typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);

  // Fetch approved/completed repair costs, renewals, approvals, and collection date
  useEffect(() => {
    const fetchData = async () => {
      // Fetch repair costs, renewals, approvals, and collection date in parallel
      const [repairRes, renewalsRes, approvalsRes, collectionRes] = await Promise.all([
        supabase
          .from('repair_requests')
          .select('id, final_cost, status, created_at, description')
          .eq('order_id', order.id)
          .in('status', ['approved', 'completed'])
          .order('created_at', { ascending: true }),
        supabase
          .from('order_renewals')
          .select('renewal_price, renewal_number, new_start_date, new_end_date, status, manager_notes')
          .eq('order_id', order.id)
          .eq('status', 'approved')
          .order('renewal_number', { ascending: true }),
        supabase
          .from('order_approvals')
          .select('approver_role, approved_at, approver_user_id')
          .eq('order_id', order.id),
        supabase
          .from('collection_requests')
          .select('requested_date, status')
          .eq('order_id', order.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (repairRes.data) {
        const totalRepairCost = repairRes.data.reduce((sum: number, r: any) => sum + (r.final_cost || 0), 0);
        setApprovedRepairCost(totalRepairCost);
        setApprovedRepairs((repairRes.data as any[]).filter((r: any) => (r.final_cost || 0) > 0));
      }

      if (renewalsRes.data) {
        const totalRenewalCost = renewalsRes.data.reduce((sum: number, r: any) => sum + (r.renewal_price || 0), 0);
        setApprovedRenewalCost(totalRenewalCost);
        setApprovedRenewals(renewalsRes.data);
      }

      if (approvalsRes.data) {
        setOrderApprovals(approvalsRes.data);
      }

      if (collectionRes.data?.requested_date) {
        setApprovedCollectionDate(collectionRes.data.requested_date);
      } else {
        setApprovedCollectionDate(null);
      }
    };
    fetchData();
  }, [order.id]);
  
  // Editable fields
  const [address, setAddress] = useState(order.address || '');
  const [detailedAddress, setDetailedAddress] = useState(order.detailed_address || '');
  const [customerName, setCustomerName] = useState(order.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone || '');
  const [paymentAmount, setPaymentAmount] = useState(order.payment_amount?.toString() || '');
  const [description, setDescription] = useState(
    parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || ''
  );
  const [scaffoldingType, setScaffoldingType] = useState(
    parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type || ''
  );

  // Track if price has been modified since last save (for save button state)
  const [savedPaymentAmount, setSavedPaymentAmount] = useState(order.payment_amount?.toString() || '');
  const isPriceChanged = paymentAmount !== savedPaymentAmount;

  // Unit price for expert pricing requests (price per square meter)
  const [unitPrice, setUnitPrice] = useState(parsedNotes?.unit_price?.toString() || '');
  const [savedUnitPrice, setSavedUnitPrice] = useState(parsedNotes?.unit_price?.toString() || '');
  const isUnitPriceChanged = unitPrice !== savedUnitPrice;

  // ===== خدمات سفارشی: قیمت‌گذاری بر پایه تعداد / متراژ / حجم / وزن =====
  const isCustomService = Boolean(parsedNotes?.is_custom_service);
  const customQuantity = parseLocalizedNumber(parsedNotes?.quantity) || 0;
  const customWeight = parseLocalizedNumber(parsedNotes?.weight) || 0;
  const customDims: any[] = Array.isArray(parsedNotes?.dimensions) ? parsedNotes.dimensions : [];
  const customArea = customDims.reduce((sum, d) => {
    const l = parseLocalizedNumber(d?.length);
    const w = parseLocalizedNumber(d?.width);
    const h = parseLocalizedNumber(d?.height);
    const second = w > 0 ? w : h;
    return l > 0 && second > 0 ? sum + l * second : sum;
  }, 0);
  const customVolume = customDims.reduce((sum, d) => {
    const l = parseLocalizedNumber(d?.length);
    const w = parseLocalizedNumber(d?.width);
    const h = parseLocalizedNumber(d?.height);
    return l > 0 && w > 0 && h > 0 ? sum + l * w * h : sum;
  }, 0);
  const customLength = customDims.reduce((sum, d) => sum + (parseLocalizedNumber(d?.length) || 0), 0);

  type CustomBasis = 'fixed' | 'quantity' | 'area' | 'volume' | 'weight' | 'length';
  const defaultCustomBasis: CustomBasis =
    (parsedNotes?.custom_pricing_basis as CustomBasis) ||
    (customQuantity > 0 ? 'quantity' : customVolume > 0 ? 'volume' : customArea > 0 ? 'area' : customWeight > 0 ? 'weight' : customLength > 0 ? 'length' : 'fixed');
  const [customBasis, setCustomBasis] = useState<CustomBasis>(defaultCustomBasis);
  const [customUnitPrice, setCustomUnitPrice] = useState(parsedNotes?.custom_unit_price?.toString() || '');
  const [savedCustomPricing, setSavedCustomPricing] = useState({
    basis: defaultCustomBasis as string,
    unitPrice: parsedNotes?.custom_unit_price?.toString() || '',
  });

  const customBasisOptions: Array<{ value: CustomBasis; label: string; measure: number; unit: string }> = [
    { value: 'quantity', label: 'بر اساس تعداد', measure: customQuantity, unit: 'عدد' },
    { value: 'area', label: 'بر اساس متراژ', measure: customArea, unit: 'متر مربع' },
    { value: 'volume', label: 'بر اساس حجم', measure: customVolume, unit: 'متر مکعب' },
    { value: 'weight', label: 'بر اساس وزن', measure: customWeight, unit: 'کیلوگرم' },
    { value: 'length', label: 'بر اساس طول', measure: customLength, unit: 'متر' },
    { value: 'fixed', label: 'مبلغ مقطوع (بدون فی)', measure: 0, unit: '' },
  ];
  const activeCustomBasis = customBasisOptions.find(o => o.value === customBasis) || customBasisOptions[5];
  const customComputedTotal =
    customBasis !== 'fixed' && customUnitPrice && activeCustomBasis.measure > 0
      ? Math.round(parseLocalizedNumber(customUnitPrice) * activeCustomBasis.measure)
      : 0;

  // محاسبه خودکار مبلغ کل از فی × مقدار پایه انتخاب‌شده
  useEffect(() => {
    if (isCustomService && customComputedTotal > 0) {
      setPaymentAmount(customComputedTotal.toString());
    }
  }, [isCustomService, customComputedTotal]);

  const isCustomPricingChanged =
    customBasis !== savedCustomPricing.basis || customUnitPrice !== savedCustomPricing.unitPrice;

  // Check if this is an expert pricing request
  const isExpertPricingRequest = parsedNotes?.is_expert_pricing_request === true;


  // Calculate total measure (m² or m³) from dimensions for expert pricing
  const calculateExpertPricingTotalMeasure = () => {
    const dims = parsedNotes?.dimensions;
    if (!dims || !Array.isArray(dims) || dims.length === 0) {
      // Fallback to stored value only if no dimensions
      const totalFromNotes = parseLocalizedNumber(
        parsedNotes?.total_volume ?? parsedNotes?.totalVolume ?? parsedNotes?.total_area ?? parsedNotes?.totalArea
      );
      return totalFromNotes > 0 ? totalFromNotes : 0;
    }
    // Always recalculate from dimensions
    const hasAnyWidth = dims.some((d: any) => parseLocalizedNumber(d?.width) > 0);
    return dims.reduce((sum: number, dim: any) => {
      const length = parseLocalizedNumber(dim?.length);
      const height = parseLocalizedNumber(dim?.height);
      if (length <= 0 || height <= 0) return sum;
      if (hasAnyWidth) {
        const width = parseLocalizedNumber(dim?.width);
        const w = width > 0 ? width : 1;
        return sum + length * w * height;
      }
      return sum + length * height;
    }, 0);
  };

  const expertPricingTotalMeasure = calculateExpertPricingTotalMeasure();
  const expertPricingMeasureUnit = (() => {
    const dims = parsedNotes?.dimensions;
    const hasAnyWidth = Array.isArray(dims) && dims.some((d: any) => parseLocalizedNumber(d?.width) > 0);
    const isVolume = Boolean(parsedNotes?.total_volume ?? parsedNotes?.totalVolume) || hasAnyWidth;
    return isVolume ? 'متر مکعب' : 'متر مربع';
  })();

  // Display totals including renewals/repairs (manager-facing)
  const basePriceNumber = parseLocalizedNumber(paymentAmount);
  const totalFromDb = Number(order.total_price ?? 0);
  const totalFromParts = Number(basePriceNumber || 0) + Number(approvedRenewalCost || 0) + Number(approvedRepairCost || 0);
  const displayTotalOrderAmount = Math.max(totalFromDb, totalFromParts);
  const displayAddOnsAmount = Math.max(0, displayTotalOrderAmount - Number(basePriceNumber || 0));

  // Check if this is a rental expert pricing order (has item_type in notes)
  const isRentalExpertPricing = isExpertPricingRequest && !!parsedNotes?.item_type;

  // Auto-calculate payment from unit price for non-rental expert pricing
  useEffect(() => {
    if (isExpertPricingRequest && !isRentalExpertPricing && unitPrice && expertPricingTotalMeasure > 0) {
      const calculatedTotal = parseFloat(unitPrice) * expertPricingTotalMeasure;
      setPaymentAmount(Math.round(calculatedTotal).toString());
    }
  }, [unitPrice, expertPricingTotalMeasure, isExpertPricingRequest, isRentalExpertPricing]);

  
  // Rental item pricing states
  const [rentalItem1UnitPrice, setRentalItem1UnitPrice] = useState(parsedNotes?.item_1_unit_price?.toString() || '');
  const [rentalItem1TotalPrice, setRentalItem1TotalPrice] = useState(parsedNotes?.item_1_total_price?.toString() || '');
  const [rentalItem2UnitPrice, setRentalItem2UnitPrice] = useState(parsedNotes?.item_2_unit_price?.toString() || '');
  const [rentalItem2TotalPrice, setRentalItem2TotalPrice] = useState(parsedNotes?.item_2_total_price?.toString() || '');
  const [savedRentalPrices, setSavedRentalPrices] = useState({
    item1Unit: parsedNotes?.item_1_unit_price?.toString() || '',
    item1Total: parsedNotes?.item_1_total_price?.toString() || '',
    item2Unit: parsedNotes?.item_2_unit_price?.toString() || '',
    item2Total: parsedNotes?.item_2_total_price?.toString() || '',
  });
  const isRentalPriceChanged = 
    rentalItem1UnitPrice !== savedRentalPrices.item1Unit ||
    rentalItem1TotalPrice !== savedRentalPrices.item1Total ||
    rentalItem2UnitPrice !== savedRentalPrices.item2Unit ||
    rentalItem2TotalPrice !== savedRentalPrices.item2Total;

  const rentalItem1Name = parsedNotes?.item_type || '';
  const rentalItem1Qty = parseLocalizedNumber(parsedNotes?.quantity) || 0;
  const rentalItem2Name = parsedNotes?.item_type_2 || '';
  const rentalItem2Qty = parseLocalizedNumber(parsedNotes?.quantity_2) || 0;

  // Auto-calculate rental item totals when unit price changes
  useEffect(() => {
    if (!isRentalExpertPricing) return;
    
    // Item 1: if unit price entered, calculate total = unitPrice * qty
    if (rentalItem1UnitPrice && parseFloat(rentalItem1UnitPrice) > 0 && rentalItem1Qty > 0) {
      const total1 = Math.round(parseFloat(rentalItem1UnitPrice) * rentalItem1Qty);
      setRentalItem1TotalPrice(total1.toString());
    }
    
    // Item 2
    if (rentalItem2UnitPrice && parseFloat(rentalItem2UnitPrice) > 0 && rentalItem2Qty > 0) {
      const total2 = Math.round(parseFloat(rentalItem2UnitPrice) * rentalItem2Qty);
      setRentalItem2TotalPrice(total2.toString());
    }
  }, [rentalItem1UnitPrice, rentalItem2UnitPrice, isRentalExpertPricing, rentalItem1Qty, rentalItem2Qty]);

  // Auto-calculate grand total for rental items
  useEffect(() => {
    if (!isRentalExpertPricing) return;
    const total1 = parseFloat(rentalItem1TotalPrice) || 0;
    const total2 = parseFloat(rentalItem2TotalPrice) || 0;
    const grandTotal = total1 + total2;
    if (grandTotal > 0) {
      setPaymentAmount(grandTotal.toString());
    }
  }, [rentalItem1TotalPrice, rentalItem2TotalPrice, isRentalExpertPricing]);

  // ===== Multi-scaffold expert pricing support =====
  const expertScaffolds: any[] = (isExpertPricingRequest && parsedNotes?.is_multi_scaffold && Array.isArray(parsedNotes?.scaffolds))
    ? parsedNotes.scaffolds
    : [];
  const hasExpertScaffolds = expertScaffolds.length > 0;

  // Per-scaffold area calculator
  const calcScaffoldArea = (sc: any) => {
    const dims = Array.isArray(sc?.dimensions) ? sc.dimensions : [];
    if (dims.length === 0) return 0;
    const hasW = dims.some((d: any) => parseLocalizedNumber(d?.width) > 0);
    return dims.reduce((sum: number, d: any) => {
      const l = parseLocalizedNumber(d?.length);
      const h = parseLocalizedNumber(d?.height);
      if (l <= 0 || h <= 0) return sum;
      if (hasW) {
        const w = parseLocalizedNumber(d?.width);
        return sum + l * (w > 0 ? w : 1) * h;
      }
      return sum + l * h;
    }, 0);
  };
  const scaffoldAreaUnit = (sc: any) => {
    const dims = Array.isArray(sc?.dimensions) ? sc.dimensions : [];
    return dims.some((d: any) => parseLocalizedNumber(d?.width) > 0) ? 'متر مکعب' : 'متر مربع';
  };

  // Per-scaffold price state: keyed by index, value is total price string
  const initialScaffoldPrices: string[] = expertScaffolds.map((_, i) => {
    const saved = Array.isArray(parsedNotes?.scaffold_prices) ? parsedNotes.scaffold_prices[i] : null;
    return saved?.total != null ? String(saved.total) : '';
  });
  const [scaffoldPrices, setScaffoldPrices] = useState<string[]>(initialScaffoldPrices);
  const [savedScaffoldPrices, setSavedScaffoldPrices] = useState<string[]>(initialScaffoldPrices);
  const isScaffoldPricesChanged = JSON.stringify(scaffoldPrices) !== JSON.stringify(savedScaffoldPrices);

  // Auto-sum to paymentAmount (also reflects removed items)
  useEffect(() => {
    if (!hasExpertScaffolds) return;
    const sum = scaffoldPrices.reduce((s, v) => s + (parseFloat(v) || 0), 0);
    setPaymentAmount(sum > 0 ? Math.round(sum).toString() : '');
  }, [scaffoldPrices, hasExpertScaffolds]);

  // ===== Full-edit support for expert scaffolds (label, description, dimensions) =====
  type DimRow = { length: string; width: string; height: string };
  const emptyDimRow = (): DimRow => ({ length: '', width: '', height: '' });
  const buildDimRows = (dims: any[]): DimRow[] => (Array.isArray(dims) ? dims : []).map((d: any) => ({
    length: d?.length != null ? String(d.length) : '',
    width: d?.width != null ? String(d.width) : '',
    height: d?.height != null ? String(d.height) : '',
  }));
  type ScaffoldEdit = { label: string; description: string; dimensions: DimRow[]; orig?: any };
  const initialScaffoldEdits: ScaffoldEdit[] = expertScaffolds.map((sc: any) => ({
    label: sc.label || '',
    description: sc.description || '',
    dimensions: buildDimRows(sc.dimensions),
    orig: sc,
  }));
  const [scaffoldEdits, setScaffoldEdits] = useState<ScaffoldEdit[]>(initialScaffoldEdits);
  const initialScaffoldEditsSer = JSON.stringify(initialScaffoldEdits);
  const isScaffoldEditsChanged = JSON.stringify(scaffoldEdits) !== initialScaffoldEditsSer;

  // Inline delete confirmation state (per item index)
  const [confirmDeleteExpert, setConfirmDeleteExpert] = useState<number | null>(null);
  const [confirmDeleteMulti, setConfirmDeleteMulti] = useState<number | null>(null);

  // Add / duplicate / remove an expert-scaffold item (keeps prices aligned)
  const addScaffoldItem = () => {
    setScaffoldEdits([...scaffoldEdits, { label: '', description: '', dimensions: [emptyDimRow()], orig: {} }]);
    setScaffoldPrices([...scaffoldPrices, '']);
  };
  const duplicateScaffoldItem = (i: number) => {
    const src = scaffoldEdits[i];
    const copy: ScaffoldEdit = {
      label: src.label ? `${src.label} (کپی)` : '',
      description: src.description,
      dimensions: src.dimensions.map(d => ({ ...d })),
      orig: { ...(src.orig || {}) },
    };
    const nextEdits = [...scaffoldEdits];
    nextEdits.splice(i + 1, 0, copy);
    const nextPrices = [...scaffoldPrices];
    nextPrices.splice(i + 1, 0, scaffoldPrices[i] || '');
    setScaffoldEdits(nextEdits);
    setScaffoldPrices(nextPrices);
  };
  const removeScaffoldItem = (i: number) => {
    setScaffoldEdits(scaffoldEdits.filter((_, idx) => idx !== i));
    setScaffoldPrices(scaffoldPrices.filter((_, idx) => idx !== i));
  };

  // ===== Multi-scaffolds (snapshot-based) full edit =====
  const initialMultiScaffolds: any[] = Array.isArray(parsedNotes?.multi_scaffolds) ? parsedNotes.multi_scaffolds : [];
  const hasMultiScaffolds = initialMultiScaffolds.length > 0;
  type MultiScaffoldEdit = { label: string; description: string; dimensions: DimRow[]; finalPrice: string; orig?: any };
  const initialMultiScaffoldsEdit: MultiScaffoldEdit[] = initialMultiScaffolds.map((it: any) => ({
    label: it.label || '',
    description: it.snapshot?.locationPurpose || it.description || '',
    dimensions: buildDimRows(it.snapshot?.dimensions),
    finalPrice: it.finalPrice != null ? String(it.finalPrice) : '',
    orig: it,
  }));
  const [multiScaffoldsEdit, setMultiScaffoldsEdit] = useState<MultiScaffoldEdit[]>(initialMultiScaffoldsEdit);
  const initialMultiScaffoldsEditSer = JSON.stringify(initialMultiScaffoldsEdit);
  const isMultiScaffoldsChanged = JSON.stringify(multiScaffoldsEdit) !== initialMultiScaffoldsEditSer;

  const addMultiScaffoldItem = () => {
    setMultiScaffoldsEdit([
      ...multiScaffoldsEdit,
      { label: '', description: '', dimensions: [emptyDimRow()], finalPrice: '', orig: {} },
    ]);
  };
  const duplicateMultiScaffoldItem = (i: number) => {
    const src = multiScaffoldsEdit[i];
    const copy: MultiScaffoldEdit = {
      label: src.label ? `${src.label} (کپی)` : '',
      description: src.description,
      dimensions: src.dimensions.map(d => ({ ...d })),
      finalPrice: src.finalPrice,
      orig: { ...(src.orig || {}) },
    };
    const next = [...multiScaffoldsEdit];
    next.splice(i + 1, 0, copy);
    setMultiScaffoldsEdit(next);
  };
  const removeMultiScaffoldItem = (i: number) => {
    setMultiScaffoldsEdit(multiScaffoldsEdit.filter((_, idx) => idx !== i));
  };

  const calcDimsArea = (dims: DimRow[]) => {
    const hasW = dims.some(d => parseLocalizedNumber(d?.width) > 0);
    return dims.reduce((sum, d) => {
      const l = parseLocalizedNumber(d?.length);
      const h = parseLocalizedNumber(d?.height);
      if (l <= 0 || h <= 0) return sum;
      if (hasW) {
        const w = parseLocalizedNumber(d?.width);
        return sum + l * (w > 0 ? w : 1) * h;
      }
      return sum + l * h;
    }, 0);
  };
  const dimsUnit = (dims: DimRow[]) => dims.some(d => parseLocalizedNumber(d?.width) > 0) ? 'متر مکعب' : 'متر مربع';

  // Auto-sum multi-scaffold finalPrice → paymentAmount during edit
  useEffect(() => {
    if (!hasMultiScaffolds || !isEditing) return;
    const sum = multiScaffoldsEdit.reduce((s, it) => s + (parseFloat(it.finalPrice) || 0), 0);
    setPaymentAmount(sum > 0 ? Math.round(sum).toString() : '');
  }, [multiScaffoldsEdit, hasMultiScaffolds, isEditing]);




  const handleSave = async () => {
    setSaving(true);
    try {
      // Build updated notes
      const updatedNotes = {
        ...parsedNotes,
        description,
        service_type: scaffoldingType
      };

      // If manager is setting price on expert pricing request, mark it and auto-confirm
      if (isExpertPricingRequest && paymentAmount && parseFloat(paymentAmount) > 0) {
        updatedNotes.price_set_by_manager = true;
        updatedNotes.manager_set_price = parseFloat(paymentAmount);
        updatedNotes.pricing_date = new Date().toISOString();
        // تایید خودکار قیمت (بدون نیاز به تایید دستی مشتری)
        updatedNotes.customer_price_confirmed = true;
        updatedNotes.customer_price_confirmed_at = new Date().toISOString();
        updatedNotes.auto_confirmed_by_expert = true;
        
        // Store rental item prices if this is a rental order
        if (isRentalExpertPricing) {
          if (rentalItem1UnitPrice) updatedNotes.item_1_unit_price = parseFloat(rentalItem1UnitPrice);
          if (rentalItem1TotalPrice) updatedNotes.item_1_total_price = parseFloat(rentalItem1TotalPrice);
          if (rentalItem2UnitPrice) updatedNotes.item_2_unit_price = parseFloat(rentalItem2UnitPrice);
          if (rentalItem2TotalPrice) updatedNotes.item_2_total_price = parseFloat(rentalItem2TotalPrice);
        }
        
        // Store unit price if provided (for area-based orders)
        if (!isRentalExpertPricing && unitPrice && parseFloat(unitPrice) > 0) {
          updatedNotes.unit_price = parseFloat(unitPrice);
          if (expertPricingMeasureUnit === 'متر مکعب') {
            updatedNotes.total_volume = expertPricingTotalMeasure;
            updatedNotes.pricing_unit = 'm3';
          } else {
            updatedNotes.total_area = expertPricingTotalMeasure;
            updatedNotes.pricing_unit = 'm2';
          }
        }

        // Store per-scaffold prices if this is a multi-scaffold expert pricing
        if (hasExpertScaffolds) {
          updatedNotes.scaffold_prices = scaffoldEdits.map((ed, i) => ({
            index: i,
            label: ed.label || ed.orig?.label || `داربست ${i + 1}`,
            description: ed.description ?? '',
            area: calcDimsArea(ed.dimensions),
            unit: dimsUnit(ed.dimensions),
            total: parseFloat(scaffoldPrices[i] || '0') || 0,
          }));
        }
      }

      // Persist expert scaffold edits (label/description/dimensions/add/remove)
      if (hasExpertScaffolds) {
        updatedNotes.scaffolds = scaffoldEdits.map((ed, i) => ({
          ...(ed.orig || {}),
          label: ed.label || ed.orig?.label || `داربست ${i + 1}`,
          description: ed.description,
          dimensions: ed.dimensions.map(d => ({
            length: parseLocalizedNumber(d.length),
            width: parseLocalizedNumber(d.width),
            height: parseLocalizedNumber(d.height),
          })),
        }));
        updatedNotes.is_multi_scaffold = true;
      }

      // Persist multi-scaffold (snapshot) edits including add/remove
      if (hasMultiScaffolds) {
        updatedNotes.multi_scaffolds = multiScaffoldsEdit.map((ed, i) => {
          const orig = ed.orig || {};
          const cleanDims = ed.dimensions.map(d => ({
            length: parseLocalizedNumber(d.length),
            width: parseLocalizedNumber(d.width),
            height: parseLocalizedNumber(d.height),
          }));
          const area = calcDimsArea(ed.dimensions);
          return {
            ...orig,
            label: ed.label || orig.label || `داربست #${i + 1}`,
            description: ed.description,
            finalPrice: parseFloat(ed.finalPrice) || 0,
            totalArea: area,
            snapshot: {
              ...(orig.snapshot || {}),
              dimensions: cleanDims,
              locationPurpose: ed.description,
            },
          };
        });
      }

      // خدمات سفارشی: ذخیره مبنای قیمت‌گذاری و قیمت فی
      if (isCustomService) {
        updatedNotes.custom_pricing_basis = customBasis;
        updatedNotes.custom_pricing_basis_label = activeCustomBasis.label;
        updatedNotes.custom_pricing_measure = activeCustomBasis.measure || null;
        updatedNotes.custom_pricing_measure_unit = activeCustomBasis.unit || null;
        updatedNotes.custom_unit_price = customUnitPrice ? parseLocalizedNumber(customUnitPrice) : null;
        if (paymentAmount && parseFloat(paymentAmount) > 0) {
          updatedNotes.awaiting_manual_pricing = false;
          updatedNotes.price_set_by_manager = true;
          updatedNotes.manager_set_price = parseFloat(paymentAmount);
          updatedNotes.pricing_date = new Date().toISOString();
        }
      }


      const updatePayload: any = {
        address,
        detailed_address: detailedAddress,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        notes: updatedNotes
      };
      // وقتی مدیر قیمت نهایی را ثبت می‌کند، total_price نیز باید با همان مقدار همگام شود
      if (paymentAmount && parseFloat(paymentAmount) > 0) {
        updatePayload.total_price = parseFloat(paymentAmount);
      }

      const { error } = await supabase
        .from('projects_v3')
        .update(updatePayload)
        .eq('id', order.id);

      if (error) throw error;

      // بعد از ذخیره موفق، مقدار ذخیره شده قیمت را آپدیت کن تا دکمه غیرفعال شود
      setSavedPaymentAmount(paymentAmount);
      setSavedUnitPrice(unitPrice);
      if (isCustomService) {
        setSavedCustomPricing({ basis: customBasis, unitPrice: customUnitPrice });
      }

      if (isRentalExpertPricing) {
        setSavedRentalPrices({
          item1Unit: rentalItem1UnitPrice,
          item1Total: rentalItem1TotalPrice,
          item2Unit: rentalItem2UnitPrice,
          item2Total: rentalItem2TotalPrice,
        });
      }
      if (hasExpertScaffolds) {
        setSavedScaffoldPrices([...scaffoldPrices]);
      }

      toast({ title: 'موفق', description: 'اطلاعات سفارش به‌روزرسانی شد' });
      setIsEditing(false);
      onUpdate?.();
    } catch (err: any) {
      console.error('Update error:', err);
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'خطا در ذخیره تغییرات' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setAddress(order.address || '');
    setDetailedAddress(order.detailed_address || '');
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setPaymentAmount(order.payment_amount?.toString() || '');
    setDescription(parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || '');
    setScaffoldingType(parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type || '');
    setScaffoldEdits(initialScaffoldEdits);
    setScaffoldPrices(savedScaffoldPrices);
    setMultiScaffoldsEdit(initialMultiScaffoldsEdit);
    setConfirmDeleteExpert(null);
    setConfirmDeleteMulti(null);
    setIsEditing(false);
  };


  // Display values from notes
  const dimensions = parsedNotes?.dimensions;
  const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area;
  const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;
  const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;

  // For accounting module, show only financial info
  if (hideDetails) {
    const estimatedFromNotes =
      typeof parsedNotes?.estimated_price === 'number'
        ? parsedNotes.estimated_price
        : typeof parsedNotes?.estimatedPrice === 'number'
          ? parsedNotes.estimatedPrice
          : 0;

    const baseOrderAmount = (() => {
      // اگر total_price بزرگتر از صفر باشد، یعنی شامل تمدیدها است - اما تمدید باید جدا حساب شود
      // از payment_amount به عنوان قیمت پایه استفاده می‌کنیم
      const pa = Number(order.payment_amount ?? estimatedFromNotes ?? 0);
      if (Number.isFinite(pa) && pa > 0) return pa;

      return 0;
    })();

    const totalPaidValue = Number((order as any).total_paid || 0);
    // مبلغ کل = قیمت پایه + تعمیرات + تمدیدها
    const totalOrderAmount = Number(baseOrderAmount) + Number(approvedRepairCost || 0) + Number(approvedRenewalCost || 0);
    const remainingValue = Math.max(0, totalOrderAmount - totalPaidValue);

    return (
      <div className="space-y-4">
        {/* Basic Order Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-xs text-muted-foreground">کد سفارش</Label>
            <p className="font-bold text-lg">{order.code}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">نام مشتری</Label>
            <p className="font-medium">{order.customer_name || 'نامشخص'}</p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-5 w-5 text-green-600" />
            <span className="text-lg font-bold">اطلاعات مالی سفارش</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-background p-4 rounded-lg border">
              <Label className="text-xs text-muted-foreground block mb-1">مبلغ کل سفارش</Label>
              <p className="font-bold text-xl text-green-700 dark:text-green-300">
                {Number(totalOrderAmount).toLocaleString('fa-IR')} تومان
              </p>
            </div>
            
            <div className="bg-background p-4 rounded-lg border">
              <Label className="text-xs text-muted-foreground block mb-1">مبلغ پرداخت شده</Label>
              <p className="font-bold text-xl text-blue-700 dark:text-blue-300">
                {Number(totalPaidValue).toLocaleString('fa-IR')} تومان
              </p>
            </div>
            
            <div className="bg-background p-4 rounded-lg border">
              <Label className="text-xs text-muted-foreground block mb-1">مانده بدهکاری</Label>
              <p className={`font-bold text-xl ${remainingValue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {Number(remainingValue).toLocaleString('fa-IR')} تومان
              </p>
            </div>
          </div>

          {/* تفکیک هزینه‌ها */}
          {(approvedRenewalCost > 0 || approvedRepairCost > 0) && (
            <div className="space-y-2 pt-3 border-t border-green-200 dark:border-green-700">
              <div className="flex justify-between text-sm p-2 bg-background/50 rounded">
                <span className="text-muted-foreground">کرایه ماه اول:</span>
                <span className="font-medium">{baseOrderAmount.toLocaleString('fa-IR')} تومان</span>
              </div>
              
              {approvedRenewals.map((renewal: any) => (
                <div key={renewal.renewal_number} className="space-y-1">
                  <div className="flex justify-between text-sm p-2 bg-primary/10 rounded border border-primary/20">
                    <span className="flex items-center gap-1 text-primary">
                      <RefreshCw className="h-3 w-3" />
                      تمدید ماه {renewal.renewal_number + 1}:
                    </span>
                    <span className="font-bold text-primary">{(renewal.renewal_price || 0).toLocaleString('fa-IR')} تومان</span>
                  </div>
                  {renewal.manager_notes && (
                    <p className="text-[11px] text-muted-foreground italic px-2 leading-relaxed">
                      شرح: {renewal.manager_notes}
                    </p>
                  )}
                </div>
              ))}

              {approvedRepairs.map((repair: any, idx: number) => (
                <div key={repair.id || idx} className="space-y-1">
                  <div className="flex justify-between text-sm p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800">
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <Wrench className="h-3 w-3" />
                      هزینه تعمیر {(idx + 1).toLocaleString('fa-IR')}{repair.created_at ? ` (${formatPersianDate(repair.created_at)})` : ''}:
                    </span>
                    <span className="font-bold text-orange-700 dark:text-orange-300">{Number(repair.final_cost || 0).toLocaleString('fa-IR')} تومان</span>
                  </div>
                  {repair.description && (
                    <p className="text-[11px] text-muted-foreground italic px-2 leading-relaxed">
                      شرح: {repair.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Editable Price Input for Accounting */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-sm font-medium mb-2 block">ویرایش مبلغ سفارش</Label>
            <div className="flex gap-2">
              <Input 
                type="number"
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="مبلغ به تومان"
                className="flex-1"
                dir="ltr"
              />
              <Button 
                onClick={handleSave} 
                disabled={saving || !isPriceChanged}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {!isPriceChanged ? 'ذخیره شده' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Expert Pricing Request Badge with Price Input - shown only if hidePrice is false */}
      {isExpertPricingRequest && !hidePrice && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full">
              <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-amber-800 dark:text-amber-200">درخواست قیمت‌گذاری کارشناسی</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {parsedNotes?.price_set_by_manager 
                  ? parsedNotes?.customer_price_confirmed 
                    ? '✓ قیمت توسط مشتری تایید شده است'
                    : '⏳ قیمت تعیین شده - در انتظار تایید مشتری'
                  : 'لطفاً قیمت را تعیین کنید تا برای تایید به مشتری نمایش داده شود'
                }
              </p>
            </div>
          </div>
          
          {/* Multi-scaffold per-item pricing (expert pricing requests) */}
          {hasExpertScaffolds ? (
            <div className="bg-white dark:bg-amber-900/50 rounded-lg p-4 border border-amber-200 dark:border-amber-600 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                  <Layers className="h-4 w-4" />
                  آیتم‌های داربست ({scaffoldEdits.length.toLocaleString('fa-IR')})
                </span>
                {isEditing ? (
                  <Button type="button" size="sm" variant="outline" onClick={addScaffoldItem} className="gap-1">
                    <Plus className="h-4 w-4" />
                    افزودن آیتم جدید
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-1">
                    <Edit className="h-4 w-4" />
                    ویرایش آیتم‌ها
                  </Button>
                )}
              </div>

              {scaffoldEdits.map((ed, i) => {
                const sc = ed.orig || {};
                const editableDims = ed.dimensions;
                const liveArea = isEditing ? calcDimsArea(editableDims) : calcScaffoldArea(sc);
                const liveUnit = isEditing ? dimsUnit(editableDims) : scaffoldAreaUnit(sc);
                const staticDims = Array.isArray(sc?.dimensions) ? sc.dimensions : [];
                const updateEd = (patch: Partial<ScaffoldEdit>) => {
                  const next = [...scaffoldEdits];
                  next[i] = { ...next[i], ...patch };
                  setScaffoldEdits(next);
                };
                const updateDim = (dIdx: number, key: keyof DimRow, val: string) => {
                  const dims = [...editableDims];
                  dims[dIdx] = { ...dims[dIdx], [key]: val };
                  updateEd({ dimensions: dims });
                };
                return (
                  <div key={i} className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {isEditing ? (
                        <Input
                          value={ed.label}
                          onChange={(e) => updateEd({ label: e.target.value })}
                          placeholder={`داربست ${i + 1}`}
                          className="text-sm font-bold max-w-[220px]"
                        />
                      ) : (
                        <Label className="text-sm font-bold">{ed.label || sc.label || `داربست ${i + 1}`}</Label>
                      )}
                      <div className="flex items-center gap-2">
                        {liveArea > 0 && (
                          <Badge variant="outline">
                            {liveArea.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} {liveUnit}
                          </Badge>
                        )}
                        {isEditing && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-muted-foreground"
                              onClick={() => duplicateScaffoldItem(i)}
                              title="کپی این آیتم"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeleteExpert(i)}
                              title="حذف این آیتم"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && confirmDeleteExpert === i && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
                        <span className="text-xs text-destructive font-medium">این آیتم حذف شود؟</span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-7"
                            onClick={() => { removeScaffoldItem(i); setConfirmDeleteExpert(null); }}
                          >
                            حذف
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setConfirmDeleteExpert(null)}>
                            انصراف
                          </Button>
                        </div>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">ابعاد (طول × عرض × ارتفاع)</Label>
                        {editableDims.length === 0 && (
                          <p className="text-xs text-muted-foreground">ابعادی ثبت نشده.</p>
                        )}
                        {editableDims.map((d, dIdx) => (
                          <div key={dIdx} className="flex gap-2 items-center">
                            <Input
                              value={d.length}
                              onChange={(e) => updateDim(dIdx, 'length', e.target.value)}
                              placeholder="طول"
                              dir="ltr"
                            />
                            <Input
                              value={d.width}
                              onChange={(e) => updateDim(dIdx, 'width', e.target.value)}
                              placeholder="عرض"
                              dir="ltr"
                            />
                            <Input
                              value={d.height}
                              onChange={(e) => updateDim(dIdx, 'height', e.target.value)}
                              placeholder="ارتفاع"
                              dir="ltr"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-9 px-2 text-destructive hover:text-destructive shrink-0"
                              onClick={() => updateEd({ dimensions: editableDims.filter((_, x) => x !== dIdx) })}
                              title="حذف این ردیف ابعاد"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => updateEd({ dimensions: [...editableDims, { length: '', width: '', height: '' }] })}
                          >
                            + افزودن بُعد
                          </Button>
                        </div>
                      </div>
                    ) : (
                      staticDims.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ابعاد: {staticDims.map((d: any) => `${d.length || 0}×${d.width || 0}×${d.height || 0}`).join(' ، ')} متر
                        </p>
                      )
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">توضیحات این آیتم</Label>
                      {isEditing ? (
                        <Textarea
                          value={ed.description}
                          onChange={(e) => updateEd({ description: e.target.value })}
                          placeholder="توضیحات داربست..."
                          rows={2}
                        />
                      ) : (
                        ed.description ? (
                          <p className="text-xs text-muted-foreground bg-background/60 p-2 rounded border">
                            📝 {ed.description}
                          </p>
                        ) : <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">قیمت کل این آیتم (تومان)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={scaffoldPrices[i] ? Number(scaffoldPrices[i]).toLocaleString('fa-IR') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value
                            .replace(/[^\d۰-۹]/g, '')
                            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                          const next = [...scaffoldPrices];
                          next[i] = rawValue;
                          setScaffoldPrices(next);
                        }}
                        placeholder="قیمت این آیتم"
                        dir="ltr"
                      />
                    </div>
                  </div>
                );
              })}



              {/* Grand Total + Save */}
              <div className="border-t pt-4">
                <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">
                  مجموع کل سفارش (تومان)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={paymentAmount ? Number(paymentAmount).toLocaleString('fa-IR') : ''}
                    readOnly
                    className="flex-1 text-lg font-bold"
                    dir="ltr"
                    placeholder="مجموع آیتم‌ها"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={saving || !paymentAmount || (!isPriceChanged && !isScaffoldPricesChanged && !isScaffoldEditsChanged)}
                    className={`bg-amber-600 hover:bg-amber-700 text-white px-6 ${
                      (!isPriceChanged && !isScaffoldPricesChanged && !isScaffoldEditsChanged) ? 'opacity-50 cursor-not-allowed hover:bg-amber-600' : ''
                    }`}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                    {(!isPriceChanged && !isScaffoldPricesChanged && !isScaffoldEditsChanged) ? 'ذخیره شده ✓' : 'ذخیره قیمت'}
                  </Button>
                </div>
              </div>
            </div>
          ) : isRentalExpertPricing ? (
            <div className="bg-white dark:bg-amber-900/50 rounded-lg p-4 border border-amber-200 dark:border-amber-600 space-y-4">
              {/* Item 1 */}
              {rentalItem1Name && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold">{rentalItem1Name}</Label>
                    <Badge variant="outline">تعداد: {rentalItem1Qty.toLocaleString('fa-IR')}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">قیمت واحد (تومان)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={rentalItem1UnitPrice ? Number(rentalItem1UnitPrice).toLocaleString('fa-IR') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value
                            .replace(/[^\d۰-۹]/g, '')
                            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                          setRentalItem1UnitPrice(rawValue);
                        }}
                        placeholder="قیمت واحد"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">قیمت کل آیتم (تومان)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={rentalItem1TotalPrice ? Number(rentalItem1TotalPrice).toLocaleString('fa-IR') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value
                            .replace(/[^\d۰-۹]/g, '')
                            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                          setRentalItem1TotalPrice(rawValue);
                          // Clear unit price since user is overriding
                          setRentalItem1UnitPrice('');
                        }}
                        placeholder="قیمت کل"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  {rentalItem1UnitPrice && parseFloat(rentalItem1UnitPrice) > 0 && rentalItem1Qty > 0 && (
                    <p className="text-xs text-muted-foreground">
                      محاسبه: {parseFloat(rentalItem1UnitPrice).toLocaleString('fa-IR')} × {rentalItem1Qty.toLocaleString('fa-IR')} = {(parseFloat(rentalItem1UnitPrice) * rentalItem1Qty).toLocaleString('fa-IR')} تومان
                    </p>
                  )}
                </div>
              )}

              {/* Item 2 */}
              {rentalItem2Name && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold">{rentalItem2Name}</Label>
                    <Badge variant="outline">تعداد: {rentalItem2Qty.toLocaleString('fa-IR')}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">قیمت واحد (تومان)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={rentalItem2UnitPrice ? Number(rentalItem2UnitPrice).toLocaleString('fa-IR') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value
                            .replace(/[^\d۰-۹]/g, '')
                            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                          setRentalItem2UnitPrice(rawValue);
                        }}
                        placeholder="قیمت واحد"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">قیمت کل آیتم (تومان)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={rentalItem2TotalPrice ? Number(rentalItem2TotalPrice).toLocaleString('fa-IR') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value
                            .replace(/[^\d۰-۹]/g, '')
                            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                          setRentalItem2TotalPrice(rawValue);
                          setRentalItem2UnitPrice('');
                        }}
                        placeholder="قیمت کل"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  {rentalItem2UnitPrice && parseFloat(rentalItem2UnitPrice) > 0 && rentalItem2Qty > 0 && (
                    <p className="text-xs text-muted-foreground">
                      محاسبه: {parseFloat(rentalItem2UnitPrice).toLocaleString('fa-IR')} × {rentalItem2Qty.toLocaleString('fa-IR')} = {(parseFloat(rentalItem2UnitPrice) * rentalItem2Qty).toLocaleString('fa-IR')} تومان
                    </p>
                  )}
                </div>
              )}

              {/* Grand Total + Save */}
              <div className="border-t pt-4">
                <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">
                  قیمت کل سفارش (تومان)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={paymentAmount ? Number(paymentAmount).toLocaleString('fa-IR') : ''}
                    onChange={(e) => {
                      const rawValue = e.target.value
                        .replace(/[^\d۰-۹]/g, '')
                        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                      setPaymentAmount(rawValue);
                    }}
                    placeholder="مجموع قیمت کل"
                    className="flex-1 text-lg font-bold"
                    dir="ltr"
                    readOnly
                  />
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || !paymentAmount || (!isPriceChanged && !isRentalPriceChanged)}
                    className={`bg-amber-600 hover:bg-amber-700 text-white px-6 ${
                      (!isPriceChanged && !isRentalPriceChanged) ? 'opacity-50 cursor-not-allowed hover:bg-amber-600' : ''
                    }`}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                    {(!isPriceChanged && !isRentalPriceChanged) ? 'ذخیره شده ✓' : 'ذخیره قیمت'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Display Total Area from Customer Form */}
              {expertPricingTotalMeasure > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 text-center">
                    <Ruler className="h-4 w-4 inline ml-1" />
                    متراژ کل: <span className="font-bold text-lg">{expertPricingTotalMeasure.toLocaleString('fa-IR')}</span> {expertPricingMeasureUnit}
                  </p>
                </div>
              )}
              
              {/* Unit Price Input for Expert Pricing */}
              <div className="bg-white dark:bg-amber-900/50 rounded-lg p-4 border border-amber-200 dark:border-amber-600 space-y-4">
                <div>
                  <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">
                    قیمت فی (تومان به ازای هر {expertPricingMeasureUnit})
                  </Label>
                  <Input 
                    type="text"
                    inputMode="numeric"
                    value={unitPrice ? Number(unitPrice).toLocaleString('fa-IR') : ''} 
                    onChange={(e) => {
                      const rawValue = e.target.value
                        .replace(/[^\d۰-۹]/g, '')
                        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                      setUnitPrice(rawValue);
                    }}
                    placeholder="قیمت فی را وارد کنید"
                    className="text-lg font-bold"
                    dir="ltr"
                  />
                  {unitPrice && parseFloat(unitPrice) > 0 && expertPricingTotalMeasure > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      محاسبه: {parseFloat(unitPrice).toLocaleString('fa-IR')} × {expertPricingTotalMeasure.toLocaleString('fa-IR')} = {(parseFloat(unitPrice) * expertPricingTotalMeasure).toLocaleString('fa-IR')} تومان
                    </p>
                  )}
                </div>
                
                <div className="border-t pt-4">
                  <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">
                    قیمت کل (تومان)
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      type="text"
                      inputMode="numeric"
                      value={paymentAmount ? Number(paymentAmount).toLocaleString('fa-IR') : ''} 
                      onChange={(e) => {
                        const rawValue = e.target.value
                          .replace(/[^\d۰-۹]/g, '')
                          .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                        setPaymentAmount(rawValue);
                      }}
                      placeholder="مبلغ کل را به تومان وارد کنید"
                      className="flex-1 text-lg font-bold"
                      dir="ltr"
                    />
                    <Button 
                      onClick={handleSave} 
                      disabled={saving || !paymentAmount || (!isPriceChanged && !isUnitPriceChanged)}
                      title={(!isPriceChanged && !isUnitPriceChanged) ? 'قیمت ذخیره شده است' : 'ذخیره قیمت'}
                      className={`bg-amber-600 hover:bg-amber-700 text-white px-6 ${
                        (!isPriceChanged && !isUnitPriceChanged) ? 'opacity-50 cursor-not-allowed hover:bg-amber-600' : ''
                      }`}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                      {(!isPriceChanged && !isUnitPriceChanged) ? 'ذخیره شده ✓' : 'ذخیره قیمت'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Price Status Card */}
          {paymentAmount && Number(paymentAmount) > 0 ? (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
              <p className="text-sm font-bold text-green-700 dark:text-green-400 text-center">
                قیمت ماه اول: {Number(basePriceNumber).toLocaleString('fa-IR')} تومان
                {isRentalExpertPricing && (
                  <span className="block text-xs font-normal mt-1">
                    {rentalItem1Name && rentalItem1TotalPrice ? `${rentalItem1Name}: ${Number(rentalItem1TotalPrice).toLocaleString('fa-IR')} تومان` : ''}
                    {rentalItem2Name && rentalItem2TotalPrice ? ` + ${rentalItem2Name}: ${Number(rentalItem2TotalPrice).toLocaleString('fa-IR')} تومان` : ''}
                  </span>
                )}
                {!isRentalExpertPricing && unitPrice && parseFloat(unitPrice) > 0 && (
                  <span className="block text-xs font-normal mt-1">
                    (قیمت فی: {parseFloat(unitPrice).toLocaleString('fa-IR')} تومان × {expertPricingTotalMeasure.toLocaleString('fa-IR')} {expertPricingMeasureUnit})
                  </span>
                )}
              </p>

              {(approvedRenewalCost > 0 || approvedRepairCost > 0 || displayAddOnsAmount > 0) && (
                <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800 text-center space-y-1">
                  {approvedRenewals.map((renewal: any) => (
                    <div key={renewal.renewal_number} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        تمدید ماه {renewal.renewal_number + 1}:{' '}
                        <span className="font-medium" dir="ltr">
                          {Number(renewal.renewal_price || 0).toLocaleString('fa-IR')}
                        </span>{' '}
                        تومان
                      </p>
                      {renewal.manager_notes && (
                        <p className="text-[11px] text-muted-foreground/90 italic px-2 leading-relaxed">
                          شرح: {renewal.manager_notes}
                        </p>
                      )}
                    </div>
                  ))}
                  {approvedRepairs.map((repair: any, idx: number) => (
                    <p key={repair.id || idx} className="text-xs text-muted-foreground">
                      هزینه تعمیر {(idx + 1).toLocaleString('fa-IR')}:{' '}
                      <span className="font-medium" dir="ltr">
                        {Number(repair.final_cost || 0).toLocaleString('fa-IR')}
                      </span>{' '}
                      تومان
                    </p>
                  ))}
                  <p className="text-base font-extrabold text-green-700 dark:text-green-300">
                    مبلغ کل سفارش: {Number(displayTotalOrderAmount).toLocaleString('fa-IR')} تومان
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 rounded-lg p-3">
              <p className="text-sm font-bold text-orange-700 dark:text-orange-400 text-center">
                در انتظار تعیین قیمت توسط مدیر
              </p>
            </div>
          )}

        </div>
      )}

      {/* Edit Toggle Button & Print */}
      <div className="flex justify-end gap-2 flex-wrap">
        <ManagerOrderInvoice order={order} hidePrice={hidePrice} />

        <InvoiceEmployerOverrideDialog
          orderId={order.id}
          currentCustomerName={order.customer_name}
          currentCustomerPhone={order.customer_phone}
          notes={order.notes}
          onUpdate={onUpdate}
        />

        
        {/* دکمه ویرایش کامل در فرم قیمت‌گذاری */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setExpertPricingEditOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
        >
          <ExternalLink className="h-4 w-4 ml-1" />
          ویرایش در فرم قیمت‌گزاری
        </Button>
        
        {/* دکمه ویرایش سریع در همین دیالوگ */}
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 ml-1" />
            ویرایش سریع
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
              ذخیره
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 ml-1" />
              انصراف
            </Button>
          </div>
        )}
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">نام مشتری</Label>
            {isEditing ? (
              <Input 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1"
              />
            ) : (
              <p className="font-medium">{order.customer_name || 'نامشخص'}</p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">شماره تماس</Label>
            {isEditing ? (
              <Input 
                value={customerPhone} 
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1"
                dir="ltr"
              />
            ) : (
              <p className="font-medium" dir="ltr">{order.customer_phone || '-'}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Address */}
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">آدرس</Label>
          {isEditing ? (
            <div className="space-y-2 mt-1">
              <Input 
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                placeholder="آدرس اصلی"
              />
              <Textarea 
                value={detailedAddress} 
                onChange={(e) => setDetailedAddress(e.target.value)}
                placeholder="جزئیات آدرس"
                rows={2}
              />
            </div>
          ) : (
            <>
              <p className="font-medium">{order.address || '-'}</p>
              {order.detailed_address && (
                <p className="text-sm text-muted-foreground">{order.detailed_address}</p>
              )}
            </>
          )}
        </div>
      </div>

      {order.created_at && (
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <Label className="text-xs text-muted-foreground">تاریخ ثبت</Label>
            <p className="font-medium">{formatPersianDate(order.created_at, { showDayOfWeek: true })}</p>
          </div>
        </div>
      )}

      <Separator />

      {/* Technical Details */}
      <div className="bg-muted/50 p-4 rounded-lg space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-semibold">مشخصات فنی</span>
        </div>

        {/* Rental Items Details - for direct rental orders (non-expert-pricing) */}
        {parsedNotes?.service_type === 'کرایه اجناس داربست' && !isExpertPricingRequest && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">نوع داربست</Label>
                <p className="font-medium">کرایه اجناس داربست</p>
              </div>
            </div>

            {/* Item 1 */}
            {parsedNotes?.item_type && (
              <div className="bg-background p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{parsedNotes.item_type}</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    تعداد: {Number(parsedNotes.quantity || 0).toLocaleString('fa-IR')} عدد
                  </span>
                </div>
                {/* Unit price: calculate from total/qty or use stored unit_price */}
                {(() => {
                  const qty = Number(parsedNotes.quantity || 0);
                  const total = Number(parsedNotes.total_price || 0);
                  const unitPrice = parsedNotes.unit_price || parsedNotes.item_1_unit_price || (qty > 0 && total > 0 ? Math.round(total / qty) : 0);
                  return unitPrice > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">قیمت واحد:</span>
                      <span className="font-medium">{Number(unitPrice).toLocaleString('fa-IR')} تومان</span>
                    </div>
                  ) : null;
                })()}
                {parsedNotes.total_price && (
                  <div className="flex justify-between text-sm border-t pt-1">
                    <span className="text-muted-foreground font-medium">مبلغ کل:</span>
                    <span className="font-bold text-primary">{Number(parsedNotes.total_price).toLocaleString('fa-IR')} تومان</span>
                  </div>
                )}
              </div>
            )}

            {/* Item 2 */}
            {parsedNotes?.item_type_2 && (
              <div className="bg-background p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{parsedNotes.item_type_2}</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    تعداد: {Number(parsedNotes.quantity_2 || 0).toLocaleString('fa-IR')} عدد
                  </span>
                </div>
              </div>
            )}

            {/* Rental Request Date */}
            {(parsedNotes?.rental_request_date || parsedNotes?.requested_date) && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-xs text-muted-foreground">تاریخ درخواست کرایه</Label>
                  <p className="font-medium">{formatPersianDate(parsedNotes.rental_request_date || parsedNotes.requested_date)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Multi-scaffolds (همزمان در یک مکان) full editor */}
        {hasMultiScaffolds && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                داربست‌های همزمان در یک مکان ({multiScaffoldsEdit.length.toLocaleString('fa-IR')} آیتم)
              </h4>
              {isEditing ? (
                <Button type="button" size="sm" variant="outline" onClick={addMultiScaffoldItem} className="gap-1">
                  <Plus className="h-4 w-4" />
                  افزودن آیتم جدید
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 ml-1" />
                  ویرایش آیتم‌ها
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {multiScaffoldsEdit.map((ed, i) => {
                const orig = ed.orig || {};
                const liveArea = isEditing ? calcDimsArea(ed.dimensions) : (orig.totalArea || calcDimsArea(ed.dimensions));
                const liveUnit = dimsUnit(ed.dimensions);
                const updateEd = (patch: Partial<MultiScaffoldEdit>) => {
                  const next = [...multiScaffoldsEdit];
                  next[i] = { ...next[i], ...patch };
                  setMultiScaffoldsEdit(next);
                };
                const updateDim = (dIdx: number, key: keyof DimRow, val: string) => {
                  const dims = [...ed.dimensions];
                  dims[dIdx] = { ...dims[dIdx], [key]: val };
                  updateEd({ dimensions: dims });
                };
                return (
                  <div key={i} className="bg-background p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {isEditing ? (
                        <Input
                          value={ed.label}
                          onChange={(e) => updateEd({ label: e.target.value })}
                          placeholder={`داربست #${i + 1}`}
                          className="text-sm font-bold max-w-[240px]"
                        />
                      ) : (
                        <Label className="text-sm font-bold">{ed.label || `داربست #${i + 1}`}</Label>
                      )}
                      <div className="flex items-center gap-2">
                        {liveArea > 0 && (
                          <Badge variant="outline">
                            {Number(liveArea).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} {liveUnit}
                          </Badge>
                        )}
                        {isEditing && (
                          <>
                            <Button
                              type="button" size="sm" variant="ghost"
                              className="h-8 px-2 text-muted-foreground"
                              onClick={() => duplicateMultiScaffoldItem(i)}
                              title="کپی این آیتم"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button" size="sm" variant="ghost"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeleteMulti(i)}
                              title="حذف این آیتم"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && confirmDeleteMulti === i && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
                        <span className="text-xs text-destructive font-medium">این آیتم حذف شود؟</span>
                        <div className="flex gap-2">
                          <Button
                            type="button" size="sm" variant="destructive" className="h-7"
                            onClick={() => { removeMultiScaffoldItem(i); setConfirmDeleteMulti(null); }}
                          >
                            حذف
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setConfirmDeleteMulti(null)}>
                            انصراف
                          </Button>
                        </div>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">ابعاد (طول × عرض × ارتفاع)</Label>
                        {ed.dimensions.length === 0 && (
                          <p className="text-xs text-muted-foreground">ابعادی ثبت نشده.</p>
                        )}
                        {ed.dimensions.map((d, dIdx) => (
                          <div key={dIdx} className="flex gap-2 items-center">
                            <Input value={d.length} onChange={(e) => updateDim(dIdx, 'length', e.target.value)} placeholder="طول" dir="ltr" />
                            <Input value={d.width} onChange={(e) => updateDim(dIdx, 'width', e.target.value)} placeholder="عرض" dir="ltr" />
                            <Input value={d.height} onChange={(e) => updateDim(dIdx, 'height', e.target.value)} placeholder="ارتفاع" dir="ltr" />
                            <Button
                              type="button" size="sm" variant="ghost"
                              className="h-9 px-2 text-destructive hover:text-destructive shrink-0"
                              onClick={() => updateEd({ dimensions: ed.dimensions.filter((_, x) => x !== dIdx) })}
                              title="حذف این ردیف ابعاد"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline"
                            onClick={() => updateEd({ dimensions: [...ed.dimensions, { length: '', width: '', height: '' }] })}>
                            + افزودن بُعد
                          </Button>
                        </div>
                      </div>
                    ) : (
                      ed.dimensions.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ابعاد: {ed.dimensions.map(d => `${d.length || 0}×${d.width || 0}×${d.height || 0}`).join(' ، ')} متر
                        </p>
                      )
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">توضیحات این آیتم</Label>
                      {isEditing ? (
                        <Textarea
                          value={ed.description}
                          onChange={(e) => updateEd({ description: e.target.value })}
                          placeholder="توضیحات داربست..."
                          rows={2}
                        />
                      ) : (
                        ed.description ? (
                          <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border">📝 {ed.description}</p>
                        ) : <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>

                    {!hidePrice && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">قیمت کل این آیتم (تومان)</Label>
                        {isEditing ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={ed.finalPrice ? Number(ed.finalPrice).toLocaleString('fa-IR') : ''}
                            onChange={(e) => {
                              const raw = e.target.value
                                .replace(/[^\d۰-۹]/g, '')
                                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                              updateEd({ finalPrice: raw });
                            }}
                            placeholder="قیمت این آیتم"
                            dir="ltr"
                          />
                        ) : (
                          <p className="font-medium">{ed.finalPrice ? Number(ed.finalPrice).toLocaleString('fa-IR') : '-'} تومان</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {multiScaffoldsEdit.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">هیچ آیتمی باقی نمانده است.</p>
              )}
            </div>

            {isEditing && (
              <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                {!hidePrice && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-blue-800 dark:text-blue-200">مجموع کل آیتم‌ها</span>
                    <span className="text-lg font-bold">{(multiScaffoldsEdit.reduce((s, it) => s + (parseFloat(it.finalPrice) || 0), 0)).toLocaleString('fa-IR')} تومان</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !isMultiScaffoldsChanged}
                    className="flex-1 gap-1"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isMultiScaffoldsChanged ? 'ذخیره آیتم‌ها' : 'ذخیره شده ✓'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={saving} className="gap-1">
                    <X className="h-4 w-4" />
                    انصراف
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Standard Scaffolding Type (non-rental) */}
        {parsedNotes?.service_type !== 'کرایه اجناس داربست' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">نوع داربست</Label>
            {isEditing ? (
              <Select value={scaffoldingType} onValueChange={setScaffoldingType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="انتخاب نوع" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(scaffoldingTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="font-medium">{scaffoldingTypeLabels[scaffoldingType] || scaffoldingType || '-'}</p>
            )}
          </div>
          
          {ceilingSubtype && (
            <div>
              <Label className="text-xs text-muted-foreground">زیرنوع</Label>
              <p className="font-medium">{ceilingSubtypeLabels[ceilingSubtype] || ceilingSubtype}</p>
            </div>
          )}
        </div>
        )} {/* end non-rental scaffolding type */}

        {/* Dimensions (read-only for now) */}
        {dimensions && Array.isArray(dimensions) && dimensions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">ابعاد</Label>
            </div>
            <div className="grid gap-2">
              {dimensions.map((dim: any, idx: number) => (
                <div key={idx} className="bg-background p-2 rounded border text-sm">
                  طول: {dim.length || dim.l || '-'} × عرض: {dim.width || dim.w || '-'} × ارتفاع: {dim.height || dim.h || '-'} متر
                  {dim.unitCount && <span className="text-muted-foreground"> ({dim.unitCount} یونیت)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {dimensions && !Array.isArray(dimensions) && (
          <div className="bg-background p-2 rounded border text-sm">
            <Ruler className="h-4 w-4 inline mr-1 text-muted-foreground" />
            طول: {dimensions.length || '-'} × عرض: {dimensions.width || '-'} × ارتفاع: {dimensions.height || '-'} متر
          </div>
        )}

        {(() => {
          const dims = parsedNotes?.dimensions;
          const { total, unit } = calculateTotalFromDimensions(dims, parsedNotes?.columnHeight);
          const displayTotal = total > 0 ? total : totalArea;
          if (!displayTotal) return null;
          return (
            <div>
              <Label className="text-xs text-muted-foreground">مساحت کل</Label>
              <p className="font-medium">{parseFloat(Number(displayTotal).toFixed(2))} {total > 0 ? unit : 'متر مربع'}</p>
            </div>
          );
        })()}
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">شرح محل نصب و نوع فعالیت</Label>
        </div>
        {isEditing ? (
          <Textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="شرح توضیحات..."
          />
        ) : (
          description && <p className="text-sm bg-muted/50 p-3 rounded-lg">{description}</p>
        )}
      </div>

      {/* Conditions - Detailed */}
      {parsedNotes?.conditions && (
        <div className="bg-muted/30 p-4 rounded-lg space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            شرایط اجرا و محل پروژه
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {parsedNotes.conditions.rentalMonthsPlan && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">پلان اجاره</span>
                <span className="font-medium text-sm">
                  {parsedNotes.conditions.rentalMonthsPlan === '1' && 'به شرط یک ماه'}
                  {parsedNotes.conditions.rentalMonthsPlan === '2' && 'به شرط دو ماه'}
                  {parsedNotes.conditions.rentalMonthsPlan === '3+' && 'به شرط سه ماه و بیشتر'}
                </span>
              </div>
            )}
            {parsedNotes.conditions.totalMonths && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">مدت قرارداد</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.totalMonths} ماه</span>
              </div>
            )}
            {parsedNotes.conditions.distanceRange && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">فاصله از قم</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.distanceRange} کیلومتر</span>
              </div>
            )}
            {parsedNotes.onGround !== undefined && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">محل نصب داربست</span>
                <span className="font-medium text-sm flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  {parsedNotes.onGround ? 'روی زمین' : 'روی سکو / پشت‌بام / بالکن'}
                </span>
              </div>
            )}
            {!parsedNotes.onGround && parsedNotes.conditions?.platformHeight && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">ارتفاع پای کار</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.platformHeight} متر</span>
              </div>
            )}
            {parsedNotes.vehicleReachesSite !== undefined && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">دسترسی خودرو</span>
                <span className="font-medium text-sm flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {parsedNotes.vehicleReachesSite ? 'خودرو به محل می‌رسد' : 'خودرو به محل نمی‌رسد'}
                </span>
              </div>
            )}
            {!parsedNotes.vehicleReachesSite && parsedNotes.conditions?.vehicleDistance && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">فاصله خودرو تا محل</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.vehicleDistance} متر</span>
              </div>
            )}
            {parsedNotes.isFacadeWidth2m !== undefined && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">عرض داربست نما</span>
                <span className="font-medium text-sm">{parsedNotes.isFacadeWidth2m ? '2 متر' : '1 متر'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location Purpose */}
      {parsedNotes?.locationPurpose && (
        <div className="bg-muted/30 p-4 rounded-lg">
          <Label className="text-xs text-muted-foreground mb-2 block">شرح محل نصب و فعالیت</Label>
          <p className="text-sm leading-relaxed">{parsedNotes.locationPurpose}</p>
        </div>
      )}

      {/* Important Dates */}
      {(parsedNotes?.installDate || parsedNotes?.dueDate || parsedNotes?.installationDateTime || order.execution_start_date) && (
        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Calendar className="h-4 w-4" />
            تاریخ‌های مهم سفارش
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {parsedNotes?.installDate && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ نصب پیشنهادی</span>
                <span className="font-bold text-sm">
                  {parsedNotes.installDate.includes('T') || parsedNotes.installDate.includes('-')
                    ? formatPersianDateTime(parsedNotes.installDate)
                    : parsedNotes.installDate}
                </span>
              </div>
            )}
            {parsedNotes?.installationDateTime && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">زمان نصب درخواستی</span>
                <span className="font-bold text-sm">
                  {parsedNotes.installationDateTime.includes('T') || parsedNotes.installationDateTime.includes('-')
                    ? formatPersianDateTime(parsedNotes.installationDateTime)
                    : parsedNotes.installationDateTime}
                </span>
              </div>
            )}
            {parsedNotes?.dueDate && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">سررسید قرارداد</span>
                <span className="font-bold text-sm">
                  {parsedNotes.dueDate.includes('T') || parsedNotes.dueDate.includes('-')
                    ? formatPersianDate(parsedNotes.dueDate)
                    : parsedNotes.dueDate}
                </span>
              </div>
            )}
            {order.execution_start_date && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ شروع اجرا</span>
                <span className="font-bold text-sm">{formatPersianDate(order.execution_start_date)}</span>
              </div>
            )}
            {order.execution_end_date && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ پایان اجرا</span>
                <span className="font-bold text-sm">{formatPersianDate(order.execution_end_date)}</span>
              </div>
            )}
            {order.rental_start_date && (
              <div className="p-3 bg-white dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                <span className="text-xs text-green-600 dark:text-green-400 block mb-1">تاریخ شروع کرایه داربست</span>
                <span className="font-bold text-sm">{formatPersianDate(order.rental_start_date)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Price - Only show for non-expert pricing requests, as expert pricing has input at top */}
      {/* Also hide if hidePrice is true (for executive managers in scaffold with materials module) */}
      {/* ===== قیمت‌گذاری خدمات سفارشی (تعداد / متراژ / حجم / وزن / طول) ===== */}
      {isCustomService && !hidePrice && (
        <div className="p-4 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 space-y-4">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-amber-600" />
            <Label className="text-sm font-bold text-amber-800 dark:text-amber-200">قیمت‌گذاری خدمات سفارشی</Label>
          </div>

          {/* مقادیر ثبت‌شده توسط مشتری */}
          <div className="flex flex-wrap gap-2">
            {customBasisOptions
              .filter(o => o.value !== 'fixed' && o.measure > 0)
              .map(o => (
                <Badge key={o.value} variant="outline">
                  {o.label.replace('بر اساس ', '')}: {o.measure.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} {o.unit}
                </Badge>
              ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">مبنای قیمت‌گذاری</Label>
              <select
                value={customBasis}
                onChange={(e) => setCustomBasis(e.target.value as CustomBasis)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {customBasisOptions.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}{o.value !== 'fixed' && o.measure > 0 ? ` (${o.measure.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} ${o.unit})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {customBasis !== 'fixed' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  قیمت فی (تومان به ازای هر {activeCustomBasis.unit})
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={customUnitPrice ? Number(customUnitPrice).toLocaleString('fa-IR') : ''}
                  onChange={(e) => {
                    const rawValue = e.target.value
                      .replace(/[^\d۰-۹]/g, '')
                      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                    setCustomUnitPrice(rawValue);
                  }}
                  placeholder="قیمت فی"
                  dir="ltr"
                />
              </div>
            )}
          </div>

          {customBasis !== 'fixed' && activeCustomBasis.measure <= 0 && (
            <p className="text-xs text-orange-600 dark:text-orange-400">
              مقدار «{activeCustomBasis.label.replace('بر اساس ', '')}» در سفارش ثبت نشده است؛ مبلغ کل را دستی وارد کنید یا مبلغ مقطوع را انتخاب کنید.
            </p>
          )}

          {customComputedTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              محاسبه: {parseLocalizedNumber(customUnitPrice).toLocaleString('fa-IR')} × {activeCustomBasis.measure.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} {activeCustomBasis.unit} = {customComputedTotal.toLocaleString('fa-IR')} تومان
            </p>
          )}

          <div className="border-t pt-3">
            <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">مبلغ کل سفارش (تومان)</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={paymentAmount ? Number(paymentAmount).toLocaleString('fa-IR') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value
                    .replace(/[^\d۰-۹]/g, '')
                    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                  setPaymentAmount(rawValue);
                }}
                placeholder="مبلغ کل را وارد کنید"
                className="flex-1 text-lg font-bold"
                dir="ltr"
                readOnly={customComputedTotal > 0}
              />
              <Button
                onClick={handleSave}
                disabled={saving || !paymentAmount || (!isPriceChanged && !isCustomPricingChanged)}
                className={`bg-amber-600 hover:bg-amber-700 text-white px-6 ${(!isPriceChanged && !isCustomPricingChanged) ? 'opacity-50 cursor-not-allowed hover:bg-amber-600' : ''}`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                {(!isPriceChanged && !isCustomPricingChanged) ? 'ذخیره شده ✓' : 'ذخیره قیمت'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* تخفیف مدیریتی */}
      {!hidePrice && (
        <OrderDiscountPanel
          orderId={order.id}
          currentPrice={Number(order.payment_amount || order.total_price || 0)}
          priceBeforeDiscount={order.price_before_discount ?? null}
          discountAmount={order.discount_amount ?? 0}
          discountNote={order.discount_note ?? null}
          onUpdate={onUpdate}
        />
      )}

      {!isExpertPricingRequest && !isCustomService && !hidePrice && (


        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-4 w-4 text-green-600" />
            <Label className="text-sm font-medium">مبلغ سفارش</Label>
          </div>
          
          {isEditing ? (
            <Input 
              type="number"
              value={paymentAmount} 
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="مبلغ به تومان"
              className="mt-1"
            />
          ) : (
            <>
              {(order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price) && (
                <>
                  <p className="font-bold text-xl text-green-700 dark:text-green-300">
                    {Number(
                      (order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price || 0) + approvedRepairCost
                    ).toLocaleString('fa-IR')} تومان
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>هزینه قرارداد:</span>
                      <span>{Number(order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price).toLocaleString('fa-IR')} تومان</span>
                    </div>
                    {approvedRepairs.map((repair: any, idx: number) => (
                      <div key={repair.id || idx} className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          هزینه تعمیر {(idx + 1).toLocaleString('fa-IR')}:
                        </span>
                        <span>{Number(repair.final_cost || 0).toLocaleString('fa-IR')} تومان</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {parsedNotes?.price_breakdown && parsedNotes.price_breakdown.length > 0 && (() => {
                const fixedBase = Number(order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price || 0);
                const adjusted = applyFixedPriceToBreakdown(parsedNotes.price_breakdown, fixedBase);
                return (
                <div className="mt-3 space-y-1">
                  <Label className="text-xs text-muted-foreground">جزئیات محاسبه قیمت</Label>
                  {adjusted.map((item: string, idx: number) => (
                    <div key={idx} className="text-xs text-muted-foreground p-2 bg-background rounded border">{item}</div>
                  ))}
                </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      <Separator />

      {/* مراحل پیشرفت سفارش */}
      <OrderTimeline
        orderStatus={order.status || 'pending'}
        createdAt={order.created_at || new Date().toISOString()}
        approvedAt={order.approved_at || undefined}
        executionStartDate={order.execution_start_date || undefined}
        executionEndDate={order.execution_end_date || undefined}
        customerCompletionDate={order.customer_completion_date || undefined}
        rejectionReason={order.rejection_reason || undefined}
        executionStage={order.execution_stage}
        executionStageUpdatedAt={order.execution_stage_updated_at}
        approvedCollectionDate={approvedCollectionDate}
        approvals={orderApprovals}
        totalPaid={order.total_paid}
        totalPrice={order.total_price || order.payment_amount}
      />

      {/* زنجیره انتقال و همکاری بین مدیران */}
      <ManagerOwnershipChain
        orderId={order.id}
        executedBy={order.executed_by || undefined}
        approvedBy={order.approved_by || undefined}
      />

      {/* زنجیره مالکیت و همکاری مشتریان */}
      <CustomerOwnershipChain
        orderId={order.id}
        currentOwnerId={order.customer_id || ''}
        ownerName={order.customer_name}
        ownerPhone={order.customer_phone}
        transferredFromUserId={order.transferred_from_user_id || undefined}
        transferredFromPhone={order.transferred_from_phone || undefined}
      />

      {/* لیست همکاران سفارش - قابل مشاهده برای مدیران */}
      <OrderCollaboratorsList orderId={order.id} showForManagers={true} />

      {/* Media Section with separate images/videos and upload/delete for managers */}
      <OrderMediaSection 
        orderId={order.id} 
        canUpload={true} 
        canDelete={true} 
        onMediaChange={onUpdate} 
      />

      {/* Call History */}
      <CallHistory orderId={order.id} />

      {/* Chat with customer */}
      <Separator />
      <OrderChat orderId={order.id} orderStatus={order.status || 'pending'} />

      {/* Repair, Collection & Renewal Requests Section for Managers */}
      <Separator />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => setRepairDialogOpen(true)}
        >
          <Wrench className="h-4 w-4" />
          نیاز به تعمیر داربست
        </Button>
        {['completed', 'paid'].includes(order.status || '') && (
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setCollectionDialogOpen(true)}
            disabled={!order.rental_start_date || !order.customer_completion_date}
            title={!order.rental_start_date ? 'ابتدا تاریخ شروع کرایه را ثبت کنید' : !order.customer_completion_date ? 'ابتدا تاریخ جمع‌آوری را ثبت کنید' : ''}
          >
            <Calendar className="h-4 w-4" />
            درخواست جمع‌آوری
          </Button>
        )}
        {/* دکمه تمدید سفارش - برای سفارش‌های اجرا شده یا در حال اجرا با تاریخ شروع کرایه */}
        {(['in_progress', 'completed', 'paid'].includes(order.status || '') || order.rental_start_date) && (
          <Button 
            variant="outline" 
            className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => setRenewalDialogOpen(true)}
            disabled={!order.rental_start_date}
            title={!order.rental_start_date ? 'ابتدا تاریخ شروع کرایه را ثبت کنید' : 'درخواست تمدید سفارش برای ماه بعدی'}
          >
            <RefreshCw className="h-4 w-4" />
            تمدید سفارش
          </Button>
        )}
      </div>

      {/* Repair Request Dialog - Manager Mode */}
      <RepairRequestDialog
        open={repairDialogOpen}
        onOpenChange={setRepairDialogOpen}
        orderId={order.id}
        orderCode={order.code}
        customerId={order.customer_id || ''}
        isManager={true}
        onRepairCostChange={onUpdate}
      />

      {/* Collection Request Dialog */}
      <CollectionRequestDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        orderId={order.id}
        orderCode={order.code}
        customerId={order.customer_id || ''}
      />

      {/* Renewal Dialog - Manager Mode with approval capability */}
      <ManagerRenewalDialog
        open={renewalDialogOpen}
        onOpenChange={setRenewalDialogOpen}
        orderId={order.id}
        orderCode={order.code}
        customerId={order.customer_id || ''}
        rentalStartDate={order.rental_start_date || null}
        originalPrice={order.payment_amount || order.total_price || 0}
        onRenewalComplete={onUpdate}
      />

      {/* Expert Pricing Edit Dialog */}
      <ExpertPricingEditDialog
        open={expertPricingEditOpen}
        onOpenChange={setExpertPricingEditOpen}
        order={{
          id: order.id,
          code: order.code,
          address: order.address,
          detailed_address: order.detailed_address,
          notes: order.notes,
          subcategory: order.subcategory
        }}
        onSuccess={onUpdate}
      />
    </div>
  );
};

export default EditableOrderDetails;
