import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { requestZoom100 } from '@/lib/zoom';

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
  const portalRootRef = useRef<HTMLElement | null>(null);

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

    // Get the current CSS zoom level from document - default to 1
    const zoomLevel = parseFloat(document.documentElement.style.zoom || '1') || 1;
    
    const rect = triggerEl.getBoundingClientRect();
    
    // When CSS zoom is applied, getBoundingClientRect returns ZOOMED values
    // We need to divide by zoom to get the actual screen coordinates
    const adjustedRect = {
      left: rect.left / zoomLevel,
      right: rect.right / zoomLevel,
      top: rect.top / zoomLevel,
      bottom: rect.bottom / zoomLevel,
      width: rect.width / zoomLevel,
      height: rect.height / zoomLevel,
    };

    const VIEWPORT_MARGIN = 8;
    const OFFSET = 4;

    const boundaryEl = triggerEl.closest('[data-dropdown-boundary]') as
      | HTMLElement
      | null;
    portalRootRef.current = boundaryEl;

    const isRTL =
      document.documentElement.dir === "rtl" || !!triggerEl.closest('[dir="rtl"]');

    if (boundaryEl) {
      const b = boundaryEl.getBoundingClientRect();
      const adjustedBoundary = {
        left: b.left / zoomLevel,
        right: b.right / zoomLevel,
        top: b.top / zoomLevel,
        bottom: b.bottom / zoomLevel,
        width: b.width / zoomLevel,
        height: b.height / zoomLevel,
      };

      const width = Math.min(adjustedRect.width, Math.max(120, adjustedBoundary.width - VIEWPORT_MARGIN * 2));

      let left = isRTL ? adjustedRect.right - adjustedBoundary.left - width : adjustedRect.left - adjustedBoundary.left;
      left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(left, adjustedBoundary.width - VIEWPORT_MARGIN - width),
      );

      const spaceAbove = adjustedRect.top - adjustedBoundary.top - VIEWPORT_MARGIN;
      const spaceBelow = adjustedBoundary.bottom - adjustedRect.bottom - VIEWPORT_MARGIN;
      const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;

      if (openBelow) {
        setPosition({
          left,
          width,
          top: adjustedRect.bottom - adjustedBoundary.top + OFFSET,
          bottom: undefined,
        });
      } else {
        setPosition({
          left,
          width,
          top: undefined,
          bottom: adjustedBoundary.bottom - adjustedRect.top + OFFSET,
        });
      }

      return;
    }

    // Fallback (no boundary): use viewport
    const viewportWidth = window.innerWidth / zoomLevel;
    const viewportHeight = window.innerHeight / zoomLevel;

    const width = Math.min(adjustedRect.width, Math.max(120, viewportWidth - VIEWPORT_MARGIN * 2));

    let left = isRTL ? adjustedRect.right - width : adjustedRect.left;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - VIEWPORT_MARGIN - width));

    const spaceAbove = adjustedRect.top - VIEWPORT_MARGIN;
    const spaceBelow = viewportHeight - adjustedRect.bottom - VIEWPORT_MARGIN;
    const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;

    if (openBelow) {
      setPosition({
        left,
        width,
        top: adjustedRect.bottom + OFFSET,
        bottom: undefined,
      });
    } else {
      setPosition({
        left,
        width,
        top: undefined,
        bottom: viewportHeight - adjustedRect.top + OFFSET,
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;

    if (open) {
      setOpen(false);
      return;
    }

    // Force 100% zoom (and keep it) so portal positioning stays correct
    requestZoom100({ preserveScroll: true });

    requestAnimationFrame(() => {
      updatePosition();
      setOpen(true);
    });
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
              className={cn(
                portalRootRef.current ? "absolute" : "fixed",
                "z-[99999] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
              )}
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
            portalRootRef.current ?? document.body,
          )
        : null}
    </div>
  );
}
