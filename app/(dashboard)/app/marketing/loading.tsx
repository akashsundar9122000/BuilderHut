import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return <PageSkeleton rows={2} action={false} label="Loading marketing" />;
}
