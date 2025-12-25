import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ModerationResult {
  safe: boolean;
  reason: string;
}

export function useImageModeration() {
  const [checking, setChecking] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const checkImage = async (file: File): Promise<ModerationResult> => {
    // Only check images
    if (!file.type.startsWith('image/')) {
      return { safe: true, reason: 'فقط تصاویر بررسی می‌شوند' };
    }

    setChecking(true);
    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke('moderate-image', {
        body: {
          imageBase64: base64,
          mimeType: file.type
        }
      });

      if (error) {
        console.error('Moderation error:', error);
        // On error, allow upload
        return { safe: true, reason: 'خطا در بررسی محتوا' };
      }

      return {
        safe: data?.safe ?? true,
        reason: data?.reason ?? ''
      };
    } catch (err) {
      console.error('Image moderation failed:', err);
      // On error, allow upload
      return { safe: true, reason: 'خطا در بررسی' };
    } finally {
      setChecking(false);
    }
  };

  const checkImageWithToast = async (file: File): Promise<boolean> => {
    const result = await checkImage(file);
    
    if (!result.safe) {
      toast.error('تصویر نامناسب', {
        description: result.reason || 'این تصویر حاوی محتوای نامناسب است و قابل آپلود نیست',
        duration: 5000
      });
      return false;
    }
    
    return true;
  };

  return {
    checkImage,
    checkImageWithToast,
    checking
  };
}
