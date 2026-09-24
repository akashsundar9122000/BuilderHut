import { RenderPage, RenderSection } from "@/lib/render/render";
import { resolveSystemPage } from "@/lib/render/system-page";
import type { RenderContext } from "@/lib/render/context";
import { homePage, type SectionType, type SystemPage } from "@/lib/schema/page";
import { StoreFooter, StoreHeader } from "./StoreChrome";

/*
 * One place that decides between the merchant's own page and the plain fallback.
 *
 * Keeping it here rather than in each route means /login, /signup and /account
 * cannot drift apart, and the pure decision it wraps is unit-tested without a
 * DOM in tests/unit/system-pages.test.ts.
 */

export function SystemPageBody({
  system,
  fallbackType,
  ctx,
}: {
  system: SystemPage;
  fallbackType: SectionType;
  ctx: RenderContext;
}) {
  const resolved = resolveSystemPage(ctx.doc, system, fallbackType);

  if (resolved.kind === "document") {
    return <RenderPage page={resolved.page} ctx={ctx} />;
  }

  const home = homePage(ctx.doc);
  return (
    <>
      <StoreHeader page={home} ctx={ctx} />
      {/*
       * data-fallback so a test can tell the two paths apart, and no
       * StorePageShell: the section draws its own heading, and the shell's <h1>
       * would sit above it saying the same thing twice.
       */}
      <main
        data-fallback={system}
        style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        <RenderSection section={resolved.section} ctx={ctx} />
      </main>
      <StoreFooter page={home} ctx={ctx} />
    </>
  );
}
