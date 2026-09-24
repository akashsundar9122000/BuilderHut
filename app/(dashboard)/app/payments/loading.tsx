import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return <PageSkeleton rows={3} action={false} label="Loading payment settings" />;
}
