import { afterEach, describe, expect, it } from "vitest";

import { appHost, appIsSecure, appUrl } from "@/lib/app-url";

/*
 * Where the deployment thinks it lives.
 *
 * Getting this wrong does not throw — it makes Better Auth reject every
 * request as a cross-origin attempt, which surfaces to a user as "that email
 * and password don't match an account". That failure cost an afternoon
 * locally, and would cost more in production.
 */

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

function set(vars: Record<string, string | undefined>) {
  for (const key of ["APP_URL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
}

describe("appUrl", () => {
  it("prefers an explicit APP_URL, which is the only thing that knows a custom domain", () => {
    set({ APP_URL: "https://shop.example.com", VERCEL_URL: "preview.vercel.app" });
    expect(appUrl()).toBe("https://shop.example.com");
  });

  it("drops a trailing slash, so links are not built with two", () => {
    set({ APP_URL: "https://example.com/" });
    expect(appUrl()).toBe("https://example.com");
  });

  it("uses the stable production host in production", () => {
    set({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "builderhut.vercel.app",
      VERCEL_URL: "builderhut-abc123.vercel.app",
    });
    expect(appUrl()).toBe("https://builderhut.vercel.app");
  });

  it("uses the deployment's own host on a preview, so it links to itself", () => {
    set({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "builderhut.vercel.app",
      VERCEL_URL: "builderhut-abc123.vercel.app",
    });
    expect(appUrl()).toBe("https://builderhut-abc123.vercel.app");
  });

  it("falls back to localhost when nothing says otherwise", () => {
    set({});
    expect(appUrl()).toBe("http://localhost:3000");
  });

  it("reports the hostname alone for host matching", () => {
    set({ APP_URL: "https://shop.example.com:8443/x" });
    expect(appHost()).toBe("shop.example.com");
  });

  it("does not throw on a malformed APP_URL", () => {
    set({ APP_URL: "not a url" });
    expect(() => appHost()).not.toThrow();
    expect(appHost()).toBe("localhost");
  });

  it("knows whether cookies may be marked secure", () => {
    set({ APP_URL: "https://example.com" });
    expect(appIsSecure()).toBe(true);
    set({});
    // Localhost over http: a Secure cookie here is one Safari silently drops.
    expect(appIsSecure()).toBe(false);
  });
});
