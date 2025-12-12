-- Create project_collaborators table for sharing entire projects
CREATE TABLE public.project_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects_hierarchy(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL,
  invitee_user_id UUID,
  invitee_phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, invitee_phone_number)
);

-- Enable RLS
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own invitations (as inviter or invitee)
CREATE POLICY "Users can view own project collaborations"
ON public.project_collaborators
FOR SELECT
USING (
  auth.uid() = inviter_user_id OR 
  auth.uid() = invitee_user_id OR
  invitee_phone_number IN (SELECT phone_number FROM profiles WHERE user_id = auth.uid())
);

-- Policy: Users can create invitations for their own projects
CREATE POLICY "Users can invite to own projects"
ON public.project_collaborators
FOR INSERT
WITH CHECK (
  auth.uid() = inviter_user_id AND
  EXISTS (SELECT 1 FROM projects_hierarchy WHERE id = project_id AND user_id = auth.uid())
);

-- Policy: Invitees can update their invitation status
CREATE POLICY "Invitees can respond to invitations"
ON public.project_collaborators
FOR UPDATE
USING (
  auth.uid() = invitee_user_id OR
  invitee_phone_number IN (SELECT phone_number FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  auth.uid() = invitee_user_id OR
  invitee_phone_number IN (SELECT phone_number FROM profiles WHERE user_id = auth.uid())
);

-- Policy: Inviters can delete their invitations
CREATE POLICY "Inviters can delete invitations"
ON public.project_collaborators
FOR DELETE
USING (auth.uid() = inviter_user_id);

-- Policy: Managers can view all project collaborations
CREATE POLICY "Managers can view all project collaborations"
ON public.project_collaborators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'ceo', 'general_manager', 'sales_manager', 'scaffold_executive_manager')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_project_collaborators_updated_at
BEFORE UPDATE ON public.project_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_project_collaborators_project_id ON public.project_collaborators(project_id);
CREATE INDEX idx_project_collaborators_invitee_phone ON public.project_collaborators(invitee_phone_number);
CREATE INDEX idx_project_collaborators_invitee_user ON public.project_collaborators(invitee_user_id);