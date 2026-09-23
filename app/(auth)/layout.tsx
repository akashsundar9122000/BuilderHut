import Link from "next/link";
import { ThemeToggle } from "@/components/ui";

/*
 * A split shell: the form on the left, and on the right a piece of the product
 * itself rather than stock photography.
 *
 * The panel shows a miniature storefront because the first question anyone has
 * at a signup form is "what will I actually get". Showing it costs nothing —
 * it is CSS, not an image — and it is the only argument that matters here.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="flex w-full flex-col lg:w-[52%]">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Link
            href="/"
            className="font-display text-text hover:text-accent text-lg transition-colors"
          >
            BuilderHut
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <aside className="bg-raised border-border relative hidden overflow-hidden border-l lg:block lg:w-[48%]">
        <ShopPreview />
      </aside>
    </div>
  );
}

function ShopPreview() {
  return (
    <div className="flex h-full flex-col justify-center px-14">
      <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
        Thread &amp; Bloom
      </p>
      <h2 className="font-display mt-4 text-4xl leading-[1.1]">
        Crochet flowers that never wilt.
      </h2>
      <p className="text-muted mt-4 max-w-sm text-sm">
        Made by hand in Chennai. Every bloom is a little different, which is rather
        the point.
      </p>

      <div className="mt-10 grid grid-cols-3 gap-4">
        {[
          { name: "Daisy posy", price: "₹499", tone: "bg-accent-soft" },
          { name: "Peony single", price: "₹349", tone: "bg-accent-2-soft" },
          { name: "Gift box", price: "₹1,299", tone: "bg-sunken" },
        ].map((p) => (
          <div key={p.name} className="group">
            <div
              className={`${p.tone} border-border aspect-square rounded-lg border transition-transform duration-(--bh-duration-base) ease-(--ease-out) group-hover:-translate-y-1`}
            />
            <p className="text-text mt-2 text-xs font-medium">{p.name}</p>
            <p className="text-muted text-xs">{p.price}</p>
          </div>
        ))}
      </div>

      <p className="text-faint mt-12 text-xs">
        A store built on BuilderHut. Yours will look nothing like it.
      </p>
    </div>
  );
}
