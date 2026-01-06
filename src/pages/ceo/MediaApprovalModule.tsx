import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ModuleHeader } from '@/components/common/ModuleHeader';
import VideoAudioEditor from '@/components/media/VideoAudioEditor';
import { 
  CheckCircle, 
  XCircle, 
  Play, 
  Image as ImageIcon, 
  Loader2, 
  ArrowUp, 
  ArrowDown,
  Eye,
  EyeOff,
  Clock,
  Filter,
  Trash2,
  FolderOpen,
  Plus,
  Upload,
  Music
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaItem {
  id: string;
  file_path: string;
  file_type: 'image' | 'video';
  title: string | null;
  description: string | null;
  project_name: string | null;
  order_id: string | null;
  uploaded_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  approved_at: string | null;
}

interface OrderMediaItem {
  id: string;
  project_id: string;
  user_id: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  order_code?: string;
  order_address?: string;
  uploader_name?: string;
}

const MediaApprovalModule: React.FC = () => {
  usePageTitle('مدیریت رسانه‌ها');
  const { user } = useAuth();
  const { toast } = useToast();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [orderMedia, setOrderMedia] = useState<OrderMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'pending' | 'approved' | 'rejected'>('orders');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedOrderMedia, setSelectedOrderMedia] = useState<OrderMediaItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddToApprovalDialog, setShowAddToApprovalDialog] = useState(false);
  const [addMediaTitle, setAddMediaTitle] = useState('');
  const [addMediaDescription, setAddMediaDescription] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Video audio editor state
  const [showVideoAudioEditor, setShowVideoAudioEditor] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState<string | null>(null);
  const [videoToEditItem, setVideoToEditItem] = useState<MediaItem | OrderMediaItem | null>(null);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrderMedia();
    } else {
      fetchMedia();
    }
  }, [activeTab]);

  const fetchOrderMedia = async () => {
    setLoading(true);
    try {
      // Fetch all media from orders - simple query first
      const { data: mediaData, error: mediaError } = await supabase
        .from('project_media')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (mediaError) throw mediaError;

      // Fetch project info separately to avoid RLS join issues
      const projectIds = [...new Set((mediaData || []).map(m => m.project_id).filter(Boolean))];
      let projectsMap: Record<string, { code: string; address: string }> = {};
      
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects_v3')
          .select('id, code, address')
          .in('id', projectIds);
        
        projects?.forEach(p => {
          projectsMap[p.id] = { code: p.code || 'بدون کد', address: p.address || '' };
        });
      }

      // Get uploader profiles
      const userIds = [...new Set((mediaData || []).map(m => m.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        profiles?.forEach(p => {
          profilesMap[p.user_id] = p.full_name || 'ناشناس';
        });
      }

      const enrichedData = (mediaData || []).map(m => ({
        ...m,
        order_code: projectsMap[m.project_id]?.code || 'بدون کد',
        order_address: projectsMap[m.project_id]?.address || '',
        uploader_name: profilesMap[m.user_id] || 'ناشناس'
      }));

      setOrderMedia(enrichedData);
    } catch (error) {
      console.error('Error fetching order media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت رسانه‌های سفارشات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('approved_media')
        .select('*')
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedia((data || []) as MediaItem[]);
    } catch (error) {
      console.error('Error fetching media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در دریافت لیست رسانه‌ها',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getMediaUrl = (filePath: string) => {
    if (filePath.startsWith('http')) return filePath;
    const { data } = supabase.storage.from('project-media').getPublicUrl(filePath);
    return data?.publicUrl || filePath;
  };

  const getVideoPreviewUrl = (filePath: string) => {
    const url = getMediaUrl(filePath);
    return url.includes('#') ? url : `${url}#t=0.5`;
  };
  const handleApprove = async (item: MediaItem) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('approved_media')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: 'تایید شد',
        description: 'رسانه با موفقیت تایید و در صفحه اصلی نمایش داده خواهد شد'
      });
      fetchMedia();
    } catch (error) {
      console.error('Error approving media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در تایید رسانه',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedMedia) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('approved_media')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason
        })
        .eq('id', selectedMedia.id);

      if (error) throw error;

      toast({
        title: 'رد شد',
        description: 'رسانه رد شد'
      });
      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedMedia(null);
      fetchMedia();
    } catch (error) {
      console.error('Error rejecting media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در رد رسانه',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleVisibility = async (item: MediaItem) => {
    try {
      const { error } = await supabase
        .from('approved_media')
        .update({ is_visible: !item.is_visible })
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: item.is_visible ? 'پنهان شد' : 'نمایش داده شد',
        description: item.is_visible ? 'رسانه از صفحه اصلی پنهان شد' : 'رسانه در صفحه اصلی نمایش داده می‌شود'
      });
      fetchMedia();
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const handleUpdateOrder = async (item: MediaItem, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? item.display_order - 1 : item.display_order + 1;
    try {
      const { error } = await supabase
        .from('approved_media')
        .update({ display_order: newOrder })
        .eq('id', item.id);

      if (error) throw error;
      fetchMedia();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!confirm('آیا از حذف این رسانه اطمینان دارید؟')) return;

    setProcessing(true);
    try {
      // First delete from database
      const { error: dbError } = await supabase
        .from('approved_media')
        .delete()
        .eq('id', item.id);

      if (dbError) throw dbError;

      // Also try to delete file from storage (optional - might fail due to RLS)
      if (item.file_path && !item.file_path.startsWith('http')) {
        await supabase.storage.from('project-media').remove([item.file_path]);
      }

      toast({
        title: 'حذف شد',
        description: 'رسانه با موفقیت حذف شد'
      });
      
      // Update local state immediately for faster UI response
      setMedia(prevMedia => prevMedia.filter(m => m.id !== item.id));
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف رسانه',
        variant: 'destructive'
      });
      // Refresh to sync with actual database state
      fetchMedia();
    } finally {
      setProcessing(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedMedia) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('approved_media')
        .update({
          title: editTitle || null,
          description: editDescription || null
        })
        .eq('id', selectedMedia.id);

      if (error) throw error;

      toast({
        title: 'ذخیره شد',
        description: 'اطلاعات رسانه به‌روزرسانی شد'
      });
      setShowEditDialog(false);
      setSelectedMedia(null);
      fetchMedia();
    } catch (error) {
      console.error('Error updating media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در ذخیره اطلاعات',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const openEditDialog = (item: MediaItem) => {
    setSelectedMedia(item);
    setEditTitle(item.title || '');
    setEditDescription(item.description || '');
    setShowEditDialog(true);
  };

  const openAddToApprovalDialog = (item: OrderMediaItem) => {
    setSelectedOrderMedia(item);
    setAddMediaTitle('');
    setAddMediaDescription('');
    setShowAddToApprovalDialog(true);
  };

  const handleAddToApproval = async () => {
    if (!selectedOrderMedia) return;
    setProcessing(true);
    try {
      // Check if already added
      const { data: existing, error: checkError } = await supabase
        .from('approved_media')
        .select('id')
        .eq('original_media_id', selectedOrderMedia.id)
        .maybeSingle();

      if (checkError) {
        console.error('Check error:', checkError);
      }

      if (existing) {
        toast({
          title: 'توجه',
          description: 'این رسانه قبلاً به لیست تایید اضافه شده است',
          variant: 'destructive'
        });
        setProcessing(false);
        return;
      }

      // Determine file type from mime_type or file_type field
      const isVideo = selectedOrderMedia.mime_type?.startsWith('video/') || 
                      selectedOrderMedia.file_type?.toLowerCase().includes('video') ||
                      selectedOrderMedia.file_path?.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv)$/);

      const { error } = await supabase
        .from('approved_media')
        .insert({
          original_media_id: selectedOrderMedia.id,
          file_path: selectedOrderMedia.file_path,
          file_type: isVideo ? 'video' : 'image',
          title: addMediaTitle || null,
          description: addMediaDescription || null,
          order_id: selectedOrderMedia.project_id,
          project_name: selectedOrderMedia.order_code || null,
          uploaded_by: selectedOrderMedia.user_id,
          status: 'approved',
          display_order: 0,
          is_visible: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: 'افزوده شد',
        description: 'رسانه با موفقیت به فعالیت‌های اخیر اضافه شد'
      });
      setShowAddToApprovalDialog(false);
      setSelectedOrderMedia(null);
      // Switch to approved tab to show the result
      setActiveTab('approved');
    } catch (error) {
      console.error('Error adding to approval:', error);
      toast({
        title: 'خطا',
        description: 'خطا در افزودن رسانه',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleDirectUpload = async () => {
    if (selectedFiles.length === 0 || !user) {
      toast({
        title: 'خطا',
        description: 'لطفاً ابتدا فایلی انتخاب کنید',
        variant: 'destructive'
      });
      return;
    }
    
    setUploadingMedia(true);
    setUploadProgress(0);
    
    try {
      const totalFiles = selectedFiles.length;
      let completedFiles = 0;
      
      for (const file of selectedFiles) {
        // Check file size (max 70MB for videos, 10MB for images)
        const maxSize = file.type.startsWith('video/') ? 70 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(`حجم فایل ${file.name} بیش از حد مجاز است`);
        }

        const isVideo = file.type.startsWith('video/');
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
        const filePath = `${user.id}/approved-media/${fileName}`;
        
        // Create a signed upload URL (Storage RLS must allow this path)
        const { data: signed, error: signError } = await supabase.storage
          .from('project-media')
          .createSignedUploadUrl(filePath, { upsert: false });

        if (signError || !signed?.signedUrl) {
          throw new Error(`خطا در آماده‌سازی آپلود: ${signError?.message || 'نامشخص'}`);
        }

        // Upload via XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const fileProgress = (event.loaded / event.total) * 100;
              const overallProgress =
                (completedFiles / totalFiles) * 100 + fileProgress / totalFiles;
              setUploadProgress(Math.round(overallProgress));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`خطا در آپلود فایل: ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('خطا در اتصال به سرور'));
          });

          xhr.open('PUT', signed.signedUrl);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });
        
        completedFiles++;

        // Insert into approved_media
        const { error: insertError } = await supabase
          .from('approved_media')
          .insert({
            file_path: filePath,
            file_type: isVideo ? 'video' : 'image',
            title: uploadTitle || null,
            description: uploadDescription || null,
            uploaded_by: user.id,
            status: 'approved',
            display_order: 0,
            is_visible: true,
            approved_by: user.id,
            approved_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error(`خطا در ذخیره اطلاعات: ${insertError.message}`);
        }
      }

      toast({
        title: 'آپلود موفق',
        description: 'رسانه با موفقیت به فعالیت‌های اخیر اضافه شد'
      });
      
      setShowUploadDialog(false);
      setUploadTitle('');
      setUploadDescription('');
      setSelectedFiles([]);
      setActiveTab('approved');
      fetchMedia();
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading media:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در آپلود فایل',
        variant: 'destructive'
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  // Open video audio editor
  const openVideoAudioEditor = (item: MediaItem | OrderMediaItem) => {
    const url = getMediaUrl(item.file_path);
    setVideoToEdit(url);
    setVideoToEditItem(item);
    setShowVideoAudioEditor(true);
  };

  // Handle edited video save
  const handleEditedVideoSave = async (editedBlob: Blob) => {
    if (!user || !videoToEditItem) return;
    
    setProcessing(true);
    try {
      const fileName = `edited-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;
      const filePath = `${user.id}/approved-media/${fileName}`;
      
      // Create signed upload URL
      const { data: signed, error: signError } = await supabase.storage
        .from('project-media')
        .createSignedUploadUrl(filePath, { upsert: false });

      if (signError || !signed?.signedUrl) {
        throw new Error(`خطا در آماده‌سازی آپلود: ${signError?.message || 'نامشخص'}`);
      }

      // Upload the edited video
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`خطا در آپلود: ${xhr.status}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('خطا در اتصال')));
        xhr.open('PUT', signed.signedUrl);
        xhr.setRequestHeader('Content-Type', 'video/mp4');
        xhr.send(editedBlob);
      });

      // Check if this is an existing approved_media item (has 'status' field) or an order media item
      const isApprovedMediaItem = 'status' in videoToEditItem;

      if (isApprovedMediaItem) {
        // UPDATE existing record instead of creating new one
        const oldFilePath = (videoToEditItem as MediaItem).file_path;
        
        const { error: updateError } = await supabase
          .from('approved_media')
          .update({
            file_path: filePath,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoToEditItem.id);

        if (updateError) throw updateError;

        // Try to delete old file from storage (optional - might fail due to RLS)
        if (oldFilePath && !oldFilePath.startsWith('http')) {
          try {
            await supabase.storage.from('project-media').remove([oldFilePath]);
          } catch (e) {
            console.warn('Could not delete old video file:', e);
          }
        }

        toast({
          title: 'موفق',
          description: 'ویدیو با موفقیت ویرایش شد'
        });
      } else {
        // INSERT new record for order media items
        const { error: insertError } = await supabase
          .from('approved_media')
          .insert({
            file_path: filePath,
            file_type: 'video',
            title: 'ویدیو ویرایش شده',
            description: 'ویدیو با صدای ویرایش شده',
            uploaded_by: user.id,
            status: 'approved',
            display_order: 0,
            is_visible: true,
            approved_by: user.id,
            approved_at: new Date().toISOString()
          });

        if (insertError) throw insertError;

        toast({
          title: 'موفق',
          description: 'ویدیو ویرایش شده با موفقیت ذخیره شد'
        });
      }
      
      setShowVideoAudioEditor(false);
      setVideoToEdit(null);
      setVideoToEditItem(null);
      setActiveTab('approved');
      fetchMedia();
    } catch (error: any) {
      console.error('Error saving edited video:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ذخیره ویدیو',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 ml-1" />در انتظار</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 ml-1" />تایید شده</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 ml-1" />رد شده</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <ModuleHeader
        title="مدیریت رسانه‌های سایت"
        description="تایید و مدیریت عکس‌ها و فیلم‌هایی که در صفحه اصلی نمایش داده می‌شوند"
        action={
          <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            افزودن رسانه جدید
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="orders" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                رسانه‌های سفارشات
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                در انتظار تایید
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                تایید شده
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-2">
                <XCircle className="h-4 w-4" />
                رد شده
              </TabsTrigger>
            </TabsList>

            {/* Orders Media Tab */}
            <TabsContent value="orders">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : orderMedia.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>رسانه‌ای در سفارشات وجود ندارد</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {orderMedia.map((item) => (
                    <Card key={item.id} className="overflow-hidden transition-all hover:shadow-lg">
                      <div 
                        className="relative aspect-video cursor-pointer group"
                        onClick={() => {
                          setSelectedOrderMedia(item);
                          setShowPreview(true);
                        }}
                      >
                        {item.file_type === 'video' ? (
                          <>
                            <video
                              src={getVideoPreviewUrl(item.file_path)}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              webkit-playsinline="true"
                              preload="metadata"
                              onLoadedData={(e) => {
                                const video = e.target as HTMLVideoElement;
                                video.currentTime = 0.5;
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
                                <Play className="h-6 w-6 text-white fill-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={getMediaUrl(item.file_path)}
                            alt="تصویر سفارش"
                            className="w-full h-full object-cover"
                          />
                        )}
                        
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                            <FolderOpen className="h-3 w-3 ml-1" />
                            سفارش
                          </Badge>
                        </div>
                      </div>

                      <CardContent className="p-3 space-y-3">
                        <div>
                          <p className="font-medium text-sm truncate">کد سفارش: {item.order_code}</p>
                          {item.order_address && (
                            <p className="text-xs text-muted-foreground truncate">{item.order_address}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            آپلودکننده: {item.uploader_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('fa-IR')}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {item.file_type === 'video' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => openVideoAudioEditor(item)}
                              title="ویرایش صدای ویدیو"
                            >
                              <Music className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => openAddToApprovalDialog(item)}
                          >
                            <Plus className="h-4 w-4" />
                            افزودن به فعالیت‌ها
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value={activeTab}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : media.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>رسانه‌ای در این بخش وجود ندارد</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {media.map((item, index) => (
                    <Card key={item.id} className={cn(
                      "overflow-hidden transition-all",
                      !item.is_visible && activeTab === 'approved' && "opacity-50"
                    )}>
                      <div 
                        className="relative aspect-video cursor-pointer group"
                        onClick={() => {
                          setSelectedMedia(item);
                          setShowPreview(true);
                        }}
                      >
                        {item.file_type === 'video' ? (
                          <>
                            <video
                              src={getVideoPreviewUrl(item.file_path)}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              webkit-playsinline="true"
                              preload="metadata"
                              onLoadedData={(e) => {
                                const video = e.target as HTMLVideoElement;
                                video.currentTime = 0.5;
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
                                <Play className="h-6 w-6 text-white fill-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={getMediaUrl(item.file_path)}
                            alt={item.title || 'تصویر'}
                            className="w-full h-full object-cover"
                          />
                        )}
                        
                        {/* Status Badge Overlay */}
                        <div className="absolute top-2 right-2">
                          {getStatusBadge(item.status)}
                        </div>
                      </div>

                      <CardContent className="p-3 space-y-3">
                        <div>
                          <p className="font-medium text-sm truncate">{item.title || 'بدون عنوان'}</p>
                          {item.project_name && (
                            <p className="text-xs text-muted-foreground truncate">پروژه: {item.project_name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('fa-IR')}
                          </p>
                        </div>

                        {activeTab === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleApprove(item)}
                              disabled={processing}
                            >
                              <CheckCircle className="h-4 w-4 ml-1" />
                              تایید
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => {
                                setSelectedMedia(item);
                                setShowRejectDialog(true);
                              }}
                              disabled={processing}
                            >
                              <XCircle className="h-4 w-4 ml-1" />
                              رد
                            </Button>
                          </div>
                        )}

                        {activeTab === 'approved' && (
                          <div className="flex gap-1 flex-wrap">
                            {item.file_type === 'video' && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => openVideoAudioEditor(item)}
                                title="ویرایش صدای ویدیو"
                              >
                                <Music className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => handleToggleVisibility(item)}
                              title={item.is_visible ? 'پنهان کردن' : 'نمایش'}
                            >
                              {item.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => handleUpdateOrder(item, 'up')}
                              title="اولویت بالاتر"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => handleUpdateOrder(item, 'down')}
                              title="اولویت پایین‌تر"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(item)}
                              title="ویرایش"
                            >
                              <Filter className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={() => handleDelete(item)}
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {activeTab === 'rejected' && item.rejection_reason && (
                          <div className="p-2 bg-red-500/10 rounded text-xs text-red-500">
                            دلیل رد: {item.rejection_reason}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => {
        setShowPreview(open);
        if (!open) {
          setSelectedMedia(null);
          setSelectedOrderMedia(null);
        }
      }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          {(selectedMedia || selectedOrderMedia) && (
            <div className="relative">
              <div className="flex items-center justify-center min-h-[300px] max-h-[80vh]">
                {(selectedMedia?.file_type === 'video' || selectedOrderMedia?.file_type === 'video') ? (
                  <video
                    key={selectedMedia?.id || selectedOrderMedia?.id}
                    src={getMediaUrl(selectedMedia?.file_path || selectedOrderMedia?.file_path || '')}
                    className="max-w-full max-h-[80vh] object-contain"
                    controls
                    autoPlay
                    playsInline
                    webkit-playsinline="true"
                    controlsList="nodownload"
                    onError={(e) => {
                      console.error('Video playback error:', e);
                    }}
                  />
                ) : (
                  <img
                    src={getMediaUrl(selectedMedia?.file_path || selectedOrderMedia?.file_path || '')}
                    alt={selectedMedia?.title || 'تصویر'}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>دلیل رد رسانه</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="دلیل رد کردن این رسانه را وارد کنید..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              انصراف
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              رد کردن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ویرایش اطلاعات رسانه</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">عنوان</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="عنوان رسانه"
              />
            </div>
            <div>
              <label className="text-sm font-medium">توضیحات</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="توضیحات..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              انصراف
            </Button>
            <Button onClick={handleEditSave} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Approval Dialog */}
      <Dialog open={showAddToApprovalDialog} onOpenChange={setShowAddToApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>افزودن به فعالیت‌های اخیر</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedOrderMedia && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                {selectedOrderMedia.file_type === 'video' ? (
                  <video
                    src={getVideoPreviewUrl(selectedOrderMedia.file_path)}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={getMediaUrl(selectedOrderMedia.file_path)}
                    alt="پیش‌نمایش"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">عنوان (اختیاری)</label>
              <Input
                value={addMediaTitle}
                onChange={(e) => setAddMediaTitle(e.target.value)}
                placeholder="عنوان برای نمایش در صفحه اصلی"
              />
            </div>
            <div>
              <label className="text-sm font-medium">توضیحات (اختیاری)</label>
              <Textarea
                value={addMediaDescription}
                onChange={(e) => setAddMediaDescription(e.target.value)}
                placeholder="توضیحات کوتاه..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToApprovalDialog(false)}>
              انصراف
            </Button>
            <Button onClick={handleAddToApproval} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              افزودن به لیست تایید
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!open) {
          setSelectedFiles([]);
          setUploadTitle('');
          setUploadDescription('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
        setShowUploadDialog(open);
      }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>آپلود رسانه جدید</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">عنوان (اختیاری)</label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="عنوان رسانه..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">توضیحات (اختیاری)</label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="توضیحات کوتاه..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">انتخاب فایل</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted-foreground mt-2
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90 file:cursor-pointer"
                disabled={uploadingMedia}
              />
              {selectedFiles.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedFiles.length} فایل انتخاب شده
                </p>
              )}
              {uploadingMedia && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">در حال آپلود...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploadingMedia}>
              انصراف
            </Button>
            <Button onClick={handleDirectUpload} disabled={uploadingMedia || selectedFiles.length === 0}>
              {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Upload className="h-4 w-4 ml-1" />}
              آپلود
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Audio Editor */}
      {showVideoAudioEditor && videoToEdit && (
        <VideoAudioEditor
          key={videoToEditItem?.id || videoToEdit}
          open={showVideoAudioEditor}
          onOpenChange={(open) => {
            setShowVideoAudioEditor(open);
            if (!open) {
              setVideoToEdit(null);
              setVideoToEditItem(null);
            }
          }}
          videoUrl={videoToEdit}
          onSave={handleEditedVideoSave}
        />
      )}
    </div>
  );
};

export default MediaApprovalModule;
