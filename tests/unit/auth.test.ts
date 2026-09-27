import { describe, expect, it } from "vitest";
import { AuthStore, type Keyring } from "../../apps/pms-cli/src/auth/AuthStore.js";
import { buildAuthorizeUrl, createPkcePair } from "../../apps/pms-cli/src/auth/BrowserAuth.js";

function memoryKeyring(): Keyring & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    async get(key) { return values.get(key) ?? null; },
    async set(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
  };
}

describe("PMS CLI browser authentication", () => {
  it("stores refresh credentials without persisting an access token", async () => {
    const keyring = memoryKeyring();
    const store = new AuthStore(keyring);

    await store.save({
      accountId: "7",
      baseUrl: "http://localhost:8080/api",
      displayName: "Brad",
      refreshToken: "refresh-only",
    });

    const serialized = [...keyring.values.values()].join(" ");
    expect(serialized).toContain("refresh-only");
    expect(serialized).not.toContain("accessToken");
    expect((await store.getActiveAccount())?.refreshToken).toBe("refresh-only");
  });

  it("creates an S256 PKCE challenge and preserves state in the authorization URL", () => {
    const pkce = createPkcePair(() => "verifier-for-test-1234567890");
    const url = buildAuthorizeUrl("http://localhost:5173", "http://127.0.0.1:43127/callback", pkce, "state-1");
    const parsed = new URL(url);

    expect(pkce.verifier).toBe("verifier-for-test-1234567890");
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parsed.pathname).toBe("/cli/authorize");
    expect(parsed.searchParams.get("state")).toBe("state-1");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });
});
