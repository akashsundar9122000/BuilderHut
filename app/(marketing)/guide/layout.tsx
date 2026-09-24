import "@/styles/guide.css";

/*
 * The guide's stylesheet is imported here rather than in the root layout, so
 * the prose CSS never reaches a storefront, a dashboard or the builder. The
 * marketing layout above already supplies the header, the footer and the theme
 * toggle, so there is nothing else for this layer to do.
 */
export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
