"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button, ThemeToggle } from "@/components/ui";

export function TopBar({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  return (
    <header className="border-border bg-canvas/85 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur sm:px-6">
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-text text-xs font-medium leading-tight">{name}</p>
          <p className="text-muted text-xs leading-tight">{email}</p>
        </div>
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
    </header>
  );
}
