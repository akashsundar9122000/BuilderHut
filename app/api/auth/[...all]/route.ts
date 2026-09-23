import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/merchant";

// Sign-in, sign-up, OTP, password reset and OAuth callbacks all land here.
export const { GET, POST } = toNextJsHandler(auth);
