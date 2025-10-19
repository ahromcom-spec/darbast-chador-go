import { useState } from 'react';
import { useLocations } from '@/hooks/useLocations';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { useOrders, OrderStatus } from '@/hooks/useOrders';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, ChevronDown, ChevronLeft, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MyOrders() {
  const { locations, loading: locationsLoading } = useLocations();
  const { projects, loading: projectsLoading } = useProjectsHierarchy();
  const { orders, loading: ordersLoading } = useOrders();
  
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');

  const loading = locationsLoading || projectsLoading || ordersLoading;

  const toggleLocation = (locationId: string) => {
    const newSet = new Set(expandedLocations);
    if (newSet.has(locationId)) {
      newSet.delete(locationId);
    } else {
      newSet.add(locationId);
    }
    setExpandedLocations(newSet);
  };

  const toggleProject = (projectId: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    setExpandedProjects(newSet);
  };

  const getStatusBadge = (status: OrderStatus) => {
    const statusMap: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'پیش‌نویس', variant: 'outline' },
      pending: { label: 'در انتظار', variant: 'secondary' },
      priced: { label: 'قیمت‌گذاری شده', variant: 'default' },
      confirmed: { label: 'تایید شده', variant: 'default' },
      scheduled: { label: 'زمان‌بندی شده', variant: 'default' },
      in_progress: { label: 'در حال اجرا', variant: 'default' },
      done: { label: 'انجام شده', variant: 'default' },
      canceled: { label: 'لغو شده', variant: 'destructive' }
    };
    const { label, variant } = statusMap[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  // Group orders by location and project
  const groupedData = locations.map(location => {
    const locationProjects = projects.filter(p => p.location_id === location.id);
    const projectsWithOrders = locationProjects.map(project => {
      const projectOrders = orders.filter(o => o.project_id === project.id);
      return { ...project, orders: projectOrders };
    }).filter(p => p.orders.length > 0);
    
    return {
      location,
      projects: projectsWithOrders
    };
  }).filter(loc => loc.projects.length > 0);

  // Apply filters
  const filteredData = groupedData
    .filter(loc => filterLocation === 'all' || loc.location.id === filterLocation)
    .map(loc => ({
      ...loc,
      projects: loc.projects.map(proj => ({
        ...proj,
        orders: proj.orders.filter(order => 
          filterStatus === 'all' || order.status === filterStatus
        )
      })).filter(proj => proj.orders.length > 0)
    }))
    .filter(loc => loc.projects.length > 0);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <PageHeader
        title="سفارشات من"
        description="مشاهده و مدیریت سفارشات به تفکیک آدرس و پروژه"
      />

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-6">
        <div>
          <label className="text-sm font-medium mb-2 block">فیلتر بر اساس آدرس</label>
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger>
              <SelectValue placeholder="همه آدرس‌ها" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه آدرس‌ها</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.title || loc.address_line}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">فیلتر بر اساس وضعیت</label>
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as OrderStatus | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="همه وضعیت‌ها" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="pending">در انتظار</SelectItem>
              <SelectItem value="priced">قیمت‌گذاری شده</SelectItem>
              <SelectItem value="confirmed">تایید شده</SelectItem>
              <SelectItem value="in_progress">در حال اجرا</SelectItem>
              <SelectItem value="done">انجام شده</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Hierarchical View */}
      {filteredData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">هیچ سفارشی یافت نشد</h3>
            <p className="text-muted-foreground">
              {filterStatus !== 'all' || filterLocation !== 'all'
                ? 'فیلترهای دیگری را امتحان کنید'
                : 'هنوز سفارشی ثبت نکرده‌اید'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredData.map(({ location, projects }) => (
            <Card key={location.id}>
              <CardHeader 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleLocation(location.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedLocations.has(location.id) ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                    <MapPin className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        {location.title || 'آدرس پروژه'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {location.address_line}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{projects.length} پروژه</Badge>
                </div>
              </CardHeader>

              {expandedLocations.has(location.id) && (
                <CardContent className="pt-0">
                  <div className="space-y-3 pr-8">
                    {projects.map(project => (
                      <Card key={project.id} className="shadow-sm">
                        <CardHeader 
                          className="cursor-pointer hover:bg-accent/30 transition-colors pb-3"
                          onClick={() => toggleProject(project.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {expandedProjects.has(project.id) ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                              )}
                              <div>
                                <h4 className="font-semibold">{project.title}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {project.service_types_v3?.name} • {project.subcategories?.name}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline">{project.orders.length} سفارش</Badge>
                          </div>
                        </CardHeader>

                        {expandedProjects.has(project.id) && (
                          <CardContent className="pt-0">
                            <div className="space-y-2 pr-7">
                              {project.orders.map(order => (
                                <Card key={order.id} className="shadow-none border-l-4 border-l-primary">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          {getStatusBadge(order.status)}
                                          <span className="text-xs text-muted-foreground">
                                            {new Date(order.created_at).toLocaleDateString('fa-IR')}
                                          </span>
                                        </div>
                                        {order.price && (
                                          <p className="text-sm font-semibold">
                                            قیمت: {order.price.toLocaleString('fa-IR')} تومان
                                          </p>
                                        )}
                                        {order.notes && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {order.notes}
                                          </p>
                                        )}
                                      </div>
                                      <Button variant="outline" size="sm">
                                        جزئیات
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
