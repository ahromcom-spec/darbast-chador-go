-- Create a table to manage module assignments to staff
CREATE TABLE public.module_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    module_key TEXT NOT NULL,
    module_name TEXT NOT NULL,
    assigned_phone_number TEXT NOT NULL,
    assigned_user_id UUID,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(module_key, assigned_phone_number)
);

-- Enable Row Level Security
ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- CEOs can view all module assignments
CREATE POLICY "CEOs can view all module assignments" 
ON public.module_assignments 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'ceo'
    )
);

-- CEOs can insert module assignments
CREATE POLICY "CEOs can insert module assignments" 
ON public.module_assignments 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'ceo'
    )
);

-- CEOs can update module assignments
CREATE POLICY "CEOs can update module assignments" 
ON public.module_assignments 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'ceo'
    )
);

-- CEOs can delete module assignments
CREATE POLICY "CEOs can delete module assignments" 
ON public.module_assignments 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'ceo'
    )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_module_assignments_updated_at
BEFORE UPDATE ON public.module_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_module_assignments_phone ON public.module_assignments(assigned_phone_number);
CREATE INDEX idx_module_assignments_module ON public.module_assignments(module_key);