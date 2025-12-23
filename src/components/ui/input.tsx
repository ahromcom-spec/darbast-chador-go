import * as React from "react";
import { cn } from "@/lib/utils";
import { validateIranianPhone } from "@/lib/phoneValidation";

export interface InputProps extends React.ComponentProps<"input"> {
  validatePhone?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, validatePhone, ...props }, ref) => {
    const [error, setError] = React.useState<string>("");

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (validatePhone && e.target.value && !validateIranianPhone(e.target.value)) {
        setError("شماره تلفن باید 11 رقم و با 09 شروع شود");
      } else {
        setError("");
      }
      props.onBlur?.(e);
    };

    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground placeholder:text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-sm transition-colors hover:border-primary/50 text-right",
            error && "border-destructive",
            className,
          )}
          ref={ref}
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
