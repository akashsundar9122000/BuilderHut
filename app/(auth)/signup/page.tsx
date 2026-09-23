import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getActor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your store" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; email?: string }>;
}) {
  const { invite, email } = await searchParams;

  /*
   * Somebody already signed in who followed an invitation link wants the
   * invitation, not their own dashboard — they were sent here because they had
   * no account, and by the time they arrive they may have signed in instead.
   */
  if (await getActor()) redirect(invite ? `/invite/${encodeURIComponent(invite)}` : "/app");

  return <SignUpForm invite={invite} email={email} />;
}
