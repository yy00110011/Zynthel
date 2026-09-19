import { describe, expect, it } from "vitest";
import { validateLauncherBody } from "./validation";

describe("launcher validation", () => {
  it("accepts explicit argv commands and absolute local paths", () => {
    expect(validateLauncherBody({ launch: { type: "custom-command", executable: "open", args: ["-a", "Terminal"] } }).success).toBe(true);
    expect(validateLauncherBody({ launch: { type: "local-path", path: "/tmp/project" } }).success).toBe(true);
  });
  it("rejects shell strings, relative paths, NUL bytes, and unknown actions", () => {
    expect(validateLauncherBody({ launch: { type: "custom-command", executable: "open; rm", args: [] } }).success).toBe(false);
    expect(validateLauncherBody({ launch: { type: "local-path", path: "../secret" } }).success).toBe(false);
    expect(validateLauncherBody({ launch: { type: "local-path", path: "/tmp/a\0b" } }).success).toBe(false);
    expect(validateLauncherBody({ launch: { type: "unknown" } }).success).toBe(false);
  });
});
