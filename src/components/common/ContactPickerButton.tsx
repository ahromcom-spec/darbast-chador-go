import { Button } from '@/components/ui/button';
import { Contact, Loader2 } from 'lucide-react';
import { useContactPicker } from '@/hooks/useContactPicker';

interface ContactPickerButtonProps {
  onContactSelected: (phone: string, name?: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ContactPickerButton({ onContactSelected, disabled, className }: ContactPickerButtonProps) {
  const { pickContact, isPickerOpen } = useContactPicker();

  const handleClick = async () => {
    const contact = await pickContact();
    if (contact?.phone) {
      onContactSelected(contact.phone, contact.name);
    }
  };

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
