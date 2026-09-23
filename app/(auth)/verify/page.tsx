import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/auth/VerifyForm";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; resend?: string }>;
}) {
  const { email, resend } = await searchParams;
  // Nothing to verify without knowing whose address it is.
  if (!email) redirect("/signup");
  return <VerifyForm email={email} needsResend={resend === "1"} />;
}
