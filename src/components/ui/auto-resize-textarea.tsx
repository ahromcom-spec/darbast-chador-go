import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        const minHeight = 44;
        textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
      }
    }, []);

    React.useEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      onChange?.(e);
    };

    const setRefs = React.useCallback(
      (element: HTMLTextAreaElement | null) => {
        textareaRef.current = element;
        if (typeof ref === 'function') {
          ref(element);
        } else if (ref) {
          ref.current = element;
        }
      },
      [ref]
    );

    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground placeholder:text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-sm hover:border-primary/50 text-right whitespace-pre-wrap break-words overflow-y-auto min-h-[44px] max-h-[120px]",
          className
        )}
        ref={setRefs}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

export { AutoResizeTextarea };
