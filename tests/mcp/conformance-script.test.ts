import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MCP conformance runner isolation", () => {
  it("does not forward a real PMS endpoint or bearer token from the shell", () => {
    const source = readFileSync(new URL("../../scripts/run-mcp-conformance.mjs", import.meta.url), "utf8");

    expect(source).toContain('PMS_BASE_URL: "http://127.0.0.1:9/api"');
    expect(source).toContain('PMS_AUTH_TOKEN: "conformance-token"');
    expect(source).not.toContain("PMS_BASE_URL: process.env.PMS_BASE_URL");
    expect(source).not.toContain("PMS_AUTH_TOKEN: process.env.PMS_AUTH_TOKEN");
  });
});
