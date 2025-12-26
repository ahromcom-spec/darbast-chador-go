import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type WorkStatus = "کارکرده" | "غایب";

interface WorkStatusSelectProps {
  value: WorkStatus;
  onValueChange: (value: WorkStatus) => void;
  className?: string;
  disabled?: boolean;
}

export function WorkStatusSelect({
  value,
  onValueChange,
  className,
  disabled,
}: WorkStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  }>({ left: 0, width: 0, top: 0 });

  const options = useMemo(
    () =>
      [
        { value: "کارکرده" as const, label: "کارکرده" },
        { value: "غایب" as const, label: "غایب" },
      ],
    [],
  );

  const updatePosition = () => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    // On mobile (pinch-zoom / keyboard), layout viewport and visual viewport can diverge.
    // Using VisualViewport offsets keeps the dropdown anchored to the trigger.
    const vv = window.visualViewport;
    const viewportOffsetLeft = vv?.offsetLeft ?? 0;
    const viewportOffsetTop = vv?.offsetTop ?? 0;
    const viewportWidth = vv?.width ?? window.innerWidth;
    const viewportHeight = vv?.height ?? window.innerHeight;

    const rect = triggerEl.getBoundingClientRect();
    const triggerLeft = rect.left + viewportOffsetLeft;
    const triggerRight = rect.right + viewportOffsetLeft;
    const triggerTop = rect.top + viewportOffsetTop;
    const triggerBottom = rect.bottom + viewportOffsetTop;

    const VIEWPORT_MARGIN = 8;
    const OFFSET = 0;

    const boundaryEl = triggerEl.closest('[data-dropdown-boundary]') as
      | HTMLElement
      | null;
    const boundaryRect = boundaryEl?.getBoundingClientRect();

    const viewportBoundLeft = viewportOffsetLeft + VIEWPORT_MARGIN;
    const viewportBoundRight = viewportOffsetLeft + viewportWidth - VIEWPORT_MARGIN;
    const viewportBoundTop = viewportOffsetTop + VIEWPORT_MARGIN;
    const viewportBoundBottom =
      viewportOffsetTop + viewportHeight - VIEWPORT_MARGIN;

    const boundLeft = Math.max(
      viewportBoundLeft,
      (boundaryRect?.left ?? viewportBoundLeft - viewportOffsetLeft) +
        viewportOffsetLeft,
    );
    const boundRight = Math.min(
      viewportBoundRight,
      (boundaryRect?.right ?? viewportBoundRight - viewportOffsetLeft) +
        viewportOffsetLeft,
    );
    const boundTop = Math.max(
      viewportBoundTop,
      (boundaryRect?.top ?? viewportBoundTop - viewportOffsetTop) + viewportOffsetTop,
    );
    const boundBottom = Math.min(
      viewportBoundBottom,
      (boundaryRect?.bottom ?? viewportBoundBottom - viewportOffsetTop) +
        viewportOffsetTop,
    );

    const isRTL =
      document.documentElement.dir === "rtl" || !!triggerEl.closest('[dir="rtl"]');

    const width = Math.min(rect.width, Math.max(120, boundRight - boundLeft));

    let left = isRTL ? triggerRight - width : triggerLeft;
    left = Math.max(boundLeft, Math.min(left, boundRight - width));

    const spaceAbove = triggerTop - boundTop;
    const spaceBelow = boundBottom - triggerBottom;
    const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;

    if (openBelow) {
      setPosition({
        left,
        width,
        top: triggerBottom + OFFSET,
        bottom: undefined,
      });
    } else {
      // IMPORTANT: bottom is relative to the *layout* viewport (window.innerHeight).
      // triggerTop is already translated into layout-viewport coordinates.
      setPosition({
        left,
        width,
        top: undefined,
        bottom: window.innerHeight - triggerTop + OFFSET,
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;

    if (open) {
      setOpen(false);
      return;
    }

    updatePosition();
    setOpen(true);
  };

  const handleSelect = (next: WorkStatus) => {
    onValueChange(next);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const onViewportChange = () => updatePosition();
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && dropdownRef.current?.contains(target)) return;
      updatePosition();
    };

    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onScroll, true);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", onViewportChange);
    vv?.addEventListener("scroll", onViewportChange);

    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onScroll, true);
      vv?.removeEventListener("resize", onViewportChange);
      vv?.removeEventListener("scroll", onViewportChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className="truncate">{value}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {open && position.width > 0
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[99999] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
              style={{
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
              }}
              dir="rtl"
              role="listbox"
            >
              <div className="p-1">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "w-full rounded-sm px-2 py-2 text-right text-sm outline-none transition-colors hover:bg-accent",
                      value === opt.value && "bg-accent",
                    )}
                    role="option"
                    aria-selected={value === opt.value}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
