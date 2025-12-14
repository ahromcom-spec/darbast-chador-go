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

  const isSupported = typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

  const pickContact = async (): Promise<ContactPickerResult | null> => {
    if (!isSupported) {
      toast({
        title: 'پشتیبانی نمی‌شود',
        description: 'مرورگر شما از دسترسی به مخاطبین پشتیبانی نمی‌کند. لطفاً از مرورگر Chrome در اندروید استفاده کنید.',
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
      
      return null;
    } catch (error: any) {
      // User cancelled the picker
      if (error.name === 'InvalidStateError' || error.name === 'AbortError') {
        return null;
      }
      
      console.error('Contact picker error:', error);
      toast({
        title: 'خطا',
        description: 'دسترسی به مخاطبین با خطا مواجه شد',
        variant: 'destructive',
      });
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
