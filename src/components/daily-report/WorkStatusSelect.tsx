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
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();

    const VIEWPORT_MARGIN = 8;
    const OFFSET = 0;

    const isRTL =
      document.documentElement.dir === "rtl" ||
      !!triggerRef.current.closest('[dir="rtl"]');

    const width = rect.width;

    let left = isRTL ? rect.right - width : rect.left;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN),
    );

    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;

    if (openBelow) {
      setPosition({
        left,
        width,
        top: rect.bottom + OFFSET,
        bottom: undefined,
      });
    } else {
      setPosition({
        left,
        width,
        top: undefined,
        bottom: window.innerHeight - rect.top + OFFSET,
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

    const onResize = () => updatePosition();
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && dropdownRef.current?.contains(target)) return;
      updatePosition();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
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
