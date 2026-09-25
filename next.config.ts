import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * A Server Action's request body, capped.
   *
   * The default is 1MB, and exceeding it is not a polite rejection: the action
   * throws inside its own transport, which unmounts the React tree and takes
   * every unsaved edit with it. That cost a real draft on 2026-09-25 when a
   * photograph went into the builder.
   *
   * The client shrinks pictures to a 900KB budget before sending
   * (lib/media/downscale.ts), so nothing should approach this — it is the
   * second line, not the first, and it is set where a browser that cannot run
   * the canvas encoder still has room to land.
   */
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },

  // Storefronts render merchant-authored content, so the security headers here are
  // the floor for every surface. The storefront route group tightens them further.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
