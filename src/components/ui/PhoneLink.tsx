import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/** Convert Persian/Arabic digits and separators to a tel:-safe number */
export function normalizePhoneForTel(phone: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  let out = "";
  for (const ch of phone) {
    const faIdx = fa.indexOf(ch);
    const arIdx = ar.indexOf(ch);
    if (faIdx >= 0) out += String(faIdx);
    else if (arIdx >= 0) out += String(arIdx);
    else if (/[0-9+]/.test(ch)) out += ch;
  }
  return out;
}

interface PhoneLinkProps {
  phone?: string | null;
  className?: string;
  showIcon?: boolean;
  /** Text direction for the number; defaults to ltr */
  dir?: "ltr" | "rtl";
}

/**
 * Renders a phone number as a tappable tel: link so mobile browsers
 * open the dialer directly. Falls back to plain text when empty.
 */
export function PhoneLink({ phone, className, showIcon = false, dir = "ltr" }: PhoneLinkProps) {
  if (!phone) return <span className={className}>-</span>;
  const tel = normalizePhoneForTel(phone);
  if (!tel) return <span className={className} dir={dir}>{phone}</span>;
  return (
    <a
      href={`tel:${tel}`}
      dir={dir}
      className={cn(
        "text-primary underline-offset-4 hover:underline active:opacity-70 touch-manipulation",
        className
      )}
    >
      {showIcon && <Phone className="inline-block h-3.5 w-3.5 ml-1 -mb-0.5" />}
      {phone}
    </a>
  );
}
