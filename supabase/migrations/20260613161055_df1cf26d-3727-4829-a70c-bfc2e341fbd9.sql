CREATE INDEX IF NOT EXISTS idx_order_collaborators_invitee_user_status_order
ON public.order_collaborators (invitee_user_id, status, order_id);

CREATE INDEX IF NOT EXISTS idx_order_collaborators_invitee_phone_status_order
ON public.order_collaborators (invitee_phone_number, status, order_id);

CREATE INDEX IF NOT EXISTS idx_order_transfer_requests_to_user_status_order
ON public.order_transfer_requests (to_user_id, status, order_id);

CREATE INDEX IF NOT EXISTS idx_order_transfer_requests_to_phone_status_order
ON public.order_transfer_requests (to_phone_number, status, order_id);

CREATE INDEX IF NOT EXISTS idx_projects_v3_customer_visible
ON public.projects_v3 (customer_id, is_archived, is_deep_archived, hierarchy_project_id);