import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAdminSession,
  readAdminSession,
  verifyAdminPassword,
} from "@/lib/admin/auth";

describe("admin auth", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    process.env.ADMIN_SESSION_SECRET = "test-session-secret";
    process.env.ADMIN_USER = "operator";
  });

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_USER;
  });

  it("validates the password and signed session", () => {
    expect(verifyAdminPassword("wrong")).toBe(false);
    expect(verifyAdminPassword("correct horse battery staple")).toBe(true);
    const session = readAdminSession(createAdminSession());
    expect(session?.user).toBe("operator");
  });

  it("rejects a modified session", () => {
    const session = createAdminSession();
    expect(readAdminSession(`${session}x`)).toBeNull();
  });
});
