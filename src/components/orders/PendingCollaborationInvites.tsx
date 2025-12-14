import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Check, X, Package, MapPin, Calendar, Loader2, Phone, Ruler, Banknote, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  detailed_address?: string;
  province_name?: string;
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
      // Get user's phone number
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.phone_number) {
        setInvites([]);
        setLoading(false);
        return;
      }

      // Fetch pending collaboration invites for this user
      const { data: collaborations, error } = await supabase
        .from('order_collaborators')
        .select(`
          id,
          order_id,
          inviter_user_id,
          status,
          invited_at
        `)
        .or(`invitee_user_id.eq.${user.id},invitee_phone_number.eq.${profile.phone_number}`)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) throw error;

      if (!collaborations || collaborations.length === 0) {
        setInvites([]);
        setLoading(false);
        return;
      }

      // Fetch additional details for each invite
      const enrichedInvites = await Promise.all(
        collaborations.map(async (collab) => {
          // Get inviter profile
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('full_name, phone_number')
            .eq('user_id', collab.inviter_user_id)
            .maybeSingle();

          // Get order details with hierarchy info
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
              subcategories:subcategory_id (name, service_type_id),
              provinces:province_id (name)
            `)
            .eq('id', collab.order_id)
            .maybeSingle();

          // Parse notes for dimensions
          let parsedNotes: any = null;
          try {
            if (order?.notes) {
              if (typeof order.notes === 'string') {
                parsedNotes = JSON.parse(order.notes);
                if (typeof parsedNotes === 'string') {
                  parsedNotes = JSON.parse(parsedNotes);
                }
              } else {
                parsedNotes = order.notes;
              }
            }
          } catch (e) {
            console.error('Error parsing order notes:', e);
          }

          return {
            ...collab,
            inviter_name: inviterProfile?.full_name || 'نامشخص',
            inviter_phone: inviterProfile?.phone_number || '',
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
            payment_amount: order?.payment_amount || null,
            detailed_address: order?.detailed_address || '',
            province_name: (order?.provinces as any)?.name || '',
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
      // Step 1: Create a location for the collaborator user
      let locationId: string | null = null;
      
      if (invite.location_lat && invite.location_lng && invite.order_address) {
        // Create location for collaborator
        const { data: newLocation, error: locationError } = await supabase
          .from('locations')
          .insert({
            user_id: user.id,
            address_line: invite.order_address,
            lat: invite.location_lat,
            lng: invite.location_lng,
            province_id: invite.province_id || null,
            district_id: invite.district_id || null,
            title: `آدرس مشترک - سفارش #${invite.order_code}`,
            is_active: true,
          })
          .select('id')
          .single();

        if (locationError) {
          console.error('Error creating location for collaborator:', locationError);
        } else {
          locationId = newLocation?.id;
        }
      }

      // Step 2: Create projects_hierarchy for the collaborator if we have location
      let hierarchyId: string | null = null;
      
      if (locationId && invite.service_type_id && invite.subcategory_id) {
        const { data: newHierarchy, error: hierarchyError } = await supabase
          .from('projects_hierarchy')
          .insert({
            user_id: user.id,
            location_id: locationId,
            service_type_id: invite.service_type_id,
            subcategory_id: invite.subcategory_id,
            title: `پروژه مشترک - سفارش #${invite.order_code}`,
            status: 'active',
          })
          .select('id')
          .single();

        if (hierarchyError) {
          console.error('Error creating hierarchy for collaborator:', hierarchyError);
        } else {
          hierarchyId = newHierarchy?.id;
        }
      }

      // Step 3: Update collaboration status to accepted
      const { error } = await supabase
        .from('order_collaborators')
        .update({
          status: 'accepted',
          invitee_user_id: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (error) throw error;

      // Step 4: Send notification to inviter
      await supabase.from('notifications').insert({
        user_id: invite.inviter_user_id,
        title: 'دعوت همکاری پذیرفته شد',
        body: `دعوت همکاری شما برای سفارش #${invite.order_code} پذیرفته شد.`,
        type: 'success',
        link: `/user/orders/${invite.order_id}`,
      });

      toast.success('دعوت همکاری با موفقیت پذیرفته شد. سفارش به لیست سفارشات شما اضافه شد.');
      
      // Remove from list
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
      const { error } = await supabase
        .from('order_collaborators')
        .update({
          status: 'rejected',
          invitee_user_id: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (error) throw error;

      // Send notification to inviter
      await supabase.from('notifications').insert({
        user_id: invite.inviter_user_id,
        title: 'دعوت همکاری رد شد',
        body: `دعوت همکاری شما برای سفارش #${invite.order_code} رد شد.`,
        type: 'info',
        link: `/user/orders/${invite.order_id}`,
      });

      toast.success('دعوت همکاری رد شد');
      
      // Remove from list
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
                      سفارش #{invite.order_code}
                    </Badge>
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
                  {invite.payment_amount && invite.payment_amount > 0 && (
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
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
