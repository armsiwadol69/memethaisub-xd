import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
    // Overrides the default Next.js cache to use Cloudflare R2
    incrementalCache: r2IncrementalCache,
});
