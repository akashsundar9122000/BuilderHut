import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  // Settings is forms, not rows — no primary action in the header.
  return <PageSkeleton rows={3} action={false} label="Loading settings" />;
}
