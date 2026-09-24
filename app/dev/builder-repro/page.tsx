// TEMPORARY repro harness — delete before committing.
import { buildDocument } from "@/lib/templates";
import { ReproClient } from "./client";

export default function Page() {
  const doc = buildDocument("hearth", {
    storeName: "Repro Store",
    tagline: "Things worth keeping",
    industry: "decor",
  });
  return <ReproClient doc={doc} />;
}
