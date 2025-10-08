import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Package } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';

interface ProjectCardProps {
  project: {
    id: string;
    project_name: string;
    service_type: string;
    location_address: string;
    status: string;
    created_at: string;
    service_requests_count: number;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  const serviceTypeLabel = project.service_type === 'scaffolding' 
    ? 'داربست فلزی' 
    : 'چادر برزنتی';

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] duration-200"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline">{serviceTypeLabel}</Badge>
              <StatusBadge status={project.status} />
            </div>
            <CardTitle className="text-xl">{project.project_name}</CardTitle>
            <CardDescription className="mt-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {new Date(project.created_at).toLocaleDateString('fa-IR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </CardDescription>
          </div>
          
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {project.service_requests_count} درخواست
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{project.location_address || 'بدون آدرس'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
