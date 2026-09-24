import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { TemplatePreview } from "@/components/marketing/TemplatePreview";
import { Section, Shell } from "@/components/marketing/Shell";
import { Button } from "@/components/ui";
import { getTemplate, TEMPLATES } from "@/lib/templates";

/*
 * A template, previewed in full, without an account.
 *
 * The gallery used to link straight at /signup?template=…, which asks somebody
 * to create an account to find out whether the thing is any good. Its own
 * header comment said previewing without signing up was required; this is that.
 *
 * It renders through RenderPage — the same component the published storefront
 * and the draft preview use — against the document the template actually
 * builds. So this is not an impression of the template, it is the template. If
 * the two could differ, one of them would be wrong, and it would be this one.
 */

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) return { title: "Template not found" };

  return {
    title: `${template.name} — a BuilderHut template`,
    description: template.blurb,
  };
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) notFound();


  return (
    <main>
      <Section className="border-border border-b">
        <Shell className="flex flex-wrap items-center gap-x-6 gap-y-4 py-6">
          <div>
            <Link
              href="/templates"
              className="text-muted hover:text-text inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All templates
            </Link>
            <h1 className="font-display mt-2 text-3xl leading-tight">{template.name}</h1>
            <p className="text-muted mt-1.5 max-w-lg text-sm">{template.blurb}</p>
          </div>
          <Button asChild size="lg" className="ml-auto">
            <Link href={`/signup?template=${template.id}`}>
              Start with {template.name} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </Shell>
      </Section>

      <Section className="bg-raised">
        <Shell wide className="py-10">
          {/*
           * Said once, plainly, and not in a corner. The products below are
           * invented — this shop does not exist and nobody makes these. A
           * preview that looks like a real trading business is a small lie
           * with no upside.
           */}
          <p className="text-muted mb-5 text-center text-sm">
            A live preview with example products. Everything here is yours to change.
          </p>

          <TemplatePreview src={`/template-preview/${template.id}`} name={template.name} />
        </Shell>
      </Section>
    </main>
  );
}
