import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileHeaderProps {
  user: SupabaseUser;
  fullName: string;
  roles?: string[];
}

export function ProfileHeader({ user, fullName, roles = [] }: ProfileHeaderProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl">{fullName || 'کاربر'}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1" dir="ltr">
              {user.email}
            </p>
          </div>
          {roles.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
