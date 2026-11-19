import { describe, expect, test } from "bun:test";
import {
  ACTIVITY_KINDS,
  countActivity,
  executiveTabFromPath,
  formatBadgeCount,
  resolveActivityKind,
  seenKey,
  tabSince,
} from "../src/lib/moduleActivity";

const NOW = Date.parse("2026-11-19T10:00:00Z");
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

describe("module activity badges", () => {
  test("pinned custom modules resolve by their page, not their key", () => {
    expect(resolveActivityKind("/executive")?.id).toBe("executive");
    expect(resolveActivityKind("/order-transfers-module?x=1")?.id).toBe("order_transfers");
    expect(resolveActivityKind("/scaffolding-pricing")).toBeNull();
  });

  test("only events after the tab's last visit are counted", () => {
    const kind = ACTIVITY_KINDS.order_transfers;
    const seen = { [seenKey("m", "transfer:pending")]: iso(30) };
    const rows = {
      transfers: [
        { id: "a", status: "pending_manager", updated_at: iso(10) },
        { id: "b", status: "pending_manager", updated_at: iso(60) },
        { id: "c", status: "completed", updated_at: iso(5) },
      ],
    };
    const counts = countActivity(kind, "m", rows, seen, NOW);
    expect(counts.tabs["transfer:pending"]).toBe(1);
    // تب «تایید شده» هرگز باز نشده؛ رویداد ۵ دقیقه پیش شمرده می‌شود
    expect(counts.tabs["transfer:approved"]).toBe(1);
    expect(counts.groups.transfer).toBe(2);
    expect(counts.groups.collaborator).toBe(0);
  });

  test("an order shown in two stage tabs counts once in the module total", () => {
    const kind = ACTIVITY_KINDS.executive;
    const rows = { orders: [{ id: "o1", status: "completed", execution_stage: "awaiting_payment", updated_at: iso(1) }] };
    const counts = countActivity(kind, "exec", rows, {}, NOW);
    expect(counts.tabs["stage-awaiting-payment"]).toBe(1);
    expect(counts.tabs["stage-awaiting-collection"]).toBe(1);
    expect(counts.tabs["completed"]).toBe(1);
    expect(counts.tabs["all-orders"]).toBe(1);
    expect(counts.total).toBe(1);
  });

  test("never-opened tabs count the last 7 days", () => {
    expect(tabSince({}, "m", "t", NOW)).toBe(NOW - 7 * 24 * 3600_000);
  });

  test("badge text caps at 99+ and hides zero", () => {
    expect(formatBadgeCount(0)).toBe("");
    expect(formatBadgeCount(12)).toBe("12");
    expect(formatBadgeCount(150)).toBe("99+");
  });

  test("order stage tab is read from the page address", () => {
    expect(executiveTabFromPath("/executive/stage-awaiting-payment")).toBe("stage-awaiting-payment");
    expect(executiveTabFromPath("/executive/orders")).toBe("all-orders");
    expect(executiveTabFromPath("/executive/customers")).toBeNull();
  });
});
