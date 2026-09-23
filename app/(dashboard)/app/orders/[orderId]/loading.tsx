import { PageSkeleton } from "@/components/ui";

export default function Loading() {
  return <PageSkeleton rows={4} action={false} label="Loading this order" />;
}
