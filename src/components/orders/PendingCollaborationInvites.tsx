import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Check, X, Eye, Package, MapPin, Calendar, Loader2, Phone, Ruler, Banknote, FileText, ChevronDown, ChevronUp, BadgeCheck, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { OrderMediaPreview } from '@/components/profile/OrderMediaPreview';
import { acceptCollaborationInvite, fetchMyPendingCollaborationInvites, rejectCollaborationInvite } from '@/lib/collaborationInvites';

interface CollaborationInvite {
  id: string;
  order_id: string;
  inviter_user_id: string;
  status: string;
  invited_at: string;
  inviter_name?: string;
  inviter_phone?: string;
  order_code?: string;
  order_address?: string;
  order_status?: string;
  subcategory_name?: string;
  // Additional order details for hierarchy creation
  hierarchy_project_id?: string;
  province_id?: string;
  district_id?: string;
  subcategory_id?: string;
  service_type_id?: string;
  location_lat?: number;
  location_lng?: number;
  // New detailed fields
  order_notes?: any;
  payment_amount?: number;
  total_price?: number;
  total_paid?: number;
  can_view_financials?: boolean;
  detailed_address?: string;
  province_name?: string;
  description?: string;
  collaborator_name?: string | null;
  collaborator_role?: string | null;
  can_manage_order?: boolean;
}

export function PendingCollaborationInvites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<CollaborationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedInvites, setExpandedInvites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    if (!user) return;

    try {
      const collaborations = await fetchMyPendingCollaborationInvites();

      if (collaborations.length === 0) {
        setInvites([]);
        return;
      }

      const enrichedInvites = await Promise.all(
        collaborations.map(async (collab) => {
          // مدعو پس از تایید مدیریت اجازه مشاهده (فقط خواندنی) سفارش را دارد
          const { data: order } = await supabase
            .from('projects_v3')
            .select(`
              code,
              address,
              detailed_address,
              status,
              hierarchy_project_id,
              province_id,
              district_id,
              subcategory_id,
              location_lat,
              location_lng,
              notes,
              payment_amount,
              total_price,
              total_paid,
              subcategories:subcategory_id (name, service_type_id),
              provinces:province_id (name)
            `)
            .eq('id', collab.order_id)
            .maybeSingle();

          let parsedNotes: any = null;
          try {
            if (order?.notes) {
              parsedNotes = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
              if (typeof parsedNotes === 'string') parsedNotes = JSON.parse(parsedNotes);
            }
          } catch (e) {
            console.error('Error parsing order notes:', e);
          }

          return {
            id: collab.id,
            order_id: collab.order_id,
            inviter_user_id: collab.inviter_user_id,
            status: collab.status,
            invited_at: collab.invited_at,
            collaborator_name: collab.collaborator_name,
            collaborator_role: collab.collaborator_role,
            can_manage_order: collab.can_manage_order === true,
            inviter_name: collab.inviter_name || 'نامشخص',
            inviter_phone: collab.inviter_phone || '',
            order_code: order?.code || '',
            order_address: order?.address || '',
            order_status: order?.status || '',
            subcategory_name: (order?.subcategories as any)?.name || '',
            hierarchy_project_id: order?.hierarchy_project_id || '',
            province_id: order?.province_id || '',
            district_id: order?.district_id || '',
            subcategory_id: order?.subcategory_id || '',
            service_type_id: (order?.subcategories as any)?.service_type_id || '',
            location_lat: order?.location_lat || null,
            location_lng: order?.location_lng || null,
            order_notes: parsedNotes,
            can_view_financials: collab.can_view_financials !== false,
            payment_amount: order?.payment_amount || null,
            total_price: (order as any)?.total_price || null,
            total_paid: (order as any)?.total_paid || null,
            detailed_address: order?.detailed_address || '',
            province_name: (order?.provinces as any)?.name || '',
            description:
              parsedNotes?.additional_notes ||
              parsedNotes?.description ||
              parsedNotes?.activityDescription ||
              parsedNotes?.installationDescription ||
              parsedNotes?.location_description ||
              parsedNotes?.locationPurpose ||
              parsedNotes?.serviceDescription ||
              '',
          } as CollaborationInvite;
        })
      );

      setInvites(enrichedInvites);
    } catch (error) {
      console.error('Error fetching collaboration invites:', error);
      toast.error('خطا در دریافت دعوت‌نامه‌های همکاری');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invite: CollaborationInvite) => {
    if (!user) return;
    setProcessingId(invite.id);
    try {
      await acceptCollaborationInvite({
        inviteId: invite.id,
        orderId: invite.order_id,
        inviterUserId: invite.inviter_user_id,
        userId: user.id,
      });
      toast.success('دعوت همکاری با موفقیت پذیرفته شد. سفارش به لیست سفارشات شما اضافه شد.');
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (error) {
      console.error('Error accepting collaboration:', error);
      toast.error('خطا در پذیرش دعوت همکاری');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invite: CollaborationInvite) => {
    if (!user) return;
    setProcessingId(invite.id);
    try {
      await rejectCollaborationInvite({
        inviteId: invite.id,
        orderId: invite.order_id,
        inviterUserId: invite.inviter_user_id,
        userId: user.id,
      }, invite.order_code);
      toast.success('دعوت همکاری رد شد');
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (error) {
      console.error('Error rejecting collaboration:', error);
      toast.error('خطا در رد دعوت همکاری');
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpand = (inviteId: string) => {
    setExpandedInvites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(inviteId)) {
        newSet.delete(inviteId);
      } else {
        newSet.add(inviteId);
      }
      return newSet;
    });
  };

  // Helper to extract dimensions from notes
  const getDimensionsText = (notes: any): string | null => {
    if (!notes) return null;
    
    const dimensions = notes.dimensions || [];
    if (dimensions.length > 0) {
      return dimensions.map((d: any, i: number) => 
        `${d.length || 0}×${d.width || 0}×${d.height || 0} متر`
      ).join(' | ');
    }
    
    if (notes.length || notes.width || notes.height) {
      return `${notes.length || 0}×${notes.width || 0}×${notes.height || 0} متر`;
    }
    
    return null;
  };

  if (loading) {
    return null;
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-primary">
          <Users className="h-5 w-5" />
          دعوت‌نامه‌های همکاری در انتظار
          <Badge variant="secondary" className="mr-auto">
            {invites.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => {
          const isExpanded = expandedInvites.has(invite.id);
          const dimensionsText = getDimensionsText(invite.order_notes);
          
          return (
            <div
              key={invite.id}
              className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
            >
              {/* Header with order code and actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  {/* Order Code */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="default" className="text-base px-3 py-1">
                      سفارش #{invite.order_code || '—'}
                    </Badge>
                    {invite.collaborator_role && (
                      <Badge variant="secondary" className="gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {invite.collaborator_role} سفارش
                        {invite.collaborator_name ? ` — ${invite.collaborator_name}` : ''}
                      </Badge>
                    )}
                    {invite.can_view_financials && (
                      <Badge variant="outline" className="text-xs">دسترسی به مبالغ و پرداخت</Badge>
                    )}
                  </div>


                  {/* Service Type */}
                  {invite.subcategory_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{invite.subcategory_name}</span>
                    </div>
                  )}

                  {/* Province & Address */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col">
                      {invite.province_name && (
                        <span className="font-medium">{invite.province_name}</span>
                      )}
                      {invite.order_address && (
                        <span className="line-clamp-2">{invite.order_address}</span>
                      )}
                    </div>
                  </div>

                  {/* Inviter Info with Phone - Highlighted */}
                  <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md">
                    <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium">
                      درخواست‌کننده: {invite.inviter_name}
                    </span>
                    {invite.inviter_phone && (
                      <Badge variant="outline" className="mr-1">
                        {invite.inviter_phone}
                      </Badge>
                    )}
                  </div>

                  {/* Invite Date */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      تاریخ دعوت: {new Date(invite.invited_at).toLocaleDateString('fa-IR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* مبلغ سفارش - فقط اگر همکار دسترسی مالی داشته باشد */}
                  {invite.can_view_financials && ((invite.total_price && invite.total_price > 0) || (invite.payment_amount && invite.payment_amount > 0)) ? (
                    <div className="flex items-center gap-2 text-sm bg-green-500/10 p-2 rounded-md border border-green-500/30">
                      <Banknote className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="font-medium">مبلغ سفارش:</span>
                      <span className="text-green-700 font-bold">
                        {(invite.total_price || invite.payment_amount || 0).toLocaleString('fa-IR')} تومان
                      </span>
                      {invite.total_paid && invite.total_paid > 0 && (
                        <span className="text-xs text-muted-foreground mr-auto">
                          پرداختی: {invite.total_paid.toLocaleString('fa-IR')}
                        </span>
                      )}
                    </div>
                  ) : null}


                  {/* توضیحات سفارش - همیشه قابل مشاهده قبل از پذیرش/رد */}
                  {invite.description && (
                    <div className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded-md">
                      <FileText className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <div>
                        <span className="font-medium">توضیحات سفارش: </span>
                        <span className="text-muted-foreground">{invite.description}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1"
                      onClick={() => handleAccept(invite)}
                      disabled={processingId === invite.id}
                    >
                      {processingId === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      پذیرش
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => handleReject(invite)}
                      disabled={processingId === invite.id}
                    >
                      <X className="h-4 w-4" />
                      رد
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => navigate(`/user/orders/${invite.order_id}`)}
                  >
                    <Eye className="h-4 w-4" />
                    مشاهده کامل سفارش
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs"
                    onClick={() => toggleExpand(invite.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        بستن جزئیات
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        مشاهده جزئیات
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Expanded Details */}
              <Collapsible open={isExpanded}>
                <CollapsibleContent className="mt-4 pt-4 border-t border-border space-y-3">
                  {/* Dimensions */}
                  {dimensionsText && (
                    <div className="flex items-start gap-2 text-sm">
                      <Ruler className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">ابعاد: </span>
                        <span className="text-muted-foreground">{dimensionsText}</span>
                      </div>
                    </div>
                  )}

                  {/* Total Area */}
                  {invite.order_notes?.total_area && (
                    <div className="flex items-center gap-2 text-sm">
                      <Ruler className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">مساحت کل: </span>
                      <span className="text-muted-foreground">
                        {invite.order_notes.total_area} متر مربع
                      </span>
                    </div>
                  )}

                  {/* Payment Amount */}
                  {invite.can_view_financials && invite.payment_amount && invite.payment_amount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Banknote className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="font-medium text-foreground">مبلغ سفارش: </span>
                      <span className="text-green-600 font-bold">
                        {invite.payment_amount.toLocaleString('fa-IR')} تومان
                      </span>
                    </div>
                  )}

                  {/* Detailed Address */}
                  {invite.detailed_address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">آدرس دقیق: </span>
                        <span className="text-muted-foreground">{invite.detailed_address}</span>
                      </div>
                    </div>
                  )}

                  {/* Activity Description */}
                  {invite.order_notes?.location_description && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">توضیحات محل: </span>
                        <span className="text-muted-foreground">{invite.order_notes.location_description}</span>
                      </div>
                    </div>
                  )}

                  {/* Additional Notes */}
                  {invite.order_notes?.additional_notes && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">توضیحات اضافی: </span>
                        <span className="text-muted-foreground">{invite.order_notes.additional_notes}</span>
                      </div>
                    </div>
                  )}

                  {/* Scaffold Type */}
                  {invite.order_notes?.scaffold_type && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">نوع داربست: </span>
                      <span className="text-muted-foreground">{invite.order_notes.scaffold_type}</span>
                    </div>
                  )}

                  {/* Service Type from Notes */}
                  {invite.order_notes?.service_type && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">نوع خدمت: </span>
                      <span className="text-muted-foreground">{invite.order_notes.service_type}</span>
                    </div>
                  )}

                  {/* Contact Phone from Notes */}
                  {invite.order_notes?.contact_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-foreground">شماره تماس: </span>
                      <Badge variant="outline">{invite.order_notes.contact_phone}</Badge>
                    </div>
                  )}

                  {/* عکس‌ها و فیلم‌های سفارش */}
                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        عکس‌ها و فیلم‌های سفارش
                      </div>
                      <OrderMediaPreview orderId={invite.order_id} pageSize={6} />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
