"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

/*
 * Browser-side auth. Same origin, so no baseURL is needed — and not specifying
 * one means the client cannot accidentally be pointed at another deployment.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
