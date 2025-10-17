import { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { ServiceTypeWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';

interface ServiceTypeSelectorProps {
  serviceTypes: ServiceTypeWithSubcategories[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export function ServiceTypeSelector({ 
  serviceTypes, 
  value, 
  onChange,
  loading = false 
}: ServiceTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [expandedServiceType, setExpandedServiceType] = useState<string | null>(null);

  // Parse current value
  const [selectedServiceTypeId, selectedSubcategoryCode] = value ? value.split(':') : ['', ''];
  
  const selectedServiceType = serviceTypes.find(st => st.id === selectedServiceTypeId);
  const selectedSubcategory = selectedServiceType?.subcategories.find(sc => sc.code === selectedSubcategoryCode);

  const displayValue = selectedServiceType && selectedSubcategory
    ? `${selectedServiceType.name} - ${selectedSubcategory.name}`
    : '';

  const handleSelect = (serviceTypeId: string, subcategoryCode: string) => {
    onChange(`${serviceTypeId}:${subcategoryCode}`);
    setOpen(false);
    setExpandedServiceType(null);
  };

  const handleServiceTypeClick = (serviceTypeId: string) => {
    setExpandedServiceType(expandedServiceType === serviceTypeId ? null : serviceTypeId);
  };

  if (loading) {
    return (
      <Button
        variant="outline"
        role="combobox"
        disabled
        className="w-full justify-between h-11 sm:h-12 text-sm sm:text-base"
      >
        <span className="text-muted-foreground">در حال بارگذاری...</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-11 sm:h-12 text-sm sm:text-base smooth-hover"
        >
          <span className={cn(!displayValue && "text-muted-foreground")}>
            {displayValue || "لطفاً نوع خدمات مورد نظر خود را انتخاب کنید..."}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-popover border-2 z-[100]" align="start">
        <Command className="w-full">
          <CommandInput placeholder="جستجوی خدمات..." className="h-9" />
          <CommandList>
            <CommandEmpty>خدمتی یافت نشد.</CommandEmpty>
            {serviceTypes.map((serviceType) => (
              <CommandGroup key={serviceType.id}>
                <div className="relative">
                  <button type="button"
                    onClick={() => handleServiceTypeClick(serviceType.id)}
                    className={cn(
                      "flex w-full items-center justify-between px-2 py-2 text-sm font-semibold text-primary hover:bg-accent rounded-sm cursor-pointer",
                      expandedServiceType === serviceType.id && "bg-accent"
                    )}
                  >
                    <span>{serviceType.name}</span>
                    <ChevronLeft className={cn(
                      "h-4 w-4 transition-transform",
                      expandedServiceType === serviceType.id && "rotate-180"
                    )} />
                  </button>

                  {/* Subcategories - shown on hover (desktop) or click (mobile) */}
                  {expandedServiceType === serviceType.id && (
                    <div className="pr-4 pb-1 animate-in fade-in-0 slide-in-from-top-1">
                      {serviceType.subcategories.length > 0 ? (
                        serviceType.subcategories.map((subcategory) => (
                          <CommandItem
                            key={subcategory.id}
                            value={`${serviceType.name} ${subcategory.name}`}
                            onSelect={() => handleSelect(serviceType.id, subcategory.code)}
                            className="text-sm sm:text-base pr-4 cursor-pointer"
                          >
                            <span>{subcategory.name}</span>
                          </CommandItem>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-xs text-muted-foreground">
                          زیرشاخه‌ای موجود نیست
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
