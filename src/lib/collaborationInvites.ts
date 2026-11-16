import { supabase } from '@/integrations/supabase/client';

import { isPendingInviteStatus } from '@/lib/collaborationInviteStatus';

export { isPendingInviteStatus };

export interface PendingCollaborationInvite {
  id: string;
  order_id: string;
  inviter_user_id: string;
  status: string;
  invited_at: string;
  can_view_financials: boolean | null;
  can_manage_order: boolean | null;
  collaborator_name: string | null;
  collaborator_role: string | null;
  inviter_name: string | null;
  inviter_phone: string | null;
}

/** All of the signed-in user's collaboration invitations still waiting for their own answer. */
export async function fetchMyPendingCollaborationInvites(): Promise<PendingCollaborationInvite[]> {
  const { data, error } = await supabase.rpc('get_my_pending_collaboration_invites' as any);
  if (error) throw error;
  return ((data as any[]) || []).filter((r) => isPendingInviteStatus(r.status)) as PendingCollaborationInvite[];
}

interface AcceptInput {
  inviteId: string;
  orderId: string;
  inviterUserId: string;
  userId: string;
}

/**
 * Accept an invitation: give the collaborator their own copy of the address/project
 * (so the order appears under their projects), then mark the invitation accepted.
 */
export async function acceptCollaborationInvite({ inviteId, orderId, inviterUserId, userId }: AcceptInput) {
  const { data: order } = await supabase
    .from('projects_v3')
    .select('code, address, province_id, district_id, subcategory_id, location_lat, location_lng, subcategories:subcategory_id (service_type_id)')
    .eq('id', orderId)
    .maybeSingle();

  const code = (order as any)?.code || '';
  const serviceTypeId = (order as any)?.subcategories?.service_type_id;

  let locationId: string | null = null;
  if (order?.location_lat && order?.location_lng && order?.address) {
    const { data: loc, error } = await supabase
      .from('locations')
      .insert({
        user_id: userId,
        address_line: order.address,
        lat: order.location_lat,
        lng: order.location_lng,
        province_id: order.province_id || null,
        district_id: order.district_id || null,
        title: `آدرس مشترک - سفارش #${code}`,
        is_active: true,
      })
      .select('id')
      .single();
    if (error) console.error('Error creating collaborator location:', error);
    else locationId = loc?.id ?? null;
  }

  if (locationId && serviceTypeId && order?.subcategory_id) {
    const { error } = await supabase.from('projects_hierarchy').insert({
      user_id: userId,
      location_id: locationId,
      service_type_id: serviceTypeId,
      subcategory_id: order.subcategory_id,
      title: `پروژه مشترک - سفارش #${code}`,
      status: 'active',
    });
    if (error) console.error('Error creating collaborator project:', error);
  }

  const { error } = await supabase
    .from('order_collaborators')
    .update({ status: 'accepted', invitee_user_id: userId, responded_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw error;

  await supabase.from('notifications').insert({
    user_id: inviterUserId,
    title: 'دعوت همکاری پذیرفته شد',
    body: `دعوت همکاری شما برای سفارش #${code} پذیرفته شد.`,
    type: 'success',
    link: `/user/orders/${orderId}`,
  });
}

export async function rejectCollaborationInvite({ inviteId, orderId, inviterUserId, userId }: AcceptInput, orderCode?: string) {
  const { error } = await supabase
    .from('order_collaborators')
    .update({ status: 'rejected', invitee_user_id: userId, responded_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw error;

  await supabase.from('notifications').insert({
    user_id: inviterUserId,
    title: 'دعوت همکاری رد شد',
    body: `دعوت همکاری شما برای سفارش #${orderCode || ''} رد شد.`,
    type: 'info',
    link: `/user/orders/${orderId}`,
  });
}
