import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStaffWhitelist } from '@/hooks/useStaffWhitelist';
import { useStaffProfile } from '@/hooks/useStaffProfile';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface StaffRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  scaffold_worker: 'نیروی داربست',
  scaffold_supervisor: 'سرپرست داربست',
  operations_manager: 'مدیر اجرایی',
  finance_manager: 'مدیر مالی',
  sales_manager: 'مدیر فروش',
  support_manager: 'مدیر پشتیبانی',
  general_manager: 'مدیریت کل',
  warehouse_manager: 'مدیر انبار',
  security_manager: 'مدیر حراست',
};

// تعریف ساختار لیست‌های کشویی پرسنل
type PersonnelStructure = {
  [category: string]: {
    [subcategory: string]: string[];
  };
};

const PERSONNEL_STRUCTURE: PersonnelStructure = {
  'پرسنل اهرم': {
    'کارمندان': ['مدیر اجرایی', 'حسابدار', 'مدیر فروش', 'حراست', 'پشتیبانی', 'مدیریت', 'انبار دار'],
    'نیروها': [],
  },
  'خدمات داربست': {
    'نیروی داربست فلزی': [],
    'سرپرست داربست': [],
  },
};

const PROVINCES = ['کل ایران', 'استان قم'];

export const StaffRequestDialog = ({ open, onOpenChange }: StaffRequestDialogProps) => {
  const { allowedRole } = useStaffWhitelist();
  const { staffProfile, requestRole, refetch } = useStaffProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [province, setProvince] = useState('');
  const [staffCategory, setStaffCategory] = useState('');
  const [staffSubcategory, setStaffSubcategory] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!allowedRole) return;

    // اعتبارسنجی فیلدهای اجباری
    if (!province) {
      toast({
        title: 'خطا',
        description: 'لطفاً محل خدمات را انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    if (!staffCategory || !staffSubcategory) {
      toast({
        title: 'خطا',
        description: 'لطفاً نوع پرسنل را کامل انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await requestRole(allowedRole, {
      province,
      staff_category: staffCategory,
      staff_subcategory: staffSubcategory,
      staff_position: staffPosition || undefined,
      description: description || undefined,
    });

    if (error) {
      toast({
        title: 'خطا',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'موفق',
        description: 'درخواست شما با موفقیت ثبت شد و در انتظار تأیید مدیریت کل است.',
      });
      refetch();
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const renderContent = () => {
    if (staffProfile?.status === 'pending') {
      return (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            درخواست شما برای نقش <strong>{ROLE_LABELS[staffProfile.requested_role]}</strong> در
            انتظار تأیید مدیریت کل است.
          </AlertDescription>
        </Alert>
      );
    }

    if (staffProfile?.status === 'rejected') {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              درخواست قبلی شما رد شده است.
              {staffProfile.rejection_reason && (
                <p className="mt-2">
                  <strong>دلیل:</strong> {staffProfile.rejection_reason}
                </p>
              )}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            لطفاً با پشتیبانی تماس بگیرید.
          </p>
        </div>
      );
    }

    if (staffProfile?.status === 'approved') {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            شما به عنوان <strong>{ROLE_LABELS[staffProfile.requested_role]}</strong> تأیید شده‌اید.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          شمارهٔ موبایل شما در لیست پرسنل مجاز ثبت شده است. لطفاً اطلاعات زیر را تکمیل کنید.
        </p>
        
        <div className="rounded-lg border p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">نقش مجاز شما:</p>
          <Badge variant="secondary" className="text-base">
            {allowedRole && ROLE_LABELS[allowedRole]}
          </Badge>
        </div>

        {/* محل خدمات */}
        <div className="space-y-2">
          <Label htmlFor="province">محل خدمات *</Label>
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger id="province">
              <SelectValue placeholder="انتخاب استان" />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map((prov) => (
                <SelectItem key={prov} value={prov}>
                  {prov}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* نوع پرسنل - سطح اول */}
        <div className="space-y-2">
          <Label htmlFor="category">نوع پرسنل *</Label>
          <Select 
            value={staffCategory} 
            onValueChange={(value) => {
              setStaffCategory(value);
              setStaffSubcategory('');
              setStaffPosition('');
            }}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="انتخاب دسته" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PERSONNEL_STRUCTURE).map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* نوع پرسنل - سطح دوم */}
        {staffCategory && (
          <div className="space-y-2">
            <Label htmlFor="subcategory">زیرگروه *</Label>
            <Select 
              value={staffSubcategory} 
              onValueChange={(value) => {
                setStaffSubcategory(value);
                setStaffPosition('');
              }}
            >
              <SelectTrigger id="subcategory">
                <SelectValue placeholder="انتخاب زیرگروه" />
              </SelectTrigger>
              <SelectContent>
                {staffCategory && Object.keys(PERSONNEL_STRUCTURE[staffCategory] || {}).map((subcategory) => (
                  <SelectItem key={subcategory} value={subcategory}>
                    {subcategory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* نوع پرسنل - سطح سوم (فقط برای کارمندان) */}
        {staffCategory && staffSubcategory && 
         PERSONNEL_STRUCTURE[staffCategory]?.[staffSubcategory]?.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="position">سمت *</Label>
            <Select value={staffPosition} onValueChange={setStaffPosition}>
              <SelectTrigger id="position">
                <SelectValue placeholder="انتخاب سمت" />
              </SelectTrigger>
              <SelectContent>
                {PERSONNEL_STRUCTURE[staffCategory][staffSubcategory].map((position: string) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* توضیحات */}
        <div className="space-y-2">
          <Label htmlFor="description">توضیحات</Label>
          <Textarea
            id="description"
            placeholder="توضیحات تکمیلی خود را وارد کنید..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <Alert>
          <AlertDescription>
            پس از ثبت درخواست، مدیریت کل آن را بررسی و تأیید خواهد کرد. پس از تأیید، به امکانات مربوط به نقش خود دسترسی خواهید داشت.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const canSubmit = allowedRole && (!staffProfile || staffProfile.status === 'rejected');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>درخواست نقش سازمانی</DialogTitle>
          <DialogDescription>
            ثبت درخواست برای دریافت دسترسی به سیستم به عنوان پرسنل
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderContent()}</div>

        <DialogFooter>
          {canSubmit ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                انصراف
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'در حال ارسال...' : 'ثبت درخواست'}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>بستن</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
