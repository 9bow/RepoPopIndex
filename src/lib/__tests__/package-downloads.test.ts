import { describe, expect, it } from "vitest";
import { pointsToRepository } from "@/lib/collectors/package-downloads";

describe("pointsToRepository", () => {
  it("accepts HTTPS and SSH GitHub repository URLs", () => {
    expect(
      pointsToRepository(
        ["https://github.com/pallets/click.git"],
        "pallets",
        "click"
      )
    ).toBe(true);
    expect(
      pointsToRepository(
        ["git+ssh://git@github.com:pallets/click.git"],
        "pallets",
        "click"
      )
    ).toBe(true);
  });

  it("rejects an unrelated package with the same name", () => {
    expect(
      pointsToRepository(
        ["https://github.com/another-owner/click"],
        "pallets",
        "click"
      )
    ).toBe(false);
    expect(
      pointsToRepository(
        ["https://github.com/pallets/click-extra"],
        "pallets",
        "click"
      )
    ).toBe(false);
  });
});
