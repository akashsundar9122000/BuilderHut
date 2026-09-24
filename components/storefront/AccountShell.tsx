import type { RenderContext } from "@/lib/render/context";
import { chromePage, StoreFooter, StoreHeader, StorePageShell } from "./StoreChrome";
import { AccountNav, type AccountTab } from "./AccountNav";

/*
 * The frame around every account page the builder does not lay out.
 *
 * Deliberately a component rather than an account/layout.tsx: the /account
 * landing page IS document-driven, so a layout would wrap it in a second header
 * and footer on top of the ones its own page already has.
 */

export function AccountShell({
  ctx,
  slug,
  title,
  lede,
  active,
  children,
}: {
  ctx: RenderContext;
  slug: string;
  title: string;
  lede?: string;
  active: AccountTab;
  children: React.ReactNode;
}) {
  const chrome = chromePage(ctx.doc, "account");
  return (
    <>
      <StoreHeader page={chrome} ctx={ctx} />
      <StorePageShell title={title} lede={lede} wide>
        <AccountNav base={ctx.base} slug={slug} active={active} />
        <div style={{ marginTop: 24 }}>{children}</div>
      </StorePageShell>
      <StoreFooter page={chrome} ctx={ctx} />
    </>
  );
}
