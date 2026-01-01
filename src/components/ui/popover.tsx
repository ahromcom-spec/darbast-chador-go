import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

// Helper to temporarily reset zoom when popover opens
const useZoomReset = (open: boolean) => {
  const originalZoom = React.useRef<string>("");
  
  React.useEffect(() => {
    if (open) {
      originalZoom.current = document.documentElement.style.zoom || "";
      document.documentElement.style.zoom = "1";
      document.body.style.zoom = "1";
    } else if (originalZoom.current !== "") {
      document.documentElement.style.zoom = originalZoom.current;
      document.body.style.zoom = originalZoom.current;
    }
  }, [open]);
};

// Wrapper component that handles zoom reset
const Popover = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>
>(({ open, onOpenChange, ...props }, ref) => {
  const [internalOpen, setInternalOpen] = React.useState(open ?? false);
  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : internalOpen;
  
  useZoomReset(actualOpen);
  
  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };
  
  return (
    <PopoverPrimitive.Root 
      open={actualOpen} 
      onOpenChange={handleOpenChange} 
      {...props} 
    />
  );
});
Popover.displayName = "Popover";

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, side = "bottom", ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      side={side}
      className={cn(
        "z-[9999] w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
