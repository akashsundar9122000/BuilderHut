import { describe, expect, it } from "vitest";
import { checkHostname, dnsInstructions, normaliseHostname } from "@/lib/domains/hostname";

describe("normalising what a merchant pastes", () => {
  it("strips scheme, path, port, case and the trailing dot", () => {
    for (const input of [
      "https://www.MyStore.com/",
      "http://www.mystore.com",
      "www.mystore.com:443",
      "WWW.MYSTORE.COM.",
      "  www.mystore.com  ",
      "https://www.mystore.com/shop?utm_source=x",
    ]) {
      expect(normaliseHostname(input), input).toBe("www.mystore.com");
    }
  });
});

describe("what may be connected", () => {
  it("accepts ordinary domains and subdomains", () => {
    for (const host of ["mystore.com", "www.mystore.com", "shop.my-store.co.uk"]) {
      expect(checkHostname(host).ok, host).toBe(true);
    }
  });

  it("tells an apex from a subdomain, because the DNS advice differs", () => {
    const apex = checkHostname("mystore.com");
    const sub = checkHostname("www.mystore.com");
    expect(apex.ok && apex.isApex).toBe(true);
    expect(sub.ok && sub.isApex).toBe(false);
  });

  it("refuses anything that is not a full domain", () => {
    for (const host of ["mystore", "localhost", "", "   "]) {
      expect(checkHostname(host).ok, host).toBe(false);
    }
  });

  it("refuses BuilderHut's own domains", () => {
    // Claiming one would let a merchant impersonate the platform to their
    // own customers.
    for (const host of ["builderhut.com", "anything.builderhut.app", "x.vercel.app"]) {
      expect(checkHostname(host).ok, host).toBe(false);
    }
  });

  it("refuses malformed labels", () => {
    for (const host of ["-bad.com", "bad-.com", "b_d.com", `${"a".repeat(64)}.com`]) {
      expect(checkHostname(host).ok, host).toBe(false);
    }
  });
});

describe("DNS instructions", () => {
  it("asks an apex for an A record and a subdomain for a CNAME", () => {
    // An apex usually cannot hold a CNAME, and telling the merchant which they
    // have is most of the help this screen can give.
    expect(dnsInstructions("mystore.com", "tok", true).map((r) => r.kind)).toEqual(["TXT", "A"]);
    expect(dnsInstructions("www.mystore.com", "tok", false).map((r) => r.kind)).toEqual([
      "TXT",
      "CNAME",
    ]);
  });

  it("always asks for the ownership record first", () => {
    const [first] = dnsInstructions("mystore.com", "tok-123", true);
    expect(first!.kind).toBe("TXT");
    expect(first!.name).toBe("_builderhut.mystore.com");
    expect(first!.value).toBe("tok-123");
  });
});
