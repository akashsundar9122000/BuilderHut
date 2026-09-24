import "server-only";
import { appUrl } from "@/lib/app-url";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { uuidv7 } from "uuidv7";

import { appSecret } from "@/lib/auth/app-secret";
import { hashPassword, verifyPassword } from "@/lib/auth/argon2";
import { getRootDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/provider";
import { passwordResetEmail, verificationCodeEmail } from "@/lib/email/templates";

/*
 * Authentication for merchants, staff and platform admins.
 *
 * Better Auth handles authentication only. Tenancy — which store a request acts
 * for, and what the actor may do there — is ours, in lib/db/tenant.ts and
 * lib/auth/session.ts. See the note in lib/db/schema/identity.ts for why the
 * organization plugin was left out.
 *
 * Storefront customers are a separate realm entirely — lib/customers/, with
 * its own tables, its own sessions and email that is unique per store rather
 * than globally. See the note at the top of lib/db/schema/customers.ts.
 */

const OTP_MINUTES = 10;

export const auth = betterAuth({
  appName: "BuilderHut",
  secret: appSecret(),
  baseURL: appUrl(),

  /*
   * Origin checking is CSRF protection and stays on in production, where the
   * only trusted origin is APP_URL. In development the dev server moves ports
   * whenever 3000 is already taken, and a rejected origin there reads as a
   * broken login rather than as a misconfiguration — so localhost on any port
   * is trusted, and only there.
   */
  trustedOrigins: (request) => {
    const origins = [appUrl()];
    if (process.env.NODE_ENV !== "production") {
      const origin = request?.headers.get("origin");
      if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        origins.push(origin);
      }
    }
    return origins;
  },

  database: drizzleAdapter(getRootDb(), {
    provider: "pg",
    /*
     * Keyed by modelName, not by Better Auth's default model key. The tables
     * are renamed below (user -> users, because USER is reserved in Postgres),
     * and the adapter looks itself up by the renamed value — a mismatch here
     * logs "Drizzle schema mismatch: missing tables" at runtime, not at build.
     */
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
    },
  }),

  advanced: {
    database: {
      // uuidv7, so identity ids are the same shape as every other id in the
      // schema and can be referenced by uuid foreign keys. Time-sortable and
      // non-enumerable, exactly as lib/db/schema/_shared.ts explains.
      generateId: () => uuidv7(),
    },
    cookiePrefix: "bh",
  },

  user: {
    modelName: "users",
    additionalFields: {
      isPlatformAdmin: {
        type: "boolean",
        defaultValue: false,
        // Never settable through the signup API — only by a migration or an
        // existing platform admin. Self-promotion would be the whole ballgame.
        input: false,
      },
    },
  },
  session: {
    modelName: "sessions",
    additionalFields: {
      activeTenantId: { type: "string", required: false, input: false },
    },
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Verification is a six-digit code, not a link — see the emailOTP plugin.
    // A code works when the signup tab and the inbox are on different devices,
    // which on a phone is most of the time.
    requireEmailVerification: false,
    password: {
      hash: hashPassword,
      verify: ({ hash: stored, password }) => verifyPassword(stored, password),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(passwordResetEmail(user.email, url));
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_MINUTES * 60,
      // Three guesses at a six-digit code, then the code is burned. Without a
      // cap, a million attempts is not a long afternoon.
      allowedAttempts: 3,
      async sendVerificationOTP({ email, otp }) {
        await sendEmail(verificationCodeEmail(email, otp, OTP_MINUTES));
      },
    }),
  ],

  socialProviders: {
    // Configured but optional: the blueprint is explicit that social login must
    // never be the only way in. Absent credentials simply means no button.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      /*
       * Credential endpoints are what gets attacked, so they are tighter than
       * the default — but not so tight that honest use trips them.
       *
       * These limits are per IP, and an IP is not a person: a household, an
       * office or a mobile carrier's NAT is one IP for hundreds of people. A
       * cap of two OTP sends a minute locked out anyone who mistyped their
       * address once and pressed resend, which is ordinary behaviour, not an
       * attack. The real protection against code guessing is the three-attempt
       * limit on the code itself, not on how often one can be requested.
       */
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 6 },
      "/email-otp/verify-email": { window: 60, max: 10 },
      "/forget-password": { window: 60, max: 5 },
    },
  },
});

export type Auth = typeof auth;
