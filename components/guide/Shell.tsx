import { GuideDrawer } from "./Drawer";
import { GuideNav } from "./Nav";

/*
 * The guide's three-column frame: contents, the page, and "on this page".
 *
 * A server component, deliberately. If this were a client component the
 * rendered article would have to cross the server/client boundary as a
 * serialised slot, and every page's HTML would end up in its Flight payload —
 * which is the one way the guide could quietly cost more than the bundle budget
 * allows. Here `children` never crosses anything.
 *
 * Both copies of the nav carry an id. They differ only in which width shows
 * them, so a test reaching for "the search box" without one drives whichever
 * copy happens to be hidden, and passes while testing nothing.
 */
export function GuideShell({
  children,
  toc,
}: {
  children: React.ReactNode;
  toc?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl gap-10 px-5 py-8 sm:px-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-14 xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-8">
          <GuideNav id="guide-nav-desktop" />
        </div>
      </aside>

      <GuideDrawer className="lg:hidden" />

      <main className="mt-6 min-w-0 lg:mt-0">{children}</main>

      <aside className="hidden xl:block">
        <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-8">{toc}</div>
      </aside>
    </div>
  );
}
