import * as React from "react";
import { cn } from "@/lib/utils";
import { validateIranianPhone } from "@/lib/phoneValidation";

export interface InputProps extends React.ComponentProps<"input"> {
  validatePhone?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, validatePhone, onFocus, onBlur, ...props }, ref) => {
    const [error, setError] = React.useState<string>("");
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      if (validatePhone && e.target.value && !validateIranianPhone(e.target.value)) {
        setError("شماره تلفن باید 11 رقم و با 09 شروع شود");
      } else {
        setError("");
      }
      onBlur?.(e);
    };

    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-md border-2 border-input bg-background px-3 py-3 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground placeholder:text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm transition-all duration-300 ease-out hover:border-primary/50 text-right",
            // Enhanced focus state - double size on mobile
            isFocused && "h-24 text-xl border-primary border-3 shadow-xl ring-2 ring-primary/40 z-20 relative bg-white dark:bg-gray-900 scale-100",
            error && "border-destructive",
            className,
          )}
          ref={ref}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {error && (
          <p className="text-sm text-destructive mt-1">{error}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
