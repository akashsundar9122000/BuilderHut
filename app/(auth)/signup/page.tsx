import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getActor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your store" };

export default async function SignUpPage() {
  if (await getActor()) redirect("/app");
  return <SignUpForm />;
}
