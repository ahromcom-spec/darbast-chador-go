/** Invitation states in which the invitee may preview the order (read-only) and accept/reject it. */
export const PENDING_INVITE_STATUSES = ['pending', 'manager_approved', 'pending_registration'] as const;

export const isPendingInviteStatus = (status?: string | null): boolean =>
  !!status && (PENDING_INVITE_STATUSES as readonly string[]).includes(status);
