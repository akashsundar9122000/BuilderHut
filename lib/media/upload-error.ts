import { ImageTooLargeError } from "@/lib/media/downscale";

/*
 * What to tell somebody whose upload just failed.
 *
 * Every picker catches, because a Server Action that rejects the request body
 * throws in its transport instead of returning — and an uncaught throw inside
 * a transition unmounts the tree. In the builder that costs every edit since
 * the last autosave, so "the upload failed" has to be a message, never an
 * error boundary.
 *
 * The raw error is not shown. It is either our own sentence or a framework
 * string like "Body exceeded 1 MB limit", which tells a merchant nothing they
 * can act on and names a limit they have never heard of.
 */
export function messageFor(cause: unknown): string {
  if (cause instanceof ImageTooLargeError) return cause.message;
  return "That picture could not be uploaded. Check your connection and try again.";
}
