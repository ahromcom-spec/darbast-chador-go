import { useState, useMemo } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Parse current value
  const [selectedServiceTypeId, selectedSubcategoryCode] = value ? value.split(':') : ['', ''];
  
  const selectedServiceType = serviceTypes.find(st => st.id === selectedServiceTypeId);

  const displayValue = selectedServiceType
    ? selectedServiceType.name
    : '';

  const handleSelect = (serviceTypeId: string, subcategoryCode: string) => {
    // Close popover immediately before any navigation happens
    setOpen(false);
    setExpandedServiceType(null);
    setSearchQuery('');
    // Delay onChange slightly so the popover fully unmounts before route change
    // This prevents the dropdown from lingering on the next page
    window.requestAnimationFrame(() => {
      setTimeout(() => onChange(`${serviceTypeId}:${subcategoryCode}`), 120);
    });
  };

  const handleServiceTypeClick = (serviceTypeId: string) => {
    setExpandedServiceType(expandedServiceType === serviceTypeId ? null : serviceTypeId);
  };

  // Filter service types and subcategories based on search
  const filteredServiceTypes = useMemo(() => {
    if (!searchQuery.trim()) {
      return serviceTypes;
    }

    const query = searchQuery.toLowerCase();
    return serviceTypes.map(serviceType => {
      const typeMatches = serviceType.name.toLowerCase().includes(query);
      const matchingSubcategories = serviceType.subcategories.filter(sub =>
        sub.name.toLowerCase().includes(query)
      );

      // Include service type if it matches OR if any subcategory matches
      if (typeMatches || matchingSubcategories.length > 0) {
        return {
          ...serviceType,
          subcategories: typeMatches ? serviceType.subcategories : matchingSubcategories,
          // Auto-expand if subcategories match
          autoExpand: !typeMatches && matchingSubcategories.length > 0
        };
      }
      return null;
    }).filter(Boolean) as (ServiceTypeWithSubcategories & { autoExpand?: boolean })[];
  }, [serviceTypes, searchQuery]);

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
          className="w-full justify-between h-11 sm:h-12 text-sm sm:text-base smooth-hover border-2 border-[#D4AF37] hover:border-[#F4D03F] shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_20px_rgba(244,208,63,0.5)] transition-all duration-300"
        >
          <span className={cn(!displayValue && "text-muted-foreground")}>
            {displayValue || "لطفاً نوع خدمات مورد نظر خود را انتخاب کنید..."}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="group flex flex-col w-[calc(100vw-2rem)] sm:w-[450px] p-0 bg-popover border-2 z-[99999]"
        align="start"
        sideOffset={4}
        avoidCollisions
      >
        <Command className="w-full" shouldFilter={false}>
          {/* Search bar: always stick to the edge near the trigger */}
          <div
            className="search-header z-[100000] bg-popover border-b group-data-[side=top]:border-b-0 group-data-[side=top]:border-t group-data-[side=bottom]:border-b group-data-[side=bottom]:border-t-0 group-data-[side=top]:order-last group-data-[side=bottom]:order-first"
          >
            <CommandInput 
              placeholder="جستجوی خدمات..." 
              className="h-11 text-base"
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>

          {/* List: flips position relative to search based on opening side */}
          <CommandList className="max-h=[300px] max-h-[300px] overflow-y-auto group-data-[side=top]:order-first group-data-[side=bottom]:order-last">
            <CommandEmpty>خدمتی یافت نشد.</CommandEmpty>
            <CommandGroup>
              {filteredServiceTypes.map((serviceType) => {
                const shouldExpand = expandedServiceType === serviceType.id || ('autoExpand' in serviceType && serviceType.autoExpand);
                
                return (
                  <div key={serviceType.id}>
                    <CommandItem
                      value={serviceType.name}
                      onSelect={() => handleServiceTypeClick(serviceType.id)}
                      className="font-semibold text-primary cursor-pointer"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span>{serviceType.name}</span>
                        <ChevronLeft className={cn(
                          "h-4 w-4 transition-transform",
                          shouldExpand && "rotate-180"
                        )} />
                      </div>
                    </CommandItem>

                    {shouldExpand && (
                      <div className="pr-4 pb-1 animate-in fade-in-0 slide-in-from-top-1">
                        {serviceType.subcategories.length > 0 ? (
                          serviceType.subcategories.map((subcategory) => (
                            <CommandItem
                              key={subcategory.id}
                              value={`${serviceType.name} ${subcategory.name}`}
                              onSelect={() => handleSelect(serviceType.id, subcategory.code)}
                              className="text-sm sm:text-base cursor-pointer"
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
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
