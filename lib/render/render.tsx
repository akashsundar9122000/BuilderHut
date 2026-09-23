import type { Page, Section } from "@/lib/schema/page";
import type { RenderContext } from "./context";
import { parseSectionProps, REGISTRY } from "./registry";

/*
 * Turns a page document into React.
 *
 * Used by the live storefront (as a server component), the builder canvas and
 * the preview route — the same function, so what a merchant approves in the
 * editor is what a customer gets.
 */

export function RenderSection({ section, ctx }: { section: Section; ctx: RenderContext }) {
  if (!section.visible && !ctx.editing) return null;

  const entry = REGISTRY[section.type];
  if (!entry) return null; // unregistered type — schema should have caught it

  const props = parseSectionProps(section.type, section.props);
  if (!props) return null;

  const Component = entry.component;
  return <Component props={props as never} ctx={ctx} />;
}

export function RenderPage({ page, ctx }: { page: Page; ctx: RenderContext }) {
  return (
    <>
      {page.sections.map((section) => (
        <RenderSection key={section.id} section={section} ctx={ctx} />
      ))}
    </>
  );
}
