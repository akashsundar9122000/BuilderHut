"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button, ThemeToggle } from "@/components/ui";

/*
 * The operator's own controls: who they are, and the way out.
 *
 * There was no way out. The console showed the signed-in address and a theme
 * toggle and nothing else, so signing out of /admin meant going to the
 * merchant dashboard to find the button — and an operator created by
 * `pnpm admin:bootstrap` has no shop, so /app bounced them straight back.
 * There was, genuinely, no route out of this console except clearing cookies.
 *
 * That matters more here than on a merchant's own dashboard: this screen shows
 * every shop's business, and it is the one somebody is most likely to open on
 * a borrowed or shared machine.
 */
export function AdminTopBarActions({ email }: { email: string }) {
  const router = useRouter();

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      <p className="text-muted hidden max-w-[14rem] truncate text-xs sm:block">{email}</p>
      <ThemeToggle />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        onClick={async () => {
          await authClient.signOut();
          router.push("/login");
          router.refresh();
        }}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
