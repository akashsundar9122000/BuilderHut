import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { getActor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getActor()) redirect("/app");
  return <SignInForm />;
}
