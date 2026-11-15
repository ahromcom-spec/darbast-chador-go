// محل نمایش قاب‌های پیام سفارشی در صفحه مدیریت پیامک‌ها.
// قاب همیشه در تب «قاب‌های پیام سفارشی» هست و می‌تواند علاوه بر آن در تب پیامک‌های مشتری
// یا پیامک‌های مدیریت اهرم هم نمایش داده شود. این فقط نمایش است و روی ارسال اثری ندارد.

export type FrameDisplayTab = "customer" | "ceo";

export const FRAME_DISPLAY_TAB_LABELS: Record<FrameDisplayTab, string> = {
  customer: "پیامک‌های مشتری",
  ceo: "پیامک‌های مدیریت اهرم",
};

const CUSTOMER_SIDE = ["customer", "collaborators", "event_person"];
const MANAGEMENT_SIDE = ["roles", "phones"];

/** تب‌هایی که با گیرندگان فعلی قاب می‌توان قاب را به آن‌ها برد. */
export function allowedFrameTabs(recipientKinds?: string[] | null): FrameDisplayTab[] {
  const kinds = recipientKinds || [];
  const tabs: FrameDisplayTab[] = [];
  if (kinds.some((k) => CUSTOMER_SIDE.includes(k))) tabs.push("customer");
  if (kinds.some((k) => MANAGEMENT_SIDE.includes(k))) tabs.push("ceo");
  return tabs;
}

/** محل نمایش معتبر: اگر گیرندگان دیگر با تب انتخابی سازگار نباشند، قاب فقط در تب قاب‌ها می‌ماند. */
export function resolveFrameTab(displayTab: string | null | undefined, recipientKinds?: string[] | null): FrameDisplayTab | null {
  if (displayTab !== "customer" && displayTab !== "ceo") return null;
  return allowedFrameTabs(recipientKinds).includes(displayTab) ? displayTab : null;
}
