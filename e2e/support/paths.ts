import { tmpdir } from "node:os";
import path from "node:path";

/*
 * Where the test server's output goes.
 *
 * With no SMTP configured the email provider prints verification codes to
 * stdout by design, and the signup specs read them back from there. Playwright
 * starts the server itself, so its output has to land somewhere both sides
 * agree on — otherwise every run needs a server started by hand in another
 * terminal, which is how the suite ended up not being run for two phases.
 *
 * Override with BH_E2E_MAIL_LOG to point at a server you are running yourself.
 */
export const MAIL_LOG = process.env.BH_E2E_MAIL_LOG ?? path.join(tmpdir(), "builderhut-e2e.log");
