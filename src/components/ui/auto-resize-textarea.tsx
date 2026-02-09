import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, onChange, onFocus, onBlur, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [isFocused, setIsFocused] = React.useState(false);

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        // When focused: show full content with larger min height
        // When not focused: compact view
        const minHeight = isFocused ? 120 : 44;
        textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
      }
    }, [isFocused]);

    React.useEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      onChange?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
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
          "flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground placeholder:text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-sm hover:border-primary/50 text-right",
          // When not focused: allow wrapping, limit height to ~2 lines
          !isFocused && "max-h-[60px] overflow-hidden whitespace-pre-wrap break-words",
          // When focused: expand to show full content without shifting layout
          isFocused && "min-h-[100px] overflow-auto whitespace-pre-wrap text-base border-primary border-3 shadow-lg ring-2 ring-primary/40 bg-white dark:bg-gray-900",
          className
        )}
        ref={setRefs}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

export { AutoResizeTextarea };
