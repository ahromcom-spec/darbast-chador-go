import { useState } from 'react';
import { Check, Copy, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isTextTruncated, previewText } from '@/lib/expandableText';
import { cn } from '@/lib/utils';

interface ExpandableTextProps {
  /** The full text; shown clamped in the box and complete in the opened dialog. */
  text: string;
  /** Small label shown before the text, e.g. «آدرس:». */
  label?: string;
  /** Dialog heading; falls back to the label. */
  title?: string;
  /** Length above which the box is treated as cut off. */
  maxChars?: number;
  className?: string;
  labelClassName?: string;
  clampClassName?: string;
}

/**
 * A text box that opens its full text when clicked. Used for dense table
 * cells (order address, location description, ...) where the value is clamped.
 */
export function ExpandableText({
  text,
  label,
  title,
  maxChars,
  className,
  labelClassName,
  clampClassName = 'line-clamp-2',
}: ExpandableTextProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const value = (text ?? '').trim();
  if (!value) return null;

  const expandable = isTextTruncated(value, maxChars);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by the browser; the text stays selectable.
    }
  };

  const box = (
    <div className={cn('flex items-start gap-1 text-xs', className)}>
      {label && <span className={cn('font-medium text-blue-700 shrink-0', labelClassName)}>{label}</span>}
      <span className={cn('min-w-0', expandable && clampClassName)}>{value}</span>
      {expandable && <Maximize2 className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />}
    </div>
  );

  return (
    <>
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={previewText(value, maxChars)}
          className="w-full text-right rounded p-0.5 -m-0.5 transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-900/30"
        >
          {box}
        </button>
      ) : (
        box
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{title || label || 'متن کامل'}</DialogTitle>
            <DialogDescription className="sr-only">متن کامل {label || title}</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-7 whitespace-pre-wrap break-words select-text max-h-[55vh] overflow-y-auto p-3 rounded-lg bg-muted/40 border">
            {value}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyText} className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'کپی شد' : 'کپی متن'}
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              بستن
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
