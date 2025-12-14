import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ContactPickerResult {
  name: string;
  phone: string;
}

// Extend Navigator interface for Contact Picker API
declare global {
  interface Navigator {
    contacts?: {
      select: (properties: string[], options?: { multiple?: boolean }) => Promise<Array<{
        name?: string[];
        tel?: string[];
      }>>;
    };
  }
}

export function useContactPicker() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { toast } = useToast();

  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    'contacts' in navigator &&
    typeof navigator.contacts?.select === 'function';

  const pickContact = async (): Promise<ContactPickerResult | null> => {
    if (!isSupported) {
      toast({
        title: 'پشتیبانی نمی‌شود',
        description:
          'مرورگر شما از دسترسی به مخاطبین پشتیبانی نمی‌کند. لطفاً از مرورگر Chrome در اندروید استفاده کنید.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setIsPickerOpen(true);
      const contacts = await navigator.contacts!.select(['name', 'tel'], { multiple: false });

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name?.[0] || '';
        let phone = contact.tel?.[0] || '';

        // Format phone number
        phone = phone.replace(/\D/g, '');
        if (phone.startsWith('98')) {
          phone = '0' + phone.slice(2);
        } else if (phone.startsWith('0098')) {
          phone = '0' + phone.slice(4);
        } else if (!phone.startsWith('0') && phone.length === 10) {
          phone = '0' + phone;
        }

        return { name, phone };
      }

      toast({
        title: 'مخاطبی نمایش داده نشد',
        description:
          'هیچ مخاطبی از طرف مرورگر برنگشت. اگر روی گوشی خود مخاطب دارید، لطفاً در تنظیمات مرورگر، دسترسی به مخاطبین (Contacts) را روی اجازه (Allow) قرار دهید.',
        variant: 'destructive',
      });

      return null;
    } catch (error: any) {
      // User cancelled the picker
      if (error?.name === 'InvalidStateError' || error?.name === 'AbortError') {
        return null;
      }

      if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
        toast({
          title: 'دسترسی به مخاطبین مسدود است',
          description:
            'برای استفاده از این امکان، در تنظیمات مرورگر (Site settings) دسترسی Contacts را برای ahrom.ir روی Allow قرار دهید.',
          variant: 'destructive',
        });
      } else {
        console.error('Contact picker error:', error);
        toast({
          title: 'خطا',
          description: 'دسترسی به مخاطبین با خطا مواجه شد',
          variant: 'destructive',
        });
      }
      return null;
    } finally {
      setIsPickerOpen(false);
    }
  };

  return {
    pickContact,
    isSupported,
    isPickerOpen,
  };
}
