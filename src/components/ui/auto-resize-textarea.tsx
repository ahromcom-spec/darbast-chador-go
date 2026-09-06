import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, onInput, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);

    const adjustHeight = React.useCallback((el: HTMLTextAreaElement) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    React.useEffect(() => {
      const el = innerRef.current;
      if (el) {
        adjustHeight(el);
      }
    }, [adjustHeight, props.value, props.defaultValue]);

    const handleInput = React.useCallback(
      (e: React.FormEvent<HTMLTextAreaElement>) => {
        adjustHeight(e.currentTarget);
        onInput?.(e);
      },
      [adjustHeight, onInput]
    );

    return (
      <textarea
        rows={1}
        className={cn(
          "flex min-h-[40px] w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground placeholder:text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none shadow-sm hover:border-primary/50 text-right whitespace-pre-wrap break-words overflow-y-auto max-h-[200px]",
          className
        )}
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
          }
        }}
        onInput={handleInput}
        {...props}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

export { AutoResizeTextarea };
