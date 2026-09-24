/*
 * The words on the landing page.
 *
 * Separated from the markup because the page was 390 lines of JSX with the
 * copy woven through it, and every editing pass meant reading past layout to
 * find a sentence. Expensify's landing page fits seventeen sections into 456
 * lines of markup precisely because its copy lives somewhere else; this is
 * that, and it also makes the page's claims reviewable in one screen.
 *
 * Nothing invented lives here. No merchant counts, no testimonials, no "trusted
 * by" logos — there are no merchants yet, and a landing page that opens with a
 * fabricated number has told its first lie above the fold. Where a fact exists
 * in the software it is read from the software instead: the plans come from
 * lib/plans/catalog, the trades from lib/industries, the templates from
 * lib/templates.
 */

export interface Door {
  href: string;
  title: string;
  body: string;
  cta: string;
}

/*
 * Three doors, not one link. The three audiences want genuinely different
 * things, and a single "Read the guide" button sends a shop owner into the API
 * reference.
 */
export const GUIDE_DOORS: readonly Door[] = [
  {
    href: "/guide/start/welcome",
    title: "Using BuilderHut",
    body: "From signing up to taking your first order. Every screen, in plain words, with pictures of the real thing.",
    cta: "Start reading",
  },
  {
    href: "/guide/api/overview",
    title: "API and MCP",
    body: "A REST API for your shop’s products, orders and customers — and an MCP server so an assistant can use it.",
    cta: "See the reference",
  },
  {
    href: "/guide/engineering/architecture",
    title: "How it is built",
    body: "Tenancy, the document model behind the builder, the render pipeline, and the gates that keep it honest.",
    cta: "Read the notes",
  },
];

export interface Feature {
  title: string;
  body: string;
  /**
   * Columns this card spans on a wide screen.
   *
   * The spans must add up to a whole number of rows or the grid ends with a
   * hole in it, which reads as a section that did not finish loading. Six
   * cards in three columns with one double and one triple is nine cells
   * exactly — so if a card is added here, the arithmetic has to be redone.
   */
  span?: 2 | 3;
}

/*
 * What you get, written as what it does for the person rather than as a
 * feature name. "Inventory management" is a line on a comparison table;
 * "it stops selling the thing once the last one has gone" is the reason
 * anybody wants it.
 */
export const FEATURES: readonly Feature[] = [
  {
    title: "A basket and a checkout that work",
    body: "Not a contact form pretending to be a shop. A real basket, a real checkout, delivery charges, discount codes, and an order at the end of it.",
    span: 2,
  },
  {
    title: "Stock that counts itself down",
    body: "Sell the last one and it stops being for sale. Every movement is recorded, so you can see where a missing item went.",
  },
  {
    title: "Orders, in one place",
    body: "Paid, packed, posted, refunded. With a timeline on each one, so you can see what happened and when.",
  },
  {
    title: "Customers who come back",
    body: "They can make an account, see what they have ordered before, save an address and keep a wishlist.",
  },
  {
    title: "Your own address",
    body: "Every shop is live at a BuilderHut address the moment you publish. Bring your own domain when you are ready — the old links keep working.",
  },
  {
    title: "Numbers you can act on",
    body: "What people looked at, what they bought, what they nearly bought. Every comparison says which period it is comparing to, which is the bit most dashboards leave you to guess.",
    span: 3,
  },
];

export interface Principle {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
}

/*
 * The honest differentiator, and the only section here a template marketplace
 * could not copy by Friday. Each one links into the engineering guide, where
 * the claim is written out in full — a claim on a landing page with nowhere to
 * check it is just a nicer adjective.
 */
export const PRINCIPLES: readonly Principle[] = [
  {
    title: "Your money is counted in whole paise",
    body: "Every price, discount and total is a whole number of minor units — never a decimal that drifts. A ₹0.01 rounding error is somebody's missing rupee, and it compounds.",
    href: "/guide/engineering/architecture",
    linkLabel: "How money is stored",
  },
  {
    title: "Your shop cannot see anyone else's",
    body: "Separation is enforced by the database itself, not by remembering to add a filter to a query. The application connects as a role that is not permitted to read across shops, and the tests refuse to pass against one that can.",
    href: "/guide/engineering/architecture",
    linkLabel: "How tenancy works",
  },
  {
    title: "Nothing is saved as a pile of HTML",
    body: "Your shop is a document the renderer reads — which is why the editor and the live page cannot disagree, why undo goes back twenty steps, and why you can roll a bad change back to exactly what was there before.",
    href: "/guide/engineering/architecture",
    linkLabel: "The document model",
  },
];

export interface Question {
  q: string;
  a: string;
}

export const QUESTIONS: readonly Question[] = [
  {
    q: "Do I need to know how to build a website?",
    a: "No. You pick a starting point that suits what you make, then change the words, the colours and the pictures by clicking on them. If you can use Instagram, you can use this.",
  },
  {
    q: "What does it cost?",
    a: "Nothing to build, and nothing to keep a store at its BuilderHut address. Paid plans arrive when there is something worth paying for — a custom domain, staff accounts, deeper analytics. You will not find a bill you did not agree to.",
  },
  {
    q: "Can I use my own domain name?",
    a: "That is coming. Every store gets a free BuilderHut address now, and it keeps working after you connect a domain — old links will not break.",
  },
  {
    q: "How do I take payment?",
    a: "Card payments through a real gateway are being built. Today you can list what you make, take enquiries over WhatsApp, and test the whole checkout with a simulated payment so nothing surprises you when it goes live.",
  },
  {
    q: "Will my store look like everybody else's?",
    a: "That is the thing we are most careful about. A bakery, a jeweller and a streetwear label start from genuinely different designs — different typefaces, different spacing, different shapes — not the same page in three colours. There is a test that fails the build if two templates are the same layout recoloured.",
  },
  {
    q: "What happens to my products if I stop paying?",
    a: "Your data stays yours. Exports are part of the plan from the beginning, and nothing you have made gets held hostage.",
  },
];
