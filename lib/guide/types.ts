/*
 * The guide's hand-written types.
 *
 * Deliberately small. Everything derived from the group table —
 * GuideGroupId, GuideAudienceId, and the page and group shapes — is generated
 * into nav.generated.ts and generated.ts by scripts/build-guide.mjs, because a
 * hand-written copy of a derived union is a copy that disagrees the first time
 * somebody adds a group. What is left here is the one shape the generator does
 * not derive from anything.
 */

/** A heading in a page's "on this page" list. Only h2 and h3 are collected. */
export type GuideHeading = { id: string; text: string; depth: number };
