import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle, XCircle, Mail, Phone, MapPin, Calendar, User } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Contractor {
  id: string;
  user_id: string;
  company_name: string;
  contact_person: string;
  phone_number: string;
  email: string;
  address: string | null;
  experience_years: number | null;
  description: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminContractors() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      // Admin can view all contractors (approved and unapproved)
      const { data, error } = await supabase
        .from('contractors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContractors(data || []);
    } catch (error: any) {
      console.error('Error fetching contractors:', error);
      toast({
        title: 'خطا در دریافت لیست پیمانکاران',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (contractor: Contractor, approve: boolean) => {
    try {
      const { error } = await supabase
        .from('contractors')
        .update({ is_approved: approve })
        .eq('id', contractor.id);

      if (error) throw error;

      toast({
        title: approve ? 'پیمانکار تأیید شد' : 'پیمانکار رد شد',
        description: `پیمانکار ${contractor.company_name} ${approve ? 'تأیید' : 'رد'} شد.`,
      });

      // Refresh the list
      fetchContractors();
    } catch (error: any) {
      console.error('Error updating contractor:', error);
      toast({
        title: 'خطا در به‌روزرسانی',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSelectedContractor(null);
      setActionType(null);
    }
  };

  const openConfirmDialog = (contractor: Contractor, type: 'approve' | 'reject') => {
    setSelectedContractor(contractor);
    setActionType(type);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingContractors = contractors.filter(c => !c.is_approved);
  const approvedContractors = contractors.filter(c => c.is_approved);

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">مدیریت پیمانکاران</h1>
        <p className="text-muted-foreground">
          مدیریت و تأیید پیمانکاران ثبت‌نام شده
        </p>
      </div>

      {/* Pending Contractors */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Badge variant="outline" className="text-lg py-1 px-3">
            {pendingContractors.length}
          </Badge>
          پیمانکاران در انتظار تأیید
        </h2>
        
        {pendingContractors.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">هیچ پیمانکاری در انتظار تأیید نیست.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {pendingContractors.map((contractor) => (
              <ContractorCard
                key={contractor.id}
                contractor={contractor}
                onApprove={() => openConfirmDialog(contractor, 'approve')}
                onReject={() => openConfirmDialog(contractor, 'reject')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Approved Contractors */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Badge variant="default" className="text-lg py-1 px-3 bg-green-500">
            {approvedContractors.length}
          </Badge>
          پیمانکاران تأیید شده
        </h2>
        
        {approvedContractors.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">هیچ پیمانکار تأیید شده‌ای وجود ندارد.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {approvedContractors.map((contractor) => (
              <ContractorCard
                key={contractor.id}
                contractor={contractor}
                onReject={() => openConfirmDialog(contractor, 'reject')}
                showApproved
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedContractor && !!actionType} onOpenChange={() => {
        setSelectedContractor(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' ? 'تأیید پیمانکار' : 'رد پیمانکار'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئن هستید که می‌خواهید پیمانکار{' '}
              <strong>{selectedContractor?.company_name}</strong> را{' '}
              {actionType === 'approve' ? 'تأیید' : 'رد'} کنید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedContractor && handleApproveReject(selectedContractor, actionType === 'approve')}
            >
              تأیید
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ContractorCardProps {
  contractor: Contractor;
  onApprove?: () => void;
  onReject?: () => void;
  showApproved?: boolean;
}

function ContractorCard({ contractor, onApprove, onReject, showApproved }: ContractorCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {contractor.company_name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {contractor.contact_person}
            </CardDescription>
          </div>
          {showApproved && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 ml-1" />
              تأیید شده
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Contact Information (Only visible to admin) */}
        <div className="space-y-2 pb-3 border-b">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${contractor.phone_number}`} className="text-primary hover:underline">
              {contractor.phone_number}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a href={`mailto:${contractor.email}`} className="text-primary hover:underline">
              {contractor.email}
            </a>
          </div>
        </div>

        {contractor.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{contractor.address}</span>
          </div>
        )}
        
        {contractor.experience_years && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {contractor.experience_years} سال سابقه کار
            </span>
          </div>
        )}

        {contractor.description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mt-3">
            {contractor.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3">
          {onApprove && (
            <Button
              onClick={onApprove}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              <CheckCircle className="h-4 w-4 ml-2" />
              تأیید
            </Button>
          )}
          {onReject && (
            <Button
              onClick={onReject}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 ml-2" />
              رد
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
