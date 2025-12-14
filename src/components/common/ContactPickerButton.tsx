import { Button } from '@/components/ui/button';
import { Contact } from 'lucide-react';
import { useContactPicker } from '@/hooks/useContactPicker';
import { Loader2 } from 'lucide-react';

interface ContactPickerButtonProps {
  onContactSelected: (phone: string, name?: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ContactPickerButton({ onContactSelected, disabled, className }: ContactPickerButtonProps) {
  const { pickContact, isPickerOpen, isSupported } = useContactPicker();

  const handleClick = async () => {
    const contact = await pickContact();
    if (contact?.phone) {
      onContactSelected(contact.phone, contact.name);
    }
  };

  // Don't render if Contact Picker API is not supported
  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={disabled || isPickerOpen}
      className={className}
      title="انتخاب از مخاطبین"
    >
      {isPickerOpen ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Contact className="h-4 w-4" />
      )}
    </Button>
  );
}
