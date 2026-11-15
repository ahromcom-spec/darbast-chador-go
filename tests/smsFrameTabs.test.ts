import { describe, expect, test } from "bun:test";
import { allowedFrameTabs, resolveFrameTab } from "../src/lib/smsFrameTabs";

describe("custom frame display tab", () => {
  test("customer recipients allow the customer tab only", () => {
    expect(allowedFrameTabs(["customer"])).toEqual(["customer"]);
    expect(allowedFrameTabs(["event_person"])).toEqual(["customer"]);
  });
  test("management recipients allow the Ahrom management tab only", () => {
    expect(allowedFrameTabs(["roles"])).toEqual(["ceo"]);
    expect(allowedFrameTabs(["phones"])).toEqual(["ceo"]);
  });
  test("customer and management recipients allow both tabs", () => {
    expect(allowedFrameTabs(["customer", "roles"])).toEqual(["customer", "ceo"]);
  });
  test("a tab that no longer matches the recipients falls back to the frames tab", () => {
    expect(resolveFrameTab("customer", ["roles"])).toBeNull();
    expect(resolveFrameTab("ceo", ["roles"])).toBe("ceo");
    expect(resolveFrameTab(null, ["customer"])).toBeNull();
  });
});
