import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

// Plain config: no R2 incremental cache (R2 signup needs a payment
// method on file, which the owner does not have) and no Cloudflare
// Images (next/image runs unoptimized — see next.config.js). The
// adapter's defaults (dummy cache, Node runtime) are what this app
// needs: every page that reads data is dynamic, and static assets are
// served from the ASSETS binding in wrangler.jsonc.
export default defineCloudflareConfig();
