import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex h-[140px] w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground placeholder:text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-sm hover:border-primary/50 text-right whitespace-pre-wrap break-words overflow-y-auto",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

export { AutoResizeTextarea };
