/*
 * Hostname normalisation and validation.
 *
 * Kept free of server imports so both middleware (edge runtime) and the
 * dashboard can use it. Routing matches on the normalised form, so anything
 * this function accepts must be something the router can actually find.
 */

/** Hostnames a merchant must not be able to claim. */
const RESERVED_SUFFIXES = [
  "builderhut.com",
  "builderhut.app",
  "vercel.app",
  "vercel.sh",
  "localhost",
];

const RESERVED_EXACT = new Set(["localhost", "example.com", "example.org", "example.net"]);

export type HostnameCheck =
  | { ok: true; hostname: string; isApex: boolean }
  | { ok: false; reason: string };

/**
 * Strip everything routing does not match on: scheme, path, port, trailing dot,
 * case. A merchant will paste "https://www.mystore.com/" and mean the host.
 */
export function normaliseHostname(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, "");
  value = value.split("/")[0] ?? "";
  value = value.split("?")[0] ?? "";
  value = value.split(":")[0] ?? "";
  return value.replace(/\.$/, "");
}

export function checkHostname(input: string): HostnameCheck {
  const hostname = normaliseHostname(input);

  if (!hostname) return { ok: false, reason: "Enter a domain name." };
  if (hostname.length > 253) return { ok: false, reason: "That domain is too long." };

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return { ok: false, reason: "That needs to be a full domain, like mystore.com." };
  }
  for (const label of labels) {
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label) || label.length > 63) {
      return {
        ok: false,
        reason: "Domains are letters, numbers and hyphens, separated by dots.",
      };
    }
  }

  if (RESERVED_EXACT.has(hostname)) {
    return { ok: false, reason: "That domain is reserved." };
  }
  if (RESERVED_SUFFIXES.some((s) => hostname === s || hostname.endsWith(`.${s}`))) {
    // Claiming a BuilderHut subdomain would let a merchant impersonate the
    // platform to their own customers.
    return { ok: false, reason: "That domain belongs to BuilderHut and can't be connected." };
  }

  /*
   * Apex (mystore.com) versus subdomain (www.mystore.com) changes the DNS
   * advice: an apex usually cannot hold a CNAME, so it needs an A record or
   * the registrar's flattening. Telling the merchant which they have is most
   * of the help this screen can give.
   */
  const isApex = labels.length === 2;
  return { ok: true, hostname, isApex };
}

/** The DNS records a merchant needs to create, in the order they should add them. */
export function dnsInstructions(hostname: string, token: string, isApex: boolean) {
  return [
    {
      kind: "TXT" as const,
      name: `_builderhut.${hostname}`,
      value: token,
      why: "Proves the domain is yours. Remove it once the domain is live if you like.",
    },
    isApex
      ? {
          kind: "A" as const,
          name: hostname,
          value: "76.76.21.21",
          why: "Points the domain here. Most registrars call this an A record for @.",
        }
      : {
          kind: "CNAME" as const,
          name: hostname,
          value: "cname.builderhut.app",
          why: "Points the domain here.",
        },
  ];
}
