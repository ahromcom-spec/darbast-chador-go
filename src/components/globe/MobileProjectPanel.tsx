import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Plus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';

interface HierarchyMedia {
  id: string;
  file_path: string;
  file_type: string;
  mime_type?: string;
  created_at: string;
}

interface ProjectOrder {
  id: string;
  code: string;
  status: string;
  address: string;
  created_at: string;
  approved_at?: string | null;
  subcategory?: { name: string; code: string };
  media?: HierarchyMedia[];
}

interface ProjectData {
  id: string;
  title?: string | null;
  location_id?: string;
  locations?: {
    title?: string | null;
    address_line?: string;
    lat?: number;
    lng?: number;
  } | null;
  orders?: ProjectOrder[];
}

interface MobileProjectPanelProps {
  project: ProjectData;
  onClose: () => void;
  onDeleteOrder: (orderId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onAddMedia: (orderId: string) => void;
  onViewImage: (images: string[], index: number) => void;
  onViewVideo: (url: string) => void;
}

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'در انتظار تایید',
    approved: 'تایید شده',
    in_progress: 'در حال اجرا',
    completed: 'تکمیل شده',
    cancelled: 'لغو شده',
    awaiting_payment: 'در انتظار پرداخت',
    order_executed: 'سفارش اجرا شده',
    awaiting_collection: 'در انتظار جمع‌آوری',
    in_collection: 'در حال جمع‌آوری',
    collected: 'جمع‌آوری شده',
  };
  return statusMap[status] || status;
};

const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
    awaiting_payment: 'bg-orange-100 text-orange-800',
    order_executed: 'bg-purple-100 text-purple-800',
    awaiting_collection: 'bg-indigo-100 text-indigo-800',
    in_collection: 'bg-cyan-100 text-cyan-800',
    collected: 'bg-teal-100 text-teal-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
};

export function MobileProjectPanel({
  project,
  onClose,
  onDeleteOrder,
  onDeleteProject,
  onAddMedia,
  onViewImage,
  onViewVideo,
}: MobileProjectPanelProps) {
  const navigate = useNavigate();
  const [mediaIndexes, setMediaIndexes] = useState<Record<string, number>>({});

  const getMediaIndex = (orderId: string) => mediaIndexes[orderId] || 0;

  const setMediaIndex = (orderId: string, index: number) => {
    setMediaIndexes(prev => ({ ...prev, [orderId]: index }));
  };

  const getPublicUrl = (filePath: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // استفاده از bucket صحیح project-media (همان bucket که در HybridGlobe استفاده می‌شود)
    return `${supabaseUrl}/storage/v1/object/public/project-media/${filePath}`;
  };

  const handleViewOrderDetail = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  const orders = project.orders || [];
  const hasOrders = orders.length > 0;

  return (
    <div className="fixed inset-0 z-[100000] bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="bg-white/20 hover:bg-white/40 text-white h-14 w-14 rounded-full shadow-lg border-2 border-white/50"
          >
            <X className="h-8 w-8" strokeWidth={3} />
          </Button>
          <div className="flex-1 text-center px-2 min-w-0">
            <h2 className="text-base font-bold leading-tight break-words">
              {project.title || 'پروژه'}
            </h2>
            {project.locations?.title && (
              <p className="text-sm opacity-90 mt-1">
                {project.locations.title}
              </p>
            )}
          </div>
          <div className="w-12" /> {/* Spacer for centering */}
        </div>
        {project.locations?.address_line && (
          <p className="text-xs opacity-80 mt-2 text-center">
            {project.locations.address_line}
          </p>
        )}
      </div>

      {/* دکمه افزودن خدمات جدید - بیرون از کادر سفارشات قبل از ScrollArea با خط اتصال به نقطه قرمز */}
      {hasOrders && project.location_id && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-muted/30 to-muted/10">
          {/* نقطه قرمز */}
          <div className="flex items-center gap-0">
            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-red-200 shadow-[0_0_8px_rgba(239,68,68,0.5)] flex-shrink-0" />
            {/* خط اتصال */}
            <div className="w-6 h-0.5 bg-gradient-to-r from-red-500 to-purple-600" />
          </div>
          {/* دکمه */}
          <Button
            variant="outline"
            className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white border-none hover:from-purple-600 hover:to-violet-700 shadow-lg py-3 text-sm font-semibold"
            onClick={() => navigate('/user/service-selection', {
              state: {
                fromMap: true,
                locationId: project.location_id,
                returnToMap: true
              }
            })}
          >
            🆕 افزودن خدمات جدید (نوع دیگر)
          </Button>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 pb-8">
          {hasOrders ? (
            orders.map((order) => {
              const allMedia = (order.media || []).sort((a, b) => {
                if (a.file_type === 'image' && b.file_type === 'video') return -1;
                if (a.file_type === 'video' && b.file_type === 'image') return 1;
                return 0;
              });
              const currentIndex = getMediaIndex(order.id);
              const totalMedia = allMedia.length;

              return (
                <div
                  key={order.id}
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
                >
                  {/* Order Header */}
                  <div className="p-3 bg-muted/50 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{order.code}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.subcategory?.name && (
                        <span className="text-xs text-primary font-medium">
                          {order.subcategory.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Media Gallery */}
                  <div className="relative aspect-video bg-muted">
                    {totalMedia > 0 ? (
                      <>
                        {allMedia.map((media, idx) => {
                          const url = getPublicUrl(media.file_path);
                          const isVisible = idx === currentIndex;
                          const isVideo = media.file_type === 'video';

                          if (!isVisible) return null;

                          return isVideo ? (
                            <div
                              key={media.id}
                              className="absolute inset-0 flex items-center justify-center bg-black cursor-pointer"
                              onClick={() => onViewVideo(url)}
                            >
                              <video
                                src={url}
                                className="w-full h-full object-cover"
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                                  <svg className="w-8 h-8 text-primary ml-1" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </div>
                              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                ویدیو
                              </span>
                            </div>
                          ) : (
                            <img
                              key={media.id}
                              src={url}
                              alt="تصویر سفارش"
                              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                              onClick={() => {
                                const imageUrls = allMedia
                                  .filter(m => m.file_type === 'image')
                                  .map(m => getPublicUrl(m.file_path));
                                const imageIndex = allMedia
                                  .filter(m => m.file_type === 'image')
                                  .findIndex(m => m.id === media.id);
                                onViewImage(imageUrls, imageIndex >= 0 ? imageIndex : 0);
                              }}
                            />
                          );
                        })}

                        {/* Navigation Arrows */}
                        {totalMedia > 1 && (
                          <>
                            <button
                              onClick={() => setMediaIndex(order.id, (currentIndex - 1 + totalMedia) % totalMedia)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setMediaIndex(order.id, (currentIndex + 1) % totalMedia)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                              {currentIndex + 1} از {totalMedia}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => onAddMedia(order.id)}
                      >
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <Camera className="w-8 h-8 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">افزودن عکس یا فیلم</p>
                          <p className="text-xs text-muted-foreground">برای این سفارش رسانه اضافه کنید</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Media Button (when has media) */}
                  {totalMedia > 0 && (
                    <button
                      onClick={() => onAddMedia(order.id)}
                      className="w-full py-2 border-b border-border flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm font-medium">افزودن رسانه جدید</span>
                    </button>
                  )}

                  {/* Action Buttons */}
                  <div className="p-3 flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewOrderDetail(order.id)}
                    >
                      <Eye className="w-4 h-4 ml-2" />
                      مشاهده جزئیات
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDeleteOrder(order.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                این پروژه سفارشی ندارد
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                می‌توانید این پروژه را حذف کنید
              </p>
              <Button
                variant="destructive"
                onClick={() => onDeleteProject(project.id)}
              >
                <Trash2 className="w-4 h-4 ml-2" />
                حذف پروژه
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
