import { describe, expect, it } from "vitest";
import { nextMonthlyRun } from "@/lib/admin/schedule";

describe("nextMonthlyRun", () => {
  it("uses the current month when the schedule day has not passed", () => {
    expect(
      nextMonthlyRun(new Date("2026-07-05T00:00:00Z"), 10).toISOString()
    ).toBe("2026-07-10T01:00:00.000Z");
  });

  it("rolls to the following month and clamps the day to 28", () => {
    expect(
      nextMonthlyRun(new Date("2026-07-29T00:00:00Z"), 31).toISOString()
    ).toBe("2026-08-28T01:00:00.000Z");
  });
});
